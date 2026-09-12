#!/usr/bin/env bash
# Optional contributor tool: Qt 6 development libraries, C++ compiler, ffmpeg.
set -euo pipefail
motion_source=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
motion_stage=$(mktemp -d /tmp/motion-cues-demo-XXXXXXXX)
trap 'rm -rf -- "$motion_stage"' EXIT
cp -- "$motion_source/demo/Showcase.qml" "$motion_stage/Showcase.qml"
cp -- "$motion_source/demo/ExampleDesktop.qml" "$motion_stage/ExampleDesktop.qml"
for motion_file in MotionModel.js BubbleFlow.js Bubble.qml BubbleField.qml; do
    cp -- "$motion_source/$motion_file" "$motion_stage/$motion_file"
done
c++ -std=c++17 -O2 -fPIC "$motion_source/demo/render.cpp" -o "$motion_stage/render" $(pkg-config --cflags --libs Qt6Quick Qt6Gui Qt6Qml)
mkdir -p -- "$motion_source/docs/media"
for motion_variant in showcase desktop; do
    mkdir -- "$motion_stage/$motion_variant"
    motion_options=()
    [[ "$motion_variant" != desktop ]] || motion_options=(desktop)
    QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software "$motion_stage/render" "$motion_stage/Showcase.qml" "$motion_stage/$motion_variant" "${motion_options[@]}"
    motion_gif=motion-cues
    [[ "$motion_variant" != desktop ]] || motion_gif=desktop
    ffmpeg -hide_banner -loglevel warning -y -framerate 30 -i "$motion_stage/$motion_variant/%04d.png" \
        -filter_complex '[0:v]fps=20,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3' \
        -loop 0 "$motion_source/docs/media/$motion_gif.gif"
    cp -- "$motion_stage/$motion_variant/0130.png" "$motion_source/docs/media/$motion_variant.png"
done
printf 'Created showcase and example desktop media in docs/media/\n'
