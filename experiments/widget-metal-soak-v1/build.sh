#!/bin/bash
set -euo pipefail
[[ "$#" == 1 && "$1" == /* ]] || { echo 'Usage: build.sh /absolute/new-helper-directory' >&2; exit 2; }
helper_directory="$1"
[[ ! -e "$helper_directory" ]] || { echo 'Output exists; use a new directory.' >&2; exit 2; }
script_dir="$(cd "$(dirname "$0")" && pwd)"
repository_dir="$(cd "$script_dir/../.." && pwd)"
mkdir -p "$helper_directory"
python3 - "$repository_dir" "$helper_directory" <<'PYHASH'
import hashlib,json,pathlib,sys
repository=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
expected=json.loads((repository/'experiments/widget-metal-lab-v1/evaluation/artifact-manifest.json').read_text())['source']['source_sha256']
root=repository/'desktop/glyph-metal-lab-v1'
for rel,sha in expected.items():
    if hashlib.sha256((root/rel).read_bytes()).hexdigest()!=sha:
        raise SystemExit(f'Frozen R5 source differs: {rel}')
(out/'frozen-source-manifest.json').write_text(json.dumps(expected,indent=2,sort_keys=True))
PYHASH
xcrun --sdk macosx swiftc -O -swift-version 5 -framework AppKit -framework Metal -framework MetalKit -framework CoreText -framework CryptoKit \
  "$repository_dir/desktop/glyph-metal-lab-v1/Sources/Matter.swift" \
  "$repository_dir/desktop/glyph-metal-lab-v1/Sources/SurfaceReference.swift" \
  "$repository_dir/desktop/glyph-metal-lab-v1/Sources/Renderer.swift" \
  "$script_dir/Sources/main.swift" -o "$helper_directory/soak"
xcrun --sdk macosx clang -O2 "$repository_dir/experiments/widget-companion-v1/evaluation/native_metrics.c" -o "$helper_directory/native-metrics"
echo "Created isolated helpers: $helper_directory"
