# Metal 13形・実小窓資源比較

[結果と制限](REPORT.md) / [事前方法](METHOD-R1.json) / [原票](evaluation/real-r1/) / [公開copy SHA](ROOT-PUBLICATION.json)。

独立namespaceの13形候補で4形を測った別実験。既定60形Web・全OS入力・一般16GB機の達成とはしない。旧v2記録は保持。

再現は新しいapp/PIDでMETHODの順番を守る。make_expectation_v3.pyはrootが実UI・静穏状態を確認した後のsidecar作成用で、自動UI確認ではない。保存済み原票の検算例:

    python3 experiments/widget-metal-native-evaluation-v3/validate.py experiments/widget-metal-native-evaluation-v3/evaluation/real-r1/sphere-calm.json --expectation experiments/widget-metal-native-evaluation-v3/evaluation/real-r1/sphere-calm-expectation.json --phase calm --output /tmp/glyph-metal-v3-new-summary.json

出力は未作成pathを使い、元summaryを上書きしない。test_validate_v3.pyは旧27人工guardのrenderer名とuniform336だけを新候補へ合わせた回帰で、新規汎化評価ではない。
