# Architecture

Motion Cues is an Omarchy service, not a separate always-running daemon. Enabling
`max.motion-cues` loads `Service.qml`; disabling it destroys its timers, requests,
and overlay windows. Keep the plugin ID stable so existing installations retain
their enabled state and settings.

## Responsibilities

| File | Responsibility |
| --- | --- |
| `Settings.js` | Validate settings and normalize private HTTP endpoints |
| `Endpoint.jq` | Equivalent endpoint validator for the lightweight Bash CLI |
| `Phyphox.js` | Request path and conversion from phyphox JSON to normalized samples |
| `gyrosc_receiver.py` | Bounded OSC decoding, private sender selection, g-to-m/s² conversion, rate limiting |
| `GyrOSC.qml` | One owned receiver process, port changes, retry, stdout streaming and cleanup |
| `MotionModel.js` | Pure sensor-to-cue filtering, intensity and reflection calculations |
| `BubbleFlow.js` | Pure seeded layout, movement, boundary recycling and fades |
| `Service.qml` | Settings persistence, HTTP lifecycle, notifications, IPC and monitor surfaces |
| `BubbleField.qml` | Frame clock and the fixed pool of 32 bubble delegates |
| `Bubble.qml` | Bubble appearance and motion-driven highlights |
| `omarchy-motion-cues` | Menu actions, explicit enable/disable, endpoint prompt and Setup window |
| `setup_window.py`, `SETUP.txt` | On-demand, read-only GTK guide with Overview, phyphox and GyrOSC tabs |
| `scripts/install.py` | Per-user deployment, recoverable removal and scoped JSONC menu merging |

JavaScript modules use the Qt-compatible language subset and expose CommonJS
exports only for Node tests. Do not introduce Node APIs into runtime modules.
`tests/model.cjs` is a test-only aggregate, not a production compatibility layer.

## Data contract and units

Providers normalize to `{x, y, z, t, session}`. Acceleration excludes gravity and
uses m/s². `t` is a monotonically increasing sensor timestamp in seconds within
the session. The clock may restart when `session` changes. All axes must be finite
numbers, within ±200 m/s²; timestamps must be nonnegative. phyphox must also
report `status.measuring: true`.
GyrOSC uses the default `/gyrosc/accel` numeric triple (userAcceleration), already
gravity-free. Its g values are multiplied by 9.80665. Default messages lack sensor
timestamps, so the receiver uses monotonic arrival time and a per-session UUID.
This detects silence, not replays or frozen sensor values sent in fresh packets.

The default `provider: "auto"` arbitrates candidates independently: the first
advancing feed wins, and the active provider cannot change until stale or failed.
Unused HTTP polling pauses while GyrOSC is selected. A saved HTTP address is
optional in Auto/GyrOSC modes and still required in phyphox-only mode. No scanning
or remote configuration is performed. Explicit provider changes reset the feed.

A single sample never establishes a live connection. Time must advance. Duplicate
timestamps do not update animation or keep the connection alive. A backwards
timestamp or session change reseeds filters before another advancing sample can
reconnect. This prevents cached data from looking live.

Flat mount: screen up, top edge forward; forward acceleration is `y`.
Upright mount: screen facing a forward-facing passenger, top edge up; forward
acceleration is `-z`. Lateral acceleration drives cues in the opposite direction.
Forward acceleration drives cues down; braking drives them up.

## Scheduling and performance

- One HTTP request in flight, with request starts spaced at least about 50 ms.
- One-shot request timeout: 800 ms. Failed requests retry after 1000 ms.
- One-shot stale-data timeout: 900 ms after the last advancing sample.
- No periodic watchdog or 20 Hz wakeups during retry backoff.
- No HTTP requests before a valid address is configured. Auto/GyrOSC mode can
  listen without an address; missing settings use Auto defaults. Malformed settings
  stop both transports. Disabling/unloading the service stops all networking.
- One Python standard-library process for GyrOSC, blocking on socket/stdin readiness
  while idle. Closing its owner pipe stops it even if Quickshell exits abruptly.
- At most 20 forwarded UDP samples/second; one live source IP/port pinned for 900 ms.
  Only RFC1918/loopback IPv4 sources, 8192-byte packets, 64 messages and four nested
  bundle levels are accepted. OSC is not authenticated. No reuse of occupied ports.
- No per-sample child process, disk writes, or sensor history.
- Notifications spawn only on connection transitions, never every sample.
- A fixed 32-particle pool and ordinary rectangles; no blur or image shaders.
- The frame loop runs only with a visible feed and movement or an unfinished fade.
- Settings changes preserve the current motion filter unless the endpoint changes.

`status.timerWakeups` counts timer callbacks for diagnostics. It is not a CPU or
battery measurement. Network rate, animation rate and screen refresh are distinct.
Do not claim battery improvements from a microbenchmark alone.

## Visual behavior

The original 1.5 movement and appearance are retained. Cue speed is bounded at
180 logical pixels/second per axis, filtered over 0.22 seconds, with a 0.12 m/s²
dead zone. It is not an integrated estimate of vehicle velocity.

Twelve base bubbles occupy side strips. Up to twenty extras appear in groups of
four at intensity thresholds 0.8, 1.3, 1.9, 2.6 and 3.4. Intensity has a 0.18-second
attack and 0.55-second release. Side strips are at most 14% of screen width and
200 logical pixels; top/bottom strips at most 14% of height and 160 logical pixels.

Per-bubble size is 82-118% of the selected size, speed multiplier 0.76-1.24,
with smooth pacing, perpendicular curves and variable fades. Randomness is seeded
once per field, not added as per-frame noise. Size and entry lanes change only
while recycled bubbles are invisible. Analytic curve integration preserves
trajectories across 30/60/120 Hz. A compositor stall is capped at a 50 ms step.

Panels use the overlay layer, an empty input region and no keyboard focus. These
properties must remain invariant, including during errors and disconnection.

## Adding a provider

1. Implement an adapter that produces the normalized sample contract above.
2. Verify axis signs, gravity exclusion, units and timestamp behavior against
   device recordings. Do not assume all apps agree about coordinate conventions.
3. Give the provider a clear transport lifecycle with cancellation, timeout,
   bounded rates and unload cleanup. Prefer a narrow interface over a generalized
   framework before a second provider exists.
4. Preserve phyphox and saved settings. An explicit provider selection must be
   migration-safe. Update Setup and add protocol fixtures plus live-device checks.

Sensor Logger and gyroscope correction have not been implemented. GyrOSC's
background capability is not proof of end-to-end
latency or reliable background operation on a particular phone.

Protocol references: [GyrOSC example receiver](https://www.bitshapesoftware.com/instruments/gyrosc/data/gyrosc-data-flow.pd),
[GyrOSC sensor fields](https://www.bitshapesoftware.com/instruments/gyrosc/data/full-config/gyrosc-config.csv),
[OSC 1.0](https://opensoundcontrol.stanford.edu/spec-1_0.html).
