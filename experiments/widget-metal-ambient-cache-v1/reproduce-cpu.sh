#!/bin/bash
set -euo pipefail
[[ "$#" == 2 ]] || { echo 'Usage: reproduce-cpu.sh baseline-Receiver.js new-owned-output-directory' >&2; exit 2; }
cache_script_dir="$(cd "$(dirname "$0")" && pwd)"
cache_repo_dir="$(cd "$cache_script_dir/../.." && pwd)"
cd "$cache_repo_dir"
cache_baseline="$1"
cache_out="$2"
[[ "$cache_out" == experiments/widget-metal-ambient-cache-v1/work/* && ! -e "$cache_out" ]] || { echo 'New owned work directory required' >&2; exit 2; }
[[ -f "$cache_baseline" && -f experiments/widget-metal-ambient-cache-v1/work/bundle-r1/Receiver.js ]] || { echo 'Both fixed bundles required' >&2; exit 2; }
mkdir -p "$cache_out"
node experiments/widget-metal-ambient-cache-v1/replay-core.mjs experiments/widget-metal-ambient-cache-v1/fixtures/core3-r1.json "$cache_out/core3.json"
cache_sources=(desktop/glyph-metal-ambient-cache-v1/Sources/GeometryTypes.swift desktop/glyph-metal-ambient-cache-v1/Sources/SurfaceReference.swift desktop/glyph-metal-ambient-cache-v1/Sources/WordSurfaceReference.swift desktop/glyph-metal-ambient-cache-v1/Sources/CreatureRigReference.swift desktop/glyph-metal-ambient-cache-v1/Sources/CameraFraming.swift desktop/glyph-metal-ambient-cache-v1/Sources/Projection.swift desktop/glyph-metal-ambient-cache-v1/Sources/ReceiverBridge.swift desktop/glyph-metal-ambient-cache-v1/Tests/BaselineBridge.swift desktop/glyph-metal-ambient-cache-v1/Tests/BaselineProjection.swift desktop/glyph-metal-ambient-cache-v1/Tests/BaselineInstances.swift)
xcrun swiftc -O -swift-version 5 -target arm64-apple-macos26.0 -module-cache-path "$cache_out/module-cache" -framework JavaScriptCore "${cache_sources[@]}" desktop/glyph-metal-ambient-cache-v1/Tests/main.swift -o "$cache_out/cache-cpu"
"$cache_out/cache-cpu" "$cache_baseline" experiments/widget-metal-ambient-cache-v1/work/bundle-r1/Receiver.js experiments/widget-metal-ambient-cache-v1/fixtures/native14-r1.json "$cache_out/core3.json" experiments/widget-metal-ambient-cache-v1/fixtures/invalid8-r1.json "$cache_out/results-native"
