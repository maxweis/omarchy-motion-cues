import math
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gyrosc_receiver import acceleration, Receiver, G, private_peer


def string(value):
    raw = value.encode() + b"\0"
    return raw + b"\0" * (-len(raw) % 4)


def message(values=(0.2, -0.1, 0.0), tags="fff", address="/gyrosc/accel"):
    return string(address) + string("," + tags) + struct.pack(">" + tags, *values)


def bundle(*packets):
    return b"#bundle\0" + struct.pack(">Q", 1) + b"".join(struct.pack(">i", len(p)) + p for p in packets)


class ProtocolTests(unittest.TestCase):
    def test_units_and_axes(self):
        for tags in ("fff", "ddd", "fdf"):
            result = acceleration(message(tags=tags))
            for got, expected in zip(result, (0.2 * G, -0.1 * G, 0)):
                self.assertAlmostEqual(got, expected, places=6)
        self.assertEqual(acceleration(message((0, 0, 0))), [0, 0, 0])
        self.assertEqual(acceleration(message((1, -1, 0), "iii")), [G, -G, 0])

    def test_bundles_and_unknown_messages(self):
        ignored = message(address="/gyrosc/gyro")
        self.assertIsNone(acceleration(ignored))
        for data in (bundle(ignored, message()), bundle(bundle(message()), ignored)):
            self.assertEqual(acceleration(data), acceleration(message()))
        self.assertEqual(acceleration(bundle(message(), message((0, 0, 0)))), [0, 0, 0])

    def test_malformed_and_unbounded_packets(self):
        deep = message()
        for _ in range(6):
            deep = bundle(deep)
        for data in (b"", b"garbage", b"#bundle\0", b"a" * 8196, deep,
                     bundle(*([message()] * 65)), message()[:-1], message() + b"\0" * 4,
                     message((1, 2), "ff"), string("/gyrosc/accel") + string(",sss"),
                     bundle(message()) + struct.pack(">i", -1),
                     message((math.nan, 0, 0)), message((math.inf, 0, 0)), message((21, 0, 0))):
            with self.subTest(data=data[:40]):
                self.assertIsNone(acceleration(data))

    def test_private_senders_only(self):
        for host in ("10.0.0.1", "172.20.10.1", "192.168.1.5", "127.0.0.2"):
            self.assertTrue(private_peer(host))
        for host in ("8.8.8.8", "0.0.0.0", "169.254.1.1", "::1", "224.0.0.1", "bad"):
            self.assertFalse(private_peer(host))

    def test_pinning_rate_limit_restart_and_invalid_packets(self):
        receiver = Receiver()
        a, b = ("192.168.1.2", 7000), ("192.168.1.3", 7000)
        first = receiver.receive(message(), a, 1)
        self.assertIsNotNone(first)
        self.assertIsNone(receiver.receive(message(), a, 1.01))
        self.assertIsNone(receiver.receive(message(), b, 1.2))
        self.assertIsNone(receiver.receive(b"bad", a, 1.8))
        second = receiver.receive(message(), b, 2)
        self.assertNotEqual(first["session"], second["session"])
        self.assertEqual(second["peer"], b[0])
        self.assertGreater(second["t"], first["t"])
        self.assertNotEqual(receiver.receive(message(), b, 4)["session"], second["session"])
        self.assertIsNone(receiver.receive(message(), ("8.8.8.8", 1), 6))


if __name__ == "__main__":
    unittest.main()
