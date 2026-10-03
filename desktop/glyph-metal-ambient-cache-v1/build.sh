#!/bin/bash
set -euo pipefail
[[ "$#" == 2 && "$1" == '--output' ]] || { echo 'Usage: build.sh --output new/owned/app.app' >&2; exit 2; }
ambient_script_dir="$(cd "$(dirname "$0")" && pwd)"
ambient_repo_dir="$(cd "$ambient_script_dir/../.." && pwd)"
ambient_app_output="$2"
[[ "$ambient_app_output" == /* ]] || ambient_app_output="$PWD/$ambient_app_output"
[[ "$ambient_app_output" == "$ambient_repo_dir/experiments/widget-metal-ambient-cache-v1/work/"*.app && ! -e "$ambient_app_output" ]] || { echo 'New app inside the owned work folder required.' >&2; exit 2; }
ambient_bridge="$ambient_repo_dir/experiments/widget-metal-ambient-cache-v1/work/bundle-r1/Receiver.js"
[[ -f "$ambient_bridge" ]] || { echo 'Build fixed bridge first.' >&2; exit 2; }
mkdir -p "$ambient_app_output/Contents/MacOS" "$ambient_app_output/Contents/Resources"
cp "$ambient_script_dir/Info.plist" "$ambient_app_output/Contents/Info.plist"
cp "$ambient_script_dir/Sources/Glyphs.metal" "$ambient_app_output/Contents/Resources/Glyphs.metal"
cp "$ambient_bridge" "$ambient_app_output/Contents/Resources/Receiver.js"
xcrun swiftc -O -swift-version 5 -target "$(uname -m)-apple-macos26.0" -module-cache-path "$ambient_repo_dir/experiments/widget-metal-ambient-cache-v1/work/module-cache-r1" \
  -framework AppKit -framework Metal -framework MetalKit -framework CoreText -framework JavaScriptCore \
  "$ambient_script_dir/Sources/GeometryTypes.swift" "$ambient_script_dir/Sources/SurfaceReference.swift" "$ambient_script_dir/Sources/WordSurfaceReference.swift" "$ambient_script_dir/Sources/CreatureRigReference.swift" "$ambient_script_dir/Sources/CameraFraming.swift" \
  "$ambient_script_dir/Sources/Projection.swift" "$ambient_script_dir/Sources/ReceiverBridge.swift" "$ambient_script_dir/Sources/OwnEditor.swift" "$ambient_script_dir/Sources/Renderer.swift" "$ambient_script_dir/Sources/AppMain.swift" \
  -o "$ambient_app_output/Contents/MacOS/GlyphMatterAmbientCache"
python3 - "$ambient_script_dir" "$ambient_app_output" <<'PY'
from pathlib import Path
import sys,json,hashlib
src=Path(sys.argv[1]);app=Path(sys.argv[2]);sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows={str(p.relative_to(src)):sha(p) for p in sorted((src/'Sources').iterdir()) if p.is_file()};rows['Info.plist']=sha(src/'Info.plist')
(app/'Contents/Resources/BuildInfo.json').write_text(json.dumps({'version':'0.1.0-cache-r1','namespace':'org.glyphmatter.metalambientcache.v1','sourceSHA256':rows,'bridgeSHA256':sha(app/'Contents/Resources/Receiver.js'),'shaderSHA256':sha(app/'Contents/Resources/Glyphs.metal'),'onlyR3BodyAuthority':True,'languageCandidates':['sphere','box','ring'],'ringToMobiusIsViewOnly':True,'normalRawSaving':False,'actualUIVerified':False,'resourceMeasured':False},indent=2)+'\n')
PY
codesign --force --sign - "$ambient_app_output"
codesign --verify --strict "$ambient_app_output"
echo 'Built new immutable native ambient comparison app.'
