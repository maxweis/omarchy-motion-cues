# Motion Cues for Omarchy

Using a laptop as a passenger in a car can cause motion sickness when your eyes
see a still screen but your inner ear senses movement. Moving cues around the
screen edges may help by reducing that mismatch.
[How motion cues work](https://www.apple.com/newsroom/2024/05/apple-announces-new-accessibility-features-including-eye-tracking/).

This plugin brings phone-driven motion bubbles to **Omarchy, a Linux
distribution**, while leaving your work visible and clickable. It is experimental,
not a medically validated treatment. For passengers only; stop if it feels worse.

![Motion Cues running over an example desktop](docs/media/desktop.gif)

*Example desktop with simulated motion. [View the showcase](docs/SHOWCASE.md).*

## Install or update

Requires Omarchy with Quickshell plugin support.

```sh
omarchy plugin add https://github.com/maxweis/omarchy-motion-cues.git
python3 "$HOME/.config/omarchy/plugins/max.motion-cues/scripts/install.py"
```

The second command adds the launcher and **Motion Cues** menu. To update later:

```sh
omarchy plugin update max.motion-cues
python3 "$HOME/.config/omarchy/plugins/max.motion-cues/scripts/install.py"
```

## Setup

1. Connect your phone and laptop to the same trusted Wi-Fi or private hotspot.
2. Open **Omarchy > Motion Cues > Setup** and follow the tab for your phone app:
   - **[GyrOSC](https://apps.apple.com/us/app/gyrosc/id418751595)** is recommended
     for iPhone because it supports background mode. Enable **run in background**
     and select **30 Hz** in its settings. Setup shows the laptop destination
     address and required firewall instructions. Keep the firewall enabled.
     Test with the phone locked; background reliability can vary.
   - **[phyphox](https://phyphox.org/download/)** is the free iPhone/Android option.
     Start **Acceleration (without g)**, enable **Allow remote access**, and enter
     its address under **Motion Cues > Phone address…**. Keep the app open and
     the phone unlocked.
3. Secure the phone, select the matching **Phone position**, then choose
   **Enable**. Adjust bubble size and sensitivity from the same menu.

If Setup cannot open, install its dependencies with
`omarchy pkg add python-gobject gtk4`. Use **Connection status** to check the feed
or **Disable** to turn the cues off.

Licensed under the [University of Illinois/NCSA Open Source License](LICENSE).
