#!/bin/bash
set -euo pipefail
if [[ "$#" != 2 || "$1" != '--output' || "$2" != /*.app ]]; then
  echo 'Usage: build.sh --output /absolute/new/Glyph-Matter-Metal-Lab.app' >&2
  exit 2
fi
app_output="$2"
[[ ! -e "$app_output" ]] || { echo 'Output exists; choose a new path. Previous apps are never replaced.' >&2; exit 2; }
script_dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$app_output/Contents/MacOS" "$app_output/Contents/Resources"
/usr/bin/ditto --noextattr --norsrc "$script_dir/Info.plist" "$app_output/Contents/Info.plist"
/usr/bin/ditto --noextattr --norsrc "$script_dir/Sources/Glyphs.metal" "$app_output/Contents/Resources/Glyphs.metal"
/usr/bin/plutil -lint "$app_output/Contents/Info.plist"
/usr/bin/xcrun --sdk macosx swiftc -O -swift-version 5 -target "$(uname -m)-apple-macos13.0" \
  -framework AppKit -framework Metal -framework MetalKit -framework CoreText \
  "$script_dir/Sources/Matter.swift" "$script_dir/Sources/SurfaceReference.swift" "$script_dir/Sources/WordSurfaceReference.swift" "$script_dir/Sources/CameraFraming.swift" "$script_dir/Sources/Renderer.swift" "$script_dir/Sources/main.swift" \
  -o "$app_output/Contents/MacOS/GlyphMatterMetalLab"
python3 - "$script_dir" "$app_output" <<'PYMETA'
import hashlib, json, pathlib, platform, sys
source = pathlib.Path(sys.argv[1])
app = pathlib.Path(sys.argv[2])
files = sorted(source.glob("Sources/*")) + [source / "Info.plist"]
record = {"version": "0.3.0", "comparison": "metal-lab-v3", "architecture": platform.machine(), "surface_count": 13, "authored_word_surface_count": 10, "shapes": ["sphere", "cube", "mobius", "sword", "vase", "jellyfish", "flower", "butterfly", "tree", "star", "helix", "hourglass", "saturn"], "source_sha256": {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
(app / "Contents/Resources/BuildInfo.json").write_text(json.dumps(record, sort_keys=True, indent=2))
PYMETA
/usr/bin/codesign --force --sign - "$app_output"
/usr/bin/codesign --verify --strict "$app_output"
echo "Created: $app_output"
echo 'Independent authored-surface comparison; ad-hoc signed, not notarized.'
