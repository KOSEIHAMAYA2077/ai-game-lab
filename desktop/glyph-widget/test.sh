#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$script_dir/.local"
test_dir="$(mktemp -d "$script_dir/.local/server-check.XXXXXX")"
/usr/bin/xcrun --sdk macosx swiftc -O -swift-version 5 \
  -framework Network \
  "$script_dir/Sources/LoopbackServer.swift" "$script_dir/Tests/main.swift" \
  -o "$test_dir/server-check"
"$test_dir/server-check" "$test_dir/assets"
