#!/bin/bash
set -euo pipefail

usage() {
  echo 'Usage: build.sh --web-dir /absolute/built-dist --output "/absolute/new/Glyph Matter Widget.app" [--app-version 0.14.1] [--build-number 2] [--bundle-id dev.glyphmatter.companion.widget-v2] [--source-commit 40-hex-sha]'
}

web_dir=''
app_output=''
app_version=''
build_number=''
bundle_id=''
source_commit=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-dir) [[ $# -ge 2 ]] || { usage; exit 2; }; web_dir="$2"; shift 2 ;;
    --output) [[ $# -ge 2 ]] || { usage; exit 2; }; app_output="$2"; shift 2 ;;
    --app-version) [[ $# -ge 2 ]] || { usage; exit 2; }; app_version="$2"; shift 2 ;;
    --build-number) [[ $# -ge 2 ]] || { usage; exit 2; }; build_number="$2"; shift 2 ;;
    --bundle-id) [[ $# -ge 2 ]] || { usage; exit 2; }; bundle_id="$2"; shift 2 ;;
    --source-commit) [[ $# -ge 2 ]] || { usage; exit 2; }; source_commit="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done
[[ "$web_dir" == /* && "$app_output" == /*.app ]] || { usage; exit 2; }
[[ -z "$app_version" || "$app_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { usage; exit 2; }
[[ -z "$build_number" || "$build_number" =~ ^[0-9]+$ ]] || { usage; exit 2; }
[[ -z "$bundle_id" || "$bundle_id" =~ ^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$ ]] || { usage; exit 2; }
[[ -z "$source_commit" || "$source_commit" =~ ^[0-9a-f]{40}$ ]] || { usage; exit 2; }
[[ -f "$web_dir/widget.html" ]] || { echo 'The Web build must contain widget.html.' >&2; exit 2; }
[[ ! -e "$app_output" ]] || { echo 'Output already exists. Choose a new output path; existing apps are never replaced.' >&2; exit 2; }

script_dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$app_output/Contents/MacOS" "$app_output/Contents/Resources/web"
/usr/bin/ditto "$web_dir" "$app_output/Contents/Resources/web"
/usr/bin/ditto "$script_dir/licenses" "$app_output/Contents/Resources/ThirdPartyLicenses"
/usr/bin/ditto "$script_dir/Info.plist" "$app_output/Contents/Info.plist"
[[ -z "$app_version" ]] || /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $app_version" "$app_output/Contents/Info.plist"
[[ -z "$build_number" ]] || /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $build_number" "$app_output/Contents/Info.plist"
[[ -z "$bundle_id" ]] || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $bundle_id" "$app_output/Contents/Info.plist"
/usr/bin/plutil -lint "$app_output/Contents/Info.plist"
/usr/bin/xcrun --sdk macosx swiftc -O -swift-version 5 \
  -target "$(uname -m)-apple-macos13.0" \
  -framework AppKit -framework WebKit -framework Network \
  "$script_dir/Sources/LoopbackServer.swift" "$script_dir/Sources/main.swift" \
  -o "$app_output/Contents/MacOS/GlyphMatterWidget"
/usr/bin/python3 - "$app_output" "$script_dir" "$source_commit" <<'PY'
import hashlib, json, pathlib, plistlib, sys
app, source = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
web = app / 'Contents/Resources/web'
manifest = {
    'sourceCommit': sys.argv[3] or None,
    'appVersion': info['CFBundleShortVersionString'],
    'buildNumber': info['CFBundleVersion'],
    'bundleIdentifier': info['CFBundleIdentifier'],
    'nativeSourceSha256': {str(p.relative_to(source)): digest(p) for p in sorted((source / 'Sources').glob('*.swift'))},
    'webSha256': {str(p.relative_to(web)): digest(p) for p in sorted(web.rglob('*')) if p.is_file()},
    'executableSha256BeforeSigning': digest(app / 'Contents/MacOS/GlyphMatterWidget'),
}
(app / 'Contents/Resources/BuildInfo.json').write_text(json.dumps(manifest, indent=2) + '\n')
PY
/usr/bin/codesign --force --sign - "$app_output"
/usr/bin/codesign --verify --strict "$app_output"
echo "Created: $app_output"
echo 'This is an ad-hoc signed local prototype, not a notarized distribution.'
