# JavaScriptCore pure receiver CLI

固定receiver R3をWebViewなしのMac JavaScriptCoreで実行する小さい境界実験。**既存の人工20ケースがNode-vm / JavaScriptCoreとも20/20、同一bundleの意味出力が20/20一致**した。このMacのCLI内で契約を処理できる候補であり、native appへの接続やOS入力取得の達成ではない。

唯一の材料/ID所有者は元 `receiver-r3.mjs`。閾値・grammar・source registry・grapheme処理は変更せず、ローカル既存Rolldownで42,915BのIIFEを作る。新しい純fixture evaluatorを一緒にbundleし、その同じfileをNode realmとSwift `JSContext`へ渡す。原20ケースはJSON blueprintsからJS内でthrowing payload getter / frozen retry / alias / 最新shape tokenを再構築する。

R1で必要builtinが使用できたので、polyfill / JS→native関数callbackは0。DOM / fetch / fs / process / clipboard / native入力hookは与えない。hostだけが選んだbundle・capability scriptと人工stdin JSONを読み、人工raw resultをstdoutへ返す。JSはFileHandleやFoundation objectを受け取らない。WebView / WebKit importは無い。

## 再現（repo rootから）

追加download / package install不要。既存installed RolldownとSwift / JavaScriptCore.frameworkを使う。generated bundle /結果folderは新規のみ、既存出力があればrunnerは拒否する。元原票を消さず、再実行は別version/outputにする。

```sh
node experiments/ambient-javascriptcore-v1/build.mjs
xcrun swiftc -framework JavaScriptCore -module-cache-path experiments/ambient-javascriptcore-v1/.runtime/module-cache-r1 -o experiments/ambient-javascriptcore-v1/.runtime/native-r1 experiments/ambient-javascriptcore-v1/NativeCLI.swift
node experiments/ambient-javascriptcore-v1/run.mjs
```

`run.mjs` がfixtureの同一hashを確認し、同じbundleを両engineへ渡す。native CLIへ直接人工fixtureを渡す例:

```sh
experiments/ambient-javascriptcore-v1/.runtime/native-r1 experiments/ambient-javascriptcore-v1/.runtime/bundle-r1/receiver.iife.js experiments/ambient-javascriptcore-v1/capabilities.js < experiments/ambient-javascriptcore-v1/CASES-R3.json
```

CLI stdoutには人工本文/IDの検証原票が含まれるので、実文を入れない。C17のsavingOnは元人工opt-in export schemaを試すだけで、native保存機能は作っていない。

## 証拠と範囲

- `METHOD.json` / `COMPARISON.json`: 実装・結果前固定。`CASES-R3.json` は元人工JSONと同byte。
- `SOURCE-FREEZE-R1.json` / `BUNDLE-R1.json`: sourceと同一generated bundleのhash。
- `results-r1/node.json` / `native-stdout.json` / `native-stderr.txt` / `summary.json`: 新しい人工raw結果。例外/unsupportedを自動PASSにしない。
- `PROVENANCE-R1.json` / `ENVIRONMENT-R1.json`: sourcepin、builtin、実compiler/SDK環境。METHODの事前SDK推定26.0は誤りで、実SDK26.5へ訂正を分けて残す。
- `REPORT.md`: 有限snapshot・比較結果・未証明事項。
- `FUTURE-BRIDGE.md`: 同一processへの将来設計だけ。native app / Metal / own-editor adapterへ今回は接続しない。

これは既存20ケースのportability回帰であり、新しい独立holdout・human annotationではない。実IME / OS監視 / UI / GPU / model /省資源 /仕事の快適性は検証0。CLIのメモリを小窓全体RAMへ換算する比較も行っていない。
