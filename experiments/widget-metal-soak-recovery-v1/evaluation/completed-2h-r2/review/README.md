# R5 offscreen 2時間完走の独立原票監査

このフォルダは完走R2の公開用原票を読み、SHA・計時・CPU・bytes・境界・画素の集計を独立に照合した記録です。engine、sampler、OS、GPU、実UIを再実行していません。原票、source、閾値、以前の中断記録は変更していません。

事前の監査項目12をraw閲覧前に固定しました。ただしrootの完走集計は受領済みなので、走行前の事前登録やblind実験ではありません。項目をまとめた11検算は、初回 **10/11** でした。1件はsystem PythonがUTC末尾 `Z` を解析できなかった監査helperの不具合です。初回を保持し、同じ期待値でhelperだけを直した回帰は **11/11** でした。engineの故障へ読み替えません。

- [REPORT.md](REPORT.md): 採否、再計算値、証拠範囲。
- [METHOD-R1.json](METHOD-R1.json): raw未読時の監査項目。
- [AUDIT-R1.json](AUDIT-R1.json) / [AUDIT-R2.json](AUDIT-R2.json): 初回と既知helper修正後の原票。
- [SUMMARY.json](SUMMARY.json): 指標の分母と終了境界。
- [INPUT-FREEZE-R1.json](INPUT-FREEZE-R1.json): 公開用30fileの監査開始SHA。

再計算式は [audit-r2.py](audit-r2.py) にあります。標準PythonライブラリだけでNDJSON、PNG、JSONを読みます。固定原票への書込はexclusiveなので、同じ出力名での再実行は拒否します。再現時は新しい出力名を指定できます。

```sh
python3 experiments/widget-metal-soak-recovery-v1/evaluation/completed-2h-r2/review/replay.py replay-new.json
```

走行自体の再現は `experiments/widget-metal-soak-v1/README.md` と `experiments/widget-metal-soak-recovery-v1/supervise.py` を参照してください。独立監査だけで実走行や窓表示を再現したとは扱いません。
