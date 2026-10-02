# Ambient shape retrieval v1

既定へ採用しない独立CPU候補。既存60形のalias/選別WordNet/作者graph/小さなIDF疎profileから一つの形を提案し、弱い根拠は現在形を保持する。入力は512 UTF-16以下、weight204,333B、純JavaScriptでNode/JSC動作を確認。OS入力・本文蓄積・保存・Web/native rendererには接続していない。

独立120文ではfull exact14/60、受理22/60（8誤形）、明確no-shape誤反応2/40、未解決hold18/20。既存resolverはexact19/60・誤反応20/40。低い誤反応と低いcoverageを両方残す。ほぼaliasによる受理で、未知語理解・任意text-to-mesh・意味一般化の達成を主張しない。候補を見ていない別担当が著作/凍結、実装担当は本文・ラベル・個別失敗を未閲覧、freeze後調整0。

- [REPORT.md](REPORT.md): 分母・層別・寄与・採否。
- [METHOD-R1.md](METHOD-R1.md) / [FREEZE-R1.json](FREEZE-R1.json): 事前固定とSHA。
- [INDEPENDENT-SUMMARY-R1.json](INDEPENDENT-SUMMARY-R1.json): 独立担当からの集計のみ。
- [REPORT-PRE-EVAL-R1.md](REPORT-PRE-EVAL-R1.md): 開発評価との分離。
- [METHOD-CPU-R1.md](METHOD-CPU-R1.md) / [CPU-NODE-R1.json](CPU-NODE-R1.json) / [CPU-JSC-R1.json](CPU-JSC-R1.json): 局所CPU/RAMと704case parity。
- [REPRO.md](REPRO.md) / [api.mjs](api.mjs): bounded API。
- [LIMITATIONS.md](LIMITATIONS.md) / [licenses/wordnet-NOTICE.md](licenses/wordnet-NOTICE.md): 未確認と素材条件。

このフォルダのみ編集した。旧source/資料/default/Git/UI/OSを変更していない。Human0/人工文、Mac CPU局所測定、一般PC/長期常駐/快適性は未検証。
