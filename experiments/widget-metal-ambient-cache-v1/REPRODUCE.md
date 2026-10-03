# Reproduce from repo root

この比較は Apple Silicon / macOS の JavaScriptCore と、既にローカルにある Rolldown 1.2.11 を使います。実行時記録は Apple Swift 6.3.2、Swift language mode 5、SDK 26.5、target arm64 macOS 26.0 です。追加 download はありません。旧 Build R5 の immutable `Receiver.js` が必要です。Git の source だけには ignored app/binary は含まれないため、旧 R5 の返却資料から独立の作業コピーで再構築するか、SHA の一致するローカル比較成果物を用意してください。今回の担当は旧フォルダを変更しませんでした。

以下のコマンドは repo root 相対です。出力が存在すると止まり、旧 bundle・原票・app を上書きしません。新しい run directory 名を選びます。`build-runtime.mjs` は旧 23 pins の一致を要求し、最初の bundle を一回だけ作成します。返却済みローカル環境では既存 bundle を使い、その生成コマンドを再実行しません。

```sh
node experiments/widget-metal-ambient-cache-v1/build-runtime.mjs
bash experiments/widget-metal-ambient-cache-v1/reproduce-cpu.sh \
  experiments/widget-metal-ambient-v1/work/GlyphMatter-Ambient-ProducerR2-BridgeR2-BuildR5.app/Contents/Resources/Receiver.js \
  experiments/widget-metal-ambient-cache-v1/work/reproduction-new
bash desktop/glyph-metal-ambient-cache-v1/build.sh --output \
  experiments/widget-metal-ambient-cache-v1/work/GlyphMatter-Ambient-Cache-New.app
```

`replay-core.mjs` は source R2 の検査修正を使って、同じ事前 core3 fixture を新しい場所へ実行します。CPU CLI は旧 bundle と新 bundle の同じ native14 command を通し、core3 の全 readBody と cache delta も比較します。数値・Unicode 文字列・ID・ink・出生 metadata・80B instance を検査し、不正 wire8 の reject 前後の view を検査します。GPU、ブラウザ、実 native UI は起動しません。

timing は `Tests/Timing.swift` を CPU harness の `main.swift` の代わりに同じ source 列へ追加して compile し、次の引数を渡した記録です。既存原票に上書きしません。

```sh
experiments/widget-metal-ambient-cache-v1/work/cache-timing-r1 \
  experiments/widget-metal-ambient-v1/work/GlyphMatter-Ambient-ProducerR2-BridgeR2-BuildR5.app/Contents/Resources/Receiver.js \
  experiments/widget-metal-ambient-cache-v1/work/bundle-r1/Receiver.js \
  experiments/widget-metal-ambient-cache-v1/TIMING-METHOD-R1.json \
  experiments/widget-metal-ambient-cache-v1/work/timing-new.json
```

`Tests/Boundary.swift` も同じ source 列へ追加し、旧 bundle / 新 bundle / 新 JSON output の 3 引数で実行します。これは旧 R5 に見つかった UTF-16 / grapheme / JSON response 上限の既知回帰です。core 20 等の旧ケースを今回の fresh25 に数えません。今回旧20を再実行したとは記載しません。

app は署名・compile・resource SHA の比較だけで、`open` や UI/OS 権限操作は行っていません。root が実操作を担います。人工入力であっても、個人パス入り stderr は ignored private 原票に保存し、公開コピーだけで trace path を置換します。
