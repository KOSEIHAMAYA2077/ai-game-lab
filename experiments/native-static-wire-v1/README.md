# 本文を返さない、上限付きの日本語特徴CLI

2026-10-03。元の[Swift CPU候補R5](../native-static-japanese-v1/PUBLIC-README-R6.md)を保ち、その外側のJSONL入口を別版にした。アプリ・OS入力・既定の意味解釈へは接続していない。

- 1入力はLFを除いて32,768 byteまで。超えた行を捨て、次の行へ戻る。
- 返信は5項目・2,048 byteまで。本文・token・piece・vectorを返信へ含めない。
- 最初の正常な依頼で固定modelを読み、そのprocess内だけで保持。取得済みのtable/tokenizer/captionのSHAを確認する。新しいモデル取得・文章の外部送信はない。
- 元の128F16特徴、60形/6primitive、空白・未知語・保留policyは変えない。raw cosineは受理の確信度ではない。

[方法の事前固定](METHOD-R1.md) / [現候補R2](CANDIDATE-R2.json) / [作者の既知回帰](KNOWN-SUMMARY-HELPER-R2.json) / [独立初回評価](../native-static-wire-review-v1/REPORT-R1.md)。独立20入力・21返信が契約に一致。旧R5正常9件との比較は、候補生成6件と保留3件を分け、score差0。

R1はコンパイル時の型引数省略で失敗し、R2はその1点を修正。作者の最初の5+5返信検算も、nilを省略する旧JSONへのhelperの読み方で失敗し、初回の原返信は保存できなかった。[失敗記録](AUTHOR-HELPER-FAILURE-R1.json)。helperを修正した同fixture再実行5+5は、原票を先に保存して一致。これは新規の意味評価ではない。

固定modelがない新しい空の作業directoryでも、不正な2件は返信して終了し、正常な依頼は固定エラーで停止した。[lazy境界原票](LAZY-RAW-R1.json)。これは不正依頼をmodelなしで処理できる確認で、allocation追跡や全widget負荷ではない。

## 再現

repo rootで、取得済みの固定dataが必要。モデル準備は元R5の[再現手順](../native-static-japanese-v1/REPRO.md)と同じ。

```sh
wire_demo_dir=$(mktemp -d)
xcrun swiftc -O experiments/native-static-wire-v1/NativeStaticWireR2.swift -o "$wire_demo_dir/glyph-static-wire-r2"
printf '%s\n' '{"requestId":1,"text":"青い球の人工文","registry":"shape"}' | "$wire_demo_dir/glyph-static-wire-r2"
```

生成binaryを保存したい場合は既存ファイルを上書きしない新しい出力名にする。ここでは取得済みモデルをSHAで検証し、実行時に自動取得しない。作者環境はApple Silicon/M5・32GiB、Swift6.3.2。Darwinを使うCLIで、Windows/16GB PCは未確認。旧source prefixはbyte同一、算法のApache-2.0 [LICENSE](LICENSE)、modelは旧pinのMITを維持。

## 残る境界

これは同期CLIの契約比較で、実IPCの認証・取消・epoch・重複依頼の排除・timeout・入力元の同意・modelの寿命制御は未実装。Foundationの重複JSON key解釈に従い、requestIdは相関IDだけである。本文は処理中のmemoryに存在し、返信へ含めないことを匿名化や本文取得の許可とは呼ばない。全アプリ取得、実UI、GPU、消費電力、人による評価、新規shape意味精度の結果ではない。元のWeb・小窓・source・保存・Releaseは保持する。
