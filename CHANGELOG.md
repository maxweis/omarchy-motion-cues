# Changelog

## 1.7.2

- Preserve executable launcher permissions in Git, so installing the menu from
  a native Omarchy checkout does not leave it modified and interfere with updates.
- Add the illustrative example desktop with the actual bubble renderer.

## 1.7.1

- Prepare the first public GitHub release with native Omarchy installation and
  update instructions, a short rendered demo and a showcase.
- Recommend GyrOSC for iPhone because of background mode. Explicitly require
  enabling run in background and selecting 30 Hz in GyrOSC settings.
- Explain the 1 Hz freshness-timeout limitation; retain the locked-screen
  reliability caveat and phyphox instructions for iPhone/Android.

## 1.7.0

- Split the read-only Setup guide into Overview, phyphox setup and GyrOSC setup
  tabs. Keep live laptop destination details and required firewall guidance together.
- Add GyrOSC OSC/UDP input, normalized to the existing gravity-free motion model.
- Auto-detect the first advancing phyphox/GyrOSC feed, retain it while healthy,
  and retry detection after loss. Preserve saved phone addresses and visual settings.
- Add explicit Motion app choices, configurable UDP port and receiver diagnostics.
- Show laptop addresses and port in Setup, with GyrOSC/background instructions.
- Bound OSC parsing and delivery, pin one private-network sender while live,
  and tie receiver lifetime to the plugin. Add protocol and real UDP/QML tests.

## 1.6.0

- Separate settings validation, phyphox parsing, motion filtering and particle flow.
- Replace repeating network timers with one-shot polling, timeout and stale-data
  deadlines. Preserve the existing live update rate and visual behavior.
- Require a phone address on first use; preserve already configured installations.
- Portable menu actions, strict CLI arguments and settings checks without shell IPC.
- Preserve unknown settings fields and avoid resetting motion on visual changes.
- Add per-user install/remove tooling with backups and scoped JSONC editing.
- Add license, contributor guidance, architecture, test commands, CI and an
  allowlisted release archive. Exclude machine-specific diagnostics and backups.

## 1.5.0

- Independent bubble speeds, smooth curves, varied sizes, fades and entry lanes.
- Local Setup guide available from the menu even while disabled.

## 1.4.0 / 1.4.1

- Continuous peripheral flow, invisible recycling and phone-neutral interface.

## 1.3.0

- Transient connection-state toasts with deduplication and notification replacement.

## 1.2.0

- Configurable private-network phone endpoint and irregular bubble placement.

## 1.1.0

- Extra bubbles during stronger acceleration and motion-driven reflections.

## 1.0.0

- Initial phyphox-driven Omarchy overlay, explicit lifecycle and click-through panels.
