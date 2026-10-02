#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
[[ "$#" == 1 && "$1" == /* ]] || { echo 'Usage: gpu-test.sh /absolute/ignored/new-output-directory' >&2; exit 2; }
test_directory="$1"
[[ ! -e "$test_directory" ]] || { echo 'Output exists; choose a new path.' >&2; exit 2; }
mkdir -p "$test_directory"
xcrun --sdk macosx swiftc -O -swift-version 5 -framework AppKit -framework Metal -framework MetalKit -framework CoreText \
  "$script_dir/Sources/Matter.swift" "$script_dir/Sources/SurfaceReference.swift" "$script_dir/Sources/CameraFraming.swift" "$script_dir/Sources/Renderer.swift" "$script_dir/Tests/GPU.swift" "$script_dir/Tests/gpu-main.swift" -o "$test_directory/gpu-tests"
"$test_directory/gpu-tests" "$script_dir/Sources/Glyphs.metal" "$test_directory" | tee "$test_directory/gpu-report.json"
