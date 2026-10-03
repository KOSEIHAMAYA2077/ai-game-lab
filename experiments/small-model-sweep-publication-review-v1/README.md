# 小モデル比較・公開前レビュー

現在の結果は[REPORT-R1](REPORT-R1.md)。固定24文の算術・厳密採点のpin、別36文、資源診断、BitNet単独診断、公開用カタログと人工exportを読み取りだけで照合した。

[集約入口](../small-model-sweep-v1/README.md)の意味や資源の達成を広げず、失敗・未試行・既見診断・未検証の環境を別に保持する。GitHubへの実際の公開成否、既存UIの実操作、推論をこのレビューで再実施したものではない。

[初回727照合](JSON-CHECK-R1.json) / [資源92照合](RESOURCE-CHECK-R1.json) / [追認340照合](FINAL-DOC-CHECK-R2.json) / [追加141照合](SUPPLEMENT-CHECK-R4.json) / [micro確認](BITNET-MICRO-REVIEW-R1.json)。

R3の8失敗はレビュー側のstatus名の誤用として[原票](SUPPLEMENT-CHECK-R3.json)を残した。R4で既存driverのokとsummaryのreplyを対応させた。研究の期待値・元返信・採点は変更していない。
