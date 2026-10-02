#!/usr/bin/env bash
set -euo pipefail
# CPU callbacks only. No window, actual IME, Metal device or OS input monitor.
review_dir="experiments/widget-metal-ambient-review-v1"
output_dir="${1:?Pass a new relative output folder from repository root.}"
if [[ "$output_dir" = /* || -e "$output_dir" ]]; then
  echo 'Output must be relative and must not already exist.' >&2
  exit 2
fi
test -f "$review_dir/CASES-R1.json"
mkdir "$output_dir"
mkdir "$output_dir/module-cache"
common=("$review_dir/snapshot-r1/GeometryTypes.swift" "$review_dir/snapshot-r1/Projection.swift")
fixture_bundle="$review_dir/snapshot-r1/Receiver.js"
xcrun swiftc -O -module-cache-path "$output_dir/module-cache" "${common[@]}" "$review_dir/snapshot-r1/ReceiverBridge.swift" "$review_dir/snapshot-r1/OwnEditor-r2.swift" "$review_dir/IndependentCallbacks-r1.swift" -o "$output_dir/r4"
"$output_dir/r4" "$fixture_bundle" "$output_dir/r4.json" ProducerR2-BuildR4-replay
xcrun swiftc -O -module-cache-path "$output_dir/module-cache" "${common[@]}" "$review_dir/snapshot-r1/ReceiverBridge.swift" "$review_dir/snapshot-r1/OwnEditor.swift" "$review_dir/IndependentCallbacks-r1.swift" -o "$output_dir/r1-negative"
set +e
"$output_dir/r1-negative" "$fixture_bundle" "$output_dir/r1-negative.json" HistoricalProducerR1-negative-replay
negative_exit=$?
set -e
test "$negative_exit" -eq 1
xcrun swiftc -O -module-cache-path "$output_dir/module-cache" "${common[@]}" "$review_dir/snapshot-r2/ReceiverBridge-r2.swift" "$review_dir/snapshot-r1/OwnEditor-r2.swift" "$review_dir/IndependentCallbacks-r1.swift" -o "$output_dir/r5"
"$output_dir/r5" "$fixture_bundle" "$output_dir/r5.json" ProducerR2-BridgeR2-BuildR5-replay
xcrun swiftc -O -module-cache-path "$output_dir/module-cache" "${common[@]}" "$review_dir/snapshot-r1/ReceiverBridge.swift" "$review_dir/IndependentJSONBoundary-r2.swift" -o "$output_dir/json-old"
"$output_dir/json-old" "$fixture_bundle" "$output_dir/json-old.json" BuildR4-OldGuard-replay expect-old-failure
xcrun swiftc -O -module-cache-path "$output_dir/module-cache" "${common[@]}" "$review_dir/snapshot-r2/ReceiverBridge-r2.swift" "$review_dir/IndependentJSONBoundary-r2.swift" -o "$output_dir/json-new"
"$output_dir/json-new" "$fixture_bundle" "$output_dir/json-new.json" BuildR5-NewGuard-replay expect-new-success
