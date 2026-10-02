#!/bin/bash
set -euo pipefail

usage() {
  echo 'Usage: build.sh --web-dir /absolute/built-dist --output "/absolute/new/Glyph Matter Widget.app"'
}

web_dir=''
app_output=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-dir) [[ $# -ge 2 ]] || { usage; exit 2; }; web_dir="$2"; shift 2 ;;
    --output) [[ $# -ge 2 ]] || { usage; exit 2; }; app_output="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done
[[ "$web_dir" == /* && "$app_output" == /*.app ]] || { usage; exit 2; }
[[ -f "$web_dir/widget.html" ]] || { echo 'The Web build must contain widget.html.' >&2; exit 2; }
[[ ! -e "$app_output" ]] || { echo 'Output already exists. Choose a new output path; existing apps are never replaced.' >&2; exit 2; }

script_dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$app_output/Contents/MacOS" "$app_output/Contents/Resources/web"
/usr/bin/ditto "$web_dir" "$app_output/Contents/Resources/web"
/usr/bin/ditto "$script_dir/licenses" "$app_output/Contents/Resources/ThirdPartyLicenses"
/usr/bin/ditto "$script_dir/Info.plist" "$app_output/Contents/Info.plist"
/usr/bin/plutil -lint "$app_output/Contents/Info.plist"
/usr/bin/xcrun --sdk macosx swiftc -O -swift-version 5 \
  -target "$(uname -m)-apple-macos13.0" \
  -framework AppKit -framework WebKit -framework Network \
  "$script_dir/Sources/LoopbackServer.swift" "$script_dir/Sources/main.swift" \
  -o "$app_output/Contents/MacOS/GlyphMatterWidget"
/usr/bin/codesign --force --sign - "$app_output"
/usr/bin/codesign --verify --strict "$app_output"
echo "Created: $app_output"
echo 'This is an ad-hoc signed local prototype, not a notarized distribution.'
