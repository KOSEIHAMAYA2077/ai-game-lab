# 専用editor → 文字の面: 独立source監査

対象は `experiments/ambient-editor-surface-v1/` のR1/R2です。このフォルダは比較対象を変更せず、sourceの凍結コピーとCPUだけの人工データ検算を保存しています。実ブラウザ、GPU、OS入力取得、日本語IMEの実操作は行っていません。

13個の期待事項をcandidate source未読で固定しました。うち12事項に対する独立CPU probeはR1 **12/12**、同じ期待値を使ったR2の既知修正後の回帰も **12/12** でした。残りP13は上限と主張範囲のsource/doc reviewです。この分母を実画面や性能評価に読み替えません。

作者からタイマー不具合の通知を受けた後、実行前に別固定した感度検査では、R1が人工時計の `[0,1000)` に16回動くことをexact/floorの2条件で再現しました。R2は67ms間隔にした修正後の回帰で各15回です。R1の失敗原票を保持しています。

- [REPORT.md](REPORT.md): 採否と限界。
- [METHOD-R1.json](METHOD-R1.json) / [CASES-R1.json](CASES-R1.json): source未読の期待値。
- [results-r1.json](results-r1.json) / [results-r2.json](results-r2.json): 独立人工データ原票。
- [SOURCE-NOTES.md](SOURCE-NOTES.md): ID、色、停止、shader/basis、保存の対応。
- [SUMMARY.json](SUMMARY.json): 分母を分けた数値。

リポジトリルートから、既存の原票を上書きしない新しい出力名で再現できます。Node.jsと標準ライブラリのみを使います。

```sh
node experiments/ambient-editor-surface-review-v1/probes-r1.mjs experiments/ambient-editor-surface-review-v1/snapshots/r1/projection.mjs experiments/ambient-editor-surface-review-v1/replay-r1-new.json
node experiments/ambient-editor-surface-review-v1/probes-r1.mjs experiments/ambient-editor-surface-review-v1/snapshots/r2/projection-r2.mjs experiments/ambient-editor-surface-review-v1/replay-r2-new.json
```

probeのshader一致検算は読み取り専用の `prototypes/glyph-creature/src/scene.ts` を参照します。`DEPENDENCY-FREEZE-R1.json` のSHAを確認し、異なるsourceを同じ評価版として扱わないでください。現在のSHAは `SOURCE-UNCHANGED-R1.json` で28項目すべて一致しています。原票内の `version: independent-r1` は同じ凍結method/runnerを意味し、candidateの区別は `projectionSource` と出力名で示します。
