# Contributing

Read [architecture](../docs/ARCHITECTURE.md) and [testing](../docs/TESTING.md) first.
Keep changes focused and add a regression test for each fixed bug.

- Preserve explicit, idempotent enable/disable and complete unload cleanup.
- Keep the center clear and the overlay click-through and keyboard-free.
- Keep normalization separate from the motion model and animation.
- Do not add per-frame random noise or unbounded particle pools.
- Keep endpoint validators in `src/Settings.js` and `src/Endpoint.jq` in agreement.
- Use private-network fixtures; never require contributors' phones for unit tests.
- Preserve settings and unrelated menu entries during installation and upgrades.
- Avoid new runtime dependencies unless the benefit justifies them.
- Document changes in `docs/CHANGELOG.md` and keep all version fields synchronized.

Use the surrounding formatting, UTF-8, LF line endings and a final newline. Do
not reformat unrelated files. Runtime JavaScript must work in both Qt's engine
and the supported Node test environment.

For bug reports, include Omarchy, Quickshell and phone-app versions, the failing
operation, expected behavior, and sanitized logs. State whether it reproduces
with the test harness, a real phone, or both. Do not post private IP addresses,
sensor histories, secrets, or unsanitized desktop screenshots.

This is an experimental visual aid. Do not describe an animation change as a
medical benefit without appropriate evidence. Do not use it while driving.
