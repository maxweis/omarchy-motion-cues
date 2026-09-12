#!/usr/bin/env python3
"""Receive GyrOSC's default /gyrosc/accel messages; emit bounded JSON lines.

No dependencies, disk writes, outgoing packets, or remote commands. One process
belongs to the loaded QML service. Default GyrOSC userAcceleration is in g, with
gravity already excluded. Normalize to m/s^2 without subtracting gravity again.
"""

import argparse
import ipaddress
import json
import math
import selectors
import socket
import struct
import sys
import time
import uuid

PRIVATE_NETWORKS = tuple(ipaddress.ip_network(n) for n in
                         ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"))
MAX_PACKET = 8192
MAX_MESSAGES = 64
PEER_TIMEOUT = 0.9
G = 9.80665


def private_peer(host):
    try:
        address = ipaddress.IPv4Address(host)
        return any(address in network for network in PRIVATE_NETWORKS)
    except ipaddress.AddressValueError:
        return False


def osc_string(data, offset):
    end = data.index(b"\0", offset)
    stop = (end + 4) & ~3
    if stop > len(data) or any(data[end:stop]):
        raise ValueError("Invalid OSC string padding")
    return data[offset:end].decode("ascii"), stop


def acceleration(packet):
    """Return the last valid acceleration in one bounded OSC message/bundle.

    Bundles are accepted for interoperable senders. Timetags are not scheduled:
    this is a live receiver, not a playback engine. Unknown messages are ignored.
    Reject malformed packets atomically rather than exposing a partial result.
    """
    if not packet or len(packet) > MAX_PACKET or len(packet) % 4:
        return None
    remaining = MAX_MESSAGES

    def parse(data, depth=0):
        nonlocal remaining
        remaining -= 1
        if remaining < 0 or depth > 4:
            raise ValueError("OSC nesting or message limit")
        if data.startswith(b"#bundle\0"):
            if len(data) < 16:
                raise ValueError("Truncated bundle")
            offset, latest = 16, None
            while offset < len(data):
                size = struct.unpack_from(">i", data, offset)[0]
                offset += 4
                if size < 4 or size % 4 or offset + size > len(data):
                    raise ValueError("Invalid bundle element")
                value = parse(data[offset:offset + size], depth + 1)
                if value is not None:
                    latest = value
                offset += size
            return latest
        address, offset = osc_string(data, 0)
        if address != "/gyrosc/accel":
            return None
        tags, offset = osc_string(data, offset)
        if len(tags) != 4 or tags[0] != "," or any(t not in "fid" for t in tags[1:]):
            raise ValueError("Expected three numeric axes")
        values = []
        for tag in tags[1:]:
            value = struct.unpack_from(">" + tag, data, offset)[0] * G
            offset += 8 if tag == "d" else 4
            if not math.isfinite(value) or abs(value) > 200:
                raise ValueError("Acceleration out of range")
            values.append(value)
        if offset != len(data):
            raise ValueError("Trailing OSC data")
        return values

    try:
        return parse(packet)
    except (ValueError, UnicodeError, struct.error):
        return None


class Receiver:
    """Pin one sender while live, and forward no more than 20 samples/sec."""
    def __init__(self):
        self.peer = None
        self.last_seen = -math.inf
        self.last_emitted = -math.inf
        self.session = ""

    def receive(self, packet, peer, now):
        if not private_peer(peer[0]):
            return None
        if peer != self.peer and now - self.last_seen < PEER_TIMEOUT:
            return None
        values = acceleration(packet)
        if values is None:
            return None
        if peer != self.peer or now - self.last_seen >= PEER_TIMEOUT:
            self.peer = peer
            self.session = "gyrosc:" + str(uuid.uuid4())
            self.last_emitted = -math.inf
        self.last_seen = now
        if now - self.last_emitted < 0.05:
            return None
        self.last_emitted = now
        return dict(zip(("x", "y", "z"), values), t=now, session=self.session,
                    peer=peer[0], type="sample")


def emit(value):
    print(json.dumps(value, separators=(",", ":"), allow_nan=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=9999)
    parser.add_argument("--watch-stdin", action="store_true", help="exit when the owning process closes stdin")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("port must be between 1024 and 65535")
    receiver = Receiver()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # No SO_REUSEADDR: another listener must fail visibly, not steal data.
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
            sock.bind(("0.0.0.0", args.port))
            emit({"type": "listening", "port": args.port})
            with selectors.DefaultSelector() as selector:
                selector.register(sock, selectors.EVENT_READ)
                if args.watch_stdin:
                    selector.register(sys.stdin, selectors.EVENT_READ)
                while True:
                    for key, _ in selector.select():
                        if key.fileobj is sys.stdin:
                            if not sys.stdin.buffer.read1(1024):
                                return 0
                        else:
                            packet, peer = sock.recvfrom(MAX_PACKET + 1)
                            value = receiver.receive(packet, peer, time.monotonic())
                            if value is not None:
                                emit(value)
    except BrokenPipeError:
        return 0
    except OSError:
        emit({"type": "error", "message": "Cannot listen for GyrOSC on UDP " + str(args.port)
              + ". Check whether another app is using this port."})
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
