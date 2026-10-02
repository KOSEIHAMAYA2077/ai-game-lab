#!/bin/bash
set -euo pipefail
[[ "$#" == 1 && "$1" == /* && ! -e "$1" ]] || { echo 'Use a new absolute output directory.' >&2;exit 2; }
script_dir="$(cd "$(dirname "$0")" && pwd)"
source_dir="$script_dir/../../desktop/glyph-metal-lab-v4/Sources"
mkdir -p "$1"
xcrun --sdk macosx swiftc -O -swift-version 5 -framework AppKit -framework Metal -framework MetalKit -framework CoreText \
  "$source_dir/Matter.swift" "$source_dir/SurfaceReference.swift" "$source_dir/WordSurfaceReference.swift" "$source_dir/CreatureRigReference.swift" "$source_dir/CameraFraming.swift" "$source_dir/Renderer.swift" "$script_dir/density-gpu-main.swift" -o "$1/density-gpu"
"$1/density-gpu" "$source_dir/Glyphs.metal" "$1"
