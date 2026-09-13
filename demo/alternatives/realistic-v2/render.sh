#!/usr/bin/env bash
# Render the realistic README animation without replacing the illustrated demos.
set -euo pipefail
motion_variant_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
motion_repo=$(cd -- "$motion_variant_dir/../../.." && pwd)
motion_output="$motion_repo/docs/media/alternatives"
motion_stage=$(mktemp -d /tmp/motion-cues-realistic-XXXXXXXX)
trap 'rm -rf -- "$motion_stage"' EXIT
mkdir -p -- "$motion_output" "$motion_stage/frames"
c++ -std=c++17 -O2 -fPIC "$motion_repo/demo/render.cpp" -o "$motion_stage/render" $(pkg-config --cflags --libs Qt6Quick Qt6Gui Qt6Qml)
QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=software "$motion_stage/render" "$motion_variant_dir/Realistic.qml" "$motion_stage/frames"
ffmpeg -hide_banner -loglevel warning -y -framerate 30 -i "$motion_stage/frames/%04d.png" \
    -filter_complex '[0:v]fps=18,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff:max_colors=256[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle' \
    -loop 0 "$motion_stage/motion-cues-realistic.gif"
ffmpeg -hide_banner -loglevel warning -y -framerate 30 -i "$motion_stage/frames/%04d.png" \
    -vf 'scale=1280:-2' -c:v libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart -an \
    "$motion_stage/motion-cues-realistic.mp4"
cp -- "$motion_stage/motion-cues-realistic.gif" "$motion_output/motion-cues-realistic.gif"
cp -- "$motion_stage/motion-cues-realistic.mp4" "$motion_output/motion-cues-realistic.mp4"
cp -- "$motion_stage/frames/0255.png" "$motion_output/motion-cues-realistic.png"
printf 'Created realistic alternative in %s\n' "$motion_output"
