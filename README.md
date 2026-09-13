# Motion Cues for Omarchy

Using a laptop as a passenger in a car can cause motion sickness when your eyes
see a still screen but your inner ear senses movement. Moving cues around the
screen edges may help by reducing that mismatch.
[How motion cues work](https://www.apple.com/newsroom/2024/05/apple-announces-new-accessibility-features-including-eye-tracking/).

This plugin brings motion bubbles to **Omarchy, a Linux distribution**, while
leaving your work visible and clickable. The bubbles are driven by **a connected
phone's accelerometer**, with motion data sent wirelessly to the laptop. Most
laptops do not have a built-in accelerometer, so a phone supplies the motion
readings.

It is experimental, not a medically validated treatment. For passengers only;
stop if it feels worse.

![Motion cues on a passenger's laptop, with synchronized steering, scenery, and wireless phone readings.](https://raw.githubusercontent.com/maxweis/omarchy-motion-cues/main/docs/media/alternatives/motion-cues-realistic.gif)

*AI-generated passenger view with simulated motion. The phone sends acceleration
wirelessly to the laptop. [View the showcase](docs/SHOWCASE.md).*

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

After five minutes without fresh motion data, the plugin disables itself.
Choose **Enable** to reconnect. A stationary phone still counts while sending data.

Licensed under the [University of Illinois/NCSA Open Source License](LICENSE).
