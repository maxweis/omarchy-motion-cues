#!/usr/bin/env bash
# Optional contributor tool: Qt 6 development libraries, C++ compiler, ffmpeg.
set -euo pipefail
motion_source=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
[[ $# -le 2 ]] || { echo 'Usage: render-demo.sh [output-directory] [showcase|desktop|all]' >&2; exit 2; }
motion_output=${1:-"$motion_source/docs/media"}
case "${2:-all}" in
    all) motion_variants=(showcase desktop) ;;
    showcase|desktop) motion_variants=("$2") ;;
    *) echo 'Variant must be showcase, desktop, or all' >&2; exit 2 ;;
esac
motion_stage=$(mktemp -d /tmp/motion-cues-demo-XXXXXXXX)
trap 'rm -rf -- "$motion_stage"' EXIT
mkdir -- "$motion_stage/demo" "$motion_stage/src"
cp -- "$motion_source/demo/Showcase.qml" "$motion_stage/demo/Showcase.qml"
cp -- "$motion_source/demo/ExampleDesktop.qml" "$motion_stage/demo/ExampleDesktop.qml"
cp -- "$motion_source/demo/CarShowcase.qml" "$motion_stage/demo/CarShowcase.qml"
cp -- "$motion_source/demo/DriveSequence.js" "$motion_stage/demo/DriveSequence.js"
for motion_file in MotionModel.js BubbleFlow.js Bubble.qml BubbleField.qml; do
    cp -- "$motion_source/src/$motion_file" "$motion_stage/src/$motion_file"
done
c++ -std=c++17 -O2 -fPIC "$motion_source/demo/render.cpp" -o "$motion_stage/render" $(pkg-config --cflags --libs Qt6Quick Qt6Gui Qt6Qml)
mkdir -p -- "$motion_output"
for motion_variant in "${motion_variants[@]}"; do
    mkdir -- "$motion_stage/$motion_variant"
    motion_options=()
    motion_scene=CarShowcase.qml
    motion_still=0255.png
    if [[ "$motion_variant" == desktop ]]; then
        motion_options=(desktop)
        motion_scene=Showcase.qml
        motion_still=0130.png
    fi
    QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software "$motion_stage/render" "$motion_stage/demo/$motion_scene" "$motion_stage/$motion_variant" "${motion_options[@]}"
    motion_gif=motion-cues
    [[ "$motion_variant" != desktop ]] || motion_gif=desktop
    motion_palette=256
    motion_fps=20
    if [[ "$motion_variant" == showcase ]]; then
        motion_palette=128
        motion_fps=18
    fi
    motion_encoded="$motion_stage/$motion_gif.gif"
    ffmpeg -hide_banner -loglevel warning -y -framerate 30 -i "$motion_stage/$motion_variant/%04d.png" \
        -filter_complex "[0:v]fps=$motion_fps,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=$motion_palette[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
        -loop 0 "$motion_encoded"
    motion_bytes=$(wc -c < "$motion_encoded")
    [[ "$motion_bytes" -le 5242880 ]] || { echo "Demo exceeds the 5 MiB public media limit: $motion_gif.gif" >&2; exit 1; }
    cp -- "$motion_encoded" "$motion_output/$motion_gif.gif"
    cp -- "$motion_stage/$motion_variant/$motion_still" "$motion_output/$motion_variant.png"
done
printf 'Created %s media in %s\n' "${motion_variants[*]}" "$motion_output"
