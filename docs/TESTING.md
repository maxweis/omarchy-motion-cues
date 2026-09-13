# Testing and release checks

## Fast checks

Development dependencies: Node.js 20+, Python 3, Bash, jq, Git and tar. No `npm install`
is necessary; the project has no npm dependencies.

```sh
npm run check
npm run release
```

Unit tests cover validation, directions, stale timestamps, density, reflections,
seeded animation, frame-rate independence, CLI actions, setup and installation.
Installer tests use temporary home directories, never the real desktop. They also
cover upgrades from the old flat layout and reject symlinked source subdirectories.
GitHub Actions runs these checks on Linux. A passing CI job does not validate QML
or the compositor; those require the desktop checks below.

## QML and HTTP integration

Run from a graphical Linux session with Quickshell and Wayland available:

```sh
npm run test:integration
npm run test:gyrosc
npm run test:inactivity
```

This starts a separate Quickshell instance with isolated settings, unique IPC
configuration, simulated local HTTP endpoints and a notification recorder. The
source snapshot preserves the `src/` layout. The real phone and installed plugin
settings are not modified. Temporary diagnostics
remain outside the source directory and their locations are printed at the end.

The suite exercises live/paused/stale/malformed/HTTP-error/timeout responses,
session resets, settings changes, endpoint replacement, notification suppression,
bounded polling and complete shutdown. It also checks blank/malformed settings,
late replies, recovery and reduced timer wakeups during failures.

The GyrOSC suite sends real UDP datagrams to a separate Python/QML receiver with
ephemeral ports. It verifies normalization, rate limiting, automatic selection,
two-way failover, explicit providers, missing URL, invalid configuration, port
changes/conflicts/recovery and socket release on unload/exit. The fast checks
include Python unit tests for malformed OSC, bundles, bounds and sender pinning.
No physical phone is simulated as a verified locked-screen test: test that manually.

The inactivity suite uses a shortened deadline in an isolated harness. It checks
initial connection failure, stationary feeds, recovery, stale/malformed data,
configuration changes and socket/request cleanup. Test shutdown commands target
only the harness, never the installed plugin. The production deadline is five minutes.

## Visible checks

Open `omarchy-motion-cues setup` and switch through Overview, phyphox setup,
and GyrOSC setup. Verify wrapping and scrolling at a narrow tiled window size,
and that the GyrOSC tab shows current laptop addresses, port and firewall guidance.
Closing the guide must not change settings or enable the plugin. GTK 4 and
system Python GObject are required for this UI check, not for the headless tests.

```sh
npm run test:render
```

This deliberately displays test bubbles on the desktop. If the installed plugin
is enabled, disable it from its menu first to avoid two overlapping fields, then
restore its prior state after the test. The test never changes that state for you.

Check movement, fades, reversals, size variation, clear center and a stopped frame
loop at rest. The suite inspects actual delegates and Wayland protocol messages
to confirm the empty input region and no keyboard capture. Optionally set
`MOTION_CUES_TEST_CAPTURE_DIR` to capture screenshots. Captures may contain private
desktop content: keep them out of issues and releases unless sanitized.

## Before a release

To check demo generation without overwriting published media, pass a temporary
output directory: `npm run demo -- /tmp/motion-cues-preview`. This renders fictional
windows and a passenger-seat car scene offscreen, not a capture of the current
desktop. Add `showcase` as the second argument to render only the car GIF.
Inspect each phase: the phone readings and bubble direction must agree with the
caption, scenery must continue moving at steady speed, and the wireless data
path must stay active when stopped. Fast tests check the shared driving sequence
against the runtime motion model. Public GIFs must remain below 5 MiB each.

1. Run fast and graphical checks. Test fresh install, update and removal.
2. Run `omarchy plugin validate .` on a supported Omarchy desktop.
3. Check version agreement in manifest, package metadata and service status.
4. Inspect the allowlisted archive from `npm run release` before sharing it.
5. Install locally; inspect the menu, guide, live feed and lifecycle. If the
   running version stays old after rescan, restart the shell and check again.
6. Test a physical phone, including disconnect/reconnect. Android and multiple
   physical monitors need explicit verification; simulated coverage is not enough.

Do not attach raw status output without reviewing it: it includes the private
phone address and the most recent sensor sample. Never commit local backups,
settings, desktop screenshots or packet captures.
