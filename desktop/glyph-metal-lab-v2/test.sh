#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
[[ "$#" == 1 && "$1" == /* ]] || { echo 'Usage: test.sh /absolute/ignored/new-test-directory' >&2; exit 2; }
test_directory="$1"
[[ ! -e "$test_directory" ]] || { echo 'Test output exists; choose a new path.' >&2; exit 2; }
mkdir -p "$test_directory"
xcrun --sdk macosx swiftc -O -swift-version 5 "$script_dir/Sources/Matter.swift" "$script_dir/Sources/SurfaceReference.swift" "$script_dir/Tests/main.swift" -o "$test_directory/cpu-tests"
"$test_directory/cpu-tests" "$test_directory" "$script_dir/Tests/surface-reference.json" | tee "$test_directory/cpu-report.json"
