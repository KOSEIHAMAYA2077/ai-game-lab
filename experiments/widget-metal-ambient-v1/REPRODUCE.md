# Reproduce with synthetic input

repo rootから実行する。確認環境はApple M5、Swift6.3.2、macOS SDK26.5、既存Rolldown1.2.11／Node26.4.0。追加download不要。一般環境互換性は未検証。出力名は**未使用のowned work path**を選び、旧原票やappを上書きしない。

固定source/compilerから新bundleを作る。元IIFEのbyte SHAとの一致を表示する。既存の `work/bundle-r1/Receiver.js` があるこのMacでは別名を使う。初回checkoutでcurrent appをbuildする場合は、その固定pathを未使用出力に選ぶ。

```sh
node experiments/widget-metal-ambient-v1/replay-bridge.mjs experiments/widget-metal-ambient-v1/work/replay-bundle/Receiver.js
node experiments/widget-metal-ambient-v1/replay-node.mjs experiments/widget-metal-ambient-v1/work/replay-bundle/Receiver.js experiments/widget-metal-ambient-v1/work/replay-node
```

native JSC / actual projection / actual instance builder の人工CPU回帰。元20とmanual12を新出力へ保存する。

```sh
xcrun swiftc -O -swift-version 5 -target arm64-apple-macos26.0 -framework JavaScriptCore \
  desktop/glyph-metal-ambient-v1/Sources/GeometryTypes.swift \
  desktop/glyph-metal-ambient-v1/Sources/SurfaceReference.swift \
  desktop/glyph-metal-ambient-v1/Sources/WordSurfaceReference.swift \
  desktop/glyph-metal-ambient-v1/Sources/CreatureRigReference.swift \
  desktop/glyph-metal-ambient-v1/Sources/Projection.swift \
  desktop/glyph-metal-ambient-v1/Tests/LegacyMath.swift \
  desktop/glyph-metal-ambient-v1/Tests/main.swift \
  -o experiments/widget-metal-ambient-v1/work/replay-cpu
experiments/widget-metal-ambient-v1/work/replay-cpu \
  experiments/widget-metal-ambient-v1/work/replay-bundle/Receiver.js \
  experiments/widget-metal-ambient-v1/fixtures/manual-r1.json \
  experiments/ambient-javascriptcore-v1/CASES-R3.json \
  experiments/widget-metal-ambient-v1/work/replay-native-results
```

own editorの人工method callback回帰。unattached fieldを作るだけで実入力／IME／窓を使わない。R1取消失敗を再現する場合は `OwnEditor-r2.swift` と `OwnEditorCallbacks-r2.swift` をそれぞれR1名に替え、別出力を使う。R1 5/6、R2 元6/6＋追加1/1が保存された結果。

```sh
xcrun swiftc -O -swift-version 5 -target arm64-apple-macos26.0 -framework AppKit -framework JavaScriptCore \
  desktop/glyph-metal-ambient-v1/Sources/GeometryTypes.swift \
  desktop/glyph-metal-ambient-v1/Sources/Projection.swift \
  desktop/glyph-metal-ambient-v1/Sources/ReceiverBridge-r2.swift \
  desktop/glyph-metal-ambient-v1/Sources/OwnEditor-r2.swift \
  desktop/glyph-metal-ambient-v1/Tests/OwnEditorCallbacks-r2.swift \
  -o experiments/widget-metal-ambient-v1/work/replay-callback
experiments/widget-metal-ambient-v1/work/replay-callback \
  experiments/widget-metal-ambient-v1/work/replay-bundle/Receiver.js \
  experiments/widget-metal-ambient-v1/work/replay-callback-results.json
```

GPU接続は、他の静穏資源計測と並走させず許可済みの時だけ実行する。新出力directoryを先に作る。窓・イベントloop・実IMEは起動しない。3面のrender／finiteは既知接続回帰で、人体験やwhole-window資源測定ではない。

```sh
xcrun swiftc -O -swift-version 5 -target arm64-apple-macos26.0 \
  -framework AppKit -framework Metal -framework MetalKit -framework CoreText -framework JavaScriptCore \
  desktop/glyph-metal-ambient-v1/Sources/GeometryTypes.swift \
  desktop/glyph-metal-ambient-v1/Sources/SurfaceReference.swift \
  desktop/glyph-metal-ambient-v1/Sources/WordSurfaceReference.swift \
  desktop/glyph-metal-ambient-v1/Sources/CreatureRigReference.swift \
  desktop/glyph-metal-ambient-v1/Sources/CameraFraming.swift \
  desktop/glyph-metal-ambient-v1/Sources/Projection.swift \
  desktop/glyph-metal-ambient-v1/Sources/ReceiverBridge-r2.swift \
  desktop/glyph-metal-ambient-v1/Sources/Renderer.swift \
  desktop/glyph-metal-ambient-v1/Tests/GPUConnection-r1.swift \
  -o experiments/widget-metal-ambient-v1/work/replay-gpu
mkdir experiments/widget-metal-ambient-v1/work/replay-gpu-images
experiments/widget-metal-ambient-v1/work/replay-gpu \
  experiments/widget-metal-ambient-v1/work/replay-bundle/Receiver.js \
  desktop/glyph-metal-ambient-v1/Sources/Glyphs.metal \
  experiments/widget-metal-ambient-v1/fixtures/manual-r1.json \
  experiments/widget-metal-ambient-v1/fixtures/gpu-connection-r1.json \
  experiments/widget-metal-ambient-v1/work/replay-gpu-images
```

appの最小buildは既存fixed `work/bundle-r1/Receiver.js` を読む。初回のみ `replay-bridge.mjs` でその未使用pathへ生成できる。現在はimmutable artifactを残して新app名でbuildする。

```sh
bash desktop/glyph-metal-ambient-v1/build-r5.sh --output experiments/widget-metal-ambient-v1/work/GlyphMatter-Ambient-RepeatR5.app
```

rootが実操作をする際の候補は `work/GlyphMatter-Ambient-ProducerR2-BridgeR2-BuildR5.app`。保存offが既定。診断を明示する場合だけ、起動引数 `--diagnostics-file` に新しい私有出力先を渡す。内容は集計だけで、実本文やID列を記録しない。ここでは実起動／OS解除を行っていない。
