# Motion Cues for Omarchy

Click-through bubbles around the screen edges, driven by motion data from a
phone running **phyphox** or **GyrOSC**, with automatic feed detection.
Twelve base bubbles flow with acceleration and turns;
up to twenty extras appear during stronger motion. The center stays clear.

![Motion Cues running over an example desktop](docs/media/desktop.gif)

*Actual bubble renderer over an illustrative desktop, with simulated motion.
[View the showcase and focused demo](docs/SHOWCASE.md).*

This is an experimental visual aid, not a medically validated treatment or a
copy of Apple's implementation. Use only as a passenger. Stop if it feels worse.

## Requirements

- Linux with Omarchy's Quickshell plugin system and a Wayland compositor supporting
  layer-shell. Legacy Waybar-only Omarchy installations are not supported.
- Quickshell with `FrameAnimation`, `Quickshell.Io` and `Quickshell.Wayland` support.
- Bash, jq and `notify-send` (libnotify). The tabbed Setup window also needs GTK 4
  and system Python GObject (`omarchy pkg add python-gobject gtk4` if missing).
- Python 3 for installation and the GyrOSC receiver. Node.js 20+ is only needed for development/tests.
- A phone running free [phyphox](https://phyphox.org/download/) (iPhone/Android)
  or [GyrOSC](https://apps.apple.com/us/app/gyrosc/id418751595) (iPhone),
  connected through trusted private Wi-Fi or a password-protected hotspot.

No cloud service, account, cable or npm runtime dependencies are required.

## Install or update

Review the source, then install through Omarchy's plugin manager:

```sh
omarchy plugin add https://github.com/maxweis/omarchy-motion-cues.git
python3 "$HOME/.config/omarchy/plugins/max.motion-cues/scripts/install.py"
```

The second command installs the menu and launcher; Omarchy's plugin manager
does not run installation hooks. Open **Omarchy > Motion Cues > Setup**, configure
the phone, then choose **Enable**. The plugin ID is `max.motion-cues`.

This installs `max.motion-cues` under `~/.config/omarchy/plugins`, its launcher
under `~/.local/bin`, and adds **Motion Cues** to the existing Omarchy menu.
It preserves your saved settings and enabled state. A fresh install is disabled.
Existing plugin files, launcher and menu are backed up under
`${XDG_STATE_HOME:-~/.local/state}/motion-cues/backups/` before replacement.
No system files are changed and no packages are installed automatically.

For later updates:

```sh
omarchy plugin update max.motion-cues
python3 "$HOME/.config/omarchy/plugins/max.motion-cues/scripts/install.py"
```

Alternatively, download a [release archive](https://github.com/maxweis/omarchy-motion-cues/releases),
extract it, and run `python3 scripts/install.py` from that directory. Archive
installs are not Git-managed; update by installing a newer archive the same way.

If an update leaves the service unavailable or showing an older version in `omarchy-motion-cues status`, run
`omarchy restart shell`. This briefly reloads the bar and overlays, not your apps.

## Set up the phone

**GyrOSC is recommended for iPhone because it offers a background mode.**
In GyrOSC's settings, enable **run in background** and select **30 Hz**
(30 updates per second, not 30 kHz). Test streaming with another app open and
with the screen locked; background reliability can vary by device and iOS version.
The developer documents both background operation and configurable update rates.
[GyrOSC release notes](https://apps.apple.com/us/app/gyrosc/id418751595),
[update-rate documentation](https://www.bitshapesoftware.com/instruments/gyrosc/).
phyphox remains the free iPhone/Android option, but must stay open in this setup.

Open **Omarchy > Motion Cues > Setup** for the local, read-only guide.
The guide has **Overview**, **phyphox setup**, and **GyrOSC setup** tabs.
Overview explains which app to use, automatic detection, and phone positioning.
GyrOSC setup shows the laptop's current network addresses, UDP port, and required
firewall instructions. Reopen Setup after changing networks to refresh addresses.

### GyrOSC

1. Connect the phone and laptop to the same trusted Wi-Fi or hotspot.
2. Enter the laptop's Wi-Fi/hotspot IP as the destination in GyrOSC. Set its
   destination port to **9999** (UDP), matching the GyrOSC tab's destination details.
3. Allow motion and local-network permissions. Enable acceleration sending,
   keep the default **gyrosc** message tag and unscaled `/gyrosc/accel` messages.
   Custom CSV message mappings are not supported. In GyrOSC settings, select
   **30 Hz** (30 updates per second). A 1 Hz feed is slower than the plugin's
   0.9-second freshness timeout and will not establish a stable connection.
4. **Allow the incoming UDP feed through your laptop firewall.** With Omarchy's
   incoming-blocking UFW configuration this is required, not optional. Restrict
   the rule to the phone IP, laptop IP, Wi-Fi interface and chosen UDP port.
   Setup contains an example UFW command. Administrator approval is required;
   installing/enabling the plugin does not add rules or disable the firewall.
5. Choose **Enable** on the laptop. **Connection status** identifies `gyrosc`.
   Set **Phone position** as described below; no phone HTTP address is needed.
6. In GyrOSC settings, enable **run in background**. Try other apps
   and locking the phone, then test for several minutes. Physical locked-screen
   streaming has not been verified for this integration. Missing data hides cues.

If port 9999 is occupied, configure a different unprivileged UDP port on both
ends: `omarchy-motion-cues configure '{"gyroscPort":10000}'` (while enabled).
The plugin does not change firewall rules. Update your dedicated rule if the
phone/laptop IP, network interface or UDP port changes. The rule persists across
reboots and must be removed separately when no longer needed. Use only a trusted local network.
See [official GyrOSC setup](https://www.bitshapesoftware.com/instruments/gyrosc/).

### phyphox

1. Connect the laptop and phone to the same trusted network or phone hotspot.
2. Open **Acceleration (without g)** in phyphox and press **Play**.
3. In the experiment menu, enable **Allow remote access**. Accept the relevant
   permission prompts. Note the HTTP address, including any port.
4. On the laptop, choose **Motion Cues > Phone address…** and enter that address,
   for example `http://192.168.1.100:8080`.
5. Choose **Enable**, then select the matching **Phone position**:
   - Flat: screen up, top edge pointing forward.
   - Upright: top edge up, screen facing a forward-facing passenger.

There is no assumed phyphox phone address and no platform selector. The saved endpoint
must be a private IPv4 or loopback HTTP address, optionally with a port. Public
IPs, hostnames, credentials, HTTPS and URL paths are rejected. The address can
change when switching networks. See [phyphox remote access](https://phyphox.org/remote-control/).

Secure the phone so it moves with the vehicle. Keep phyphox open, measuring and
the phone unlocked for this provider.

### Automatic detection

Existing and new configurations default to `provider: "auto"`. Auto listens for
GyrOSC and polls phyphox only if a phone address is saved. The first advancing
feed wins and remains selected while healthy. When it stops, cues hide within
900 ms and detection resumes. Feeds are never mixed. HTTP polling pauses while
GyrOSC is selected. Use **Motion app** to force either provider if desired.

Detection recognizes the incoming protocol, not the phone OS. It cannot discover
or configure the destination inside GyrOSC, and does not scan the network for
phyphox addresses. Any compatible OSC sender can identify as GyrOSC.

## Controls

- **Enable / Disable:** explicit and idempotent. Disabling removes all overlays
  and stops all phone requests and the UDP receiver. Enabled state survives shell restarts.
- **Connection status / Reconnect:** inspect or restart the connection. Status
  shows the laptop destination IP and UDP port to enter in GyrOSC, even while
  disabled. The addresses refresh each time Status or Setup is opened.
- **Phone address…:** works while disabled; saving does not enable the plugin.
- **Motion app:** Auto-detect (default), phyphox only, or GyrOSC only.
- **GyrOSC port…:** change the laptop UDP port, then match it in GyrOSC.
- **Phone position:** Flat or Upright.
- **Sensitivity:** Gentle (0.5), Normal (1) or Strong (1.6).
- **Bubble size:** Small (12), Medium (18), Large (26 logical pixels, default).

Bubble size varies between 82% and 118% of the selected size. Motion, speed and
fade variation are smooth, bounded and seeded, not frame-to-frame jitter.

```sh
omarchy-motion-cues setup
omarchy-motion-cues destination
omarchy-motion-cues endpoint 192.168.1.100:8080
omarchy-motion-cues enable
omarchy-motion-cues status
omarchy-motion-cues configure '{"mount":"upright","sensitivity":0.5}'
omarchy-motion-cues disable
```

`configure` requires the service to be enabled. Settings live in
`${XDG_CONFIG_HOME:-~/.config}/omarchy/motion-cues.json`. The installed Omarchy
menu and plugin discovery still use `~/.config`, following Omarchy itself.

## Privacy, reliability and limitations

Motion Cues reads phyphox's acceleration endpoint or receives GyrOSC acceleration.
It never starts, stops, clears or exports the phone experiment and does not retain a sensor history.
Live status includes the private endpoint and latest sample; review before sharing.
phyphox remote access is reachable by other devices on the same network. Do not
expose it to the internet or use an untrusted network.
The GyrOSC listener binds IPv4 UDP on the configured port only while enabled in
Auto/GyrOSC mode. It accepts RFC1918/loopback sources and pins one sender while
active, but OSC is unauthenticated: another local device can inject motion.

Only advancing timestamps establish a live feed. GyrOSC's default messages have
no sensor timestamp, so their monotonic arrival times are used instead. This
cannot detect replayed datagrams or a sender repeating old readings.
Paused, stale or invalid data
hides the bubbles; recovery is automatic. Connecting/connected/disconnected
toasts appear only on transitions and respect normal notification/DND settings.

Rendering uses a fixed 32-bubble pool, no blur, no per-frame processes, and no
animation loop at rest. Polling is capped around 20 Hz with one request at a time.
One-shot deadlines avoid frequent timer wakeups during connection failures.
The Python receiver blocks while idle and forwards at most 20 samples per second.
It rejects malformed/oversized packets and handles bounded OSC bundles. Default
GyrOSC acceleration excludes gravity and is converted from g to m/s².
There are no whole-system battery-savings claims.

The current phone mount must be set manually. No independent gyroscope/orientation
correction is performed. Physical testing has covered one iPhone and one monitor;
Android and multiple-monitor layouts still need real-device validation.

## Remove

From the source checkout:

```sh
python3 scripts/install.py --uninstall
```

This disables the plugin, backs up and removes its directory and launcher, and
removes its menu entries. Your sensor settings remain. Removal refuses customized
menu rows instead of silently deleting your edits. Backups can be restored manually.
`--no-reload` is available for offline staging/tests; it does not stop a running
plugin and should not be used for normal removal.

## Development

```sh
npm run check
npm run test:integration
npm run test:gyrosc
# Optional: displays simulated bubbles on the desktop.
npm run test:render
npm run release
```

No `npm install` is required. See [contributing](CONTRIBUTING.md),
[architecture](docs/ARCHITECTURE.md), [test procedures](docs/TESTING.md) and
[changelog](CHANGELOG.md). Release archives use an explicit file list to exclude
personal backups, settings and desktop captures. Licensed under [MIT](LICENSE).
