# 小型日本語埋め込み native 配備の独立レビュー

[REPORT](REPORT.md) / [SUMMARY](SUMMARY-R1.json)。source未読で固定した手書き20入力は20/20配備parity、artifact-informed special4は別母数4/4。既知709の保存算術も709/709で、今回のnative追加callは0。意味精度、人間評価、3D生成、全widget常駐性能は評価していない。

候補はR5 source / binary / tokenizer / 8MiB F16 mmap / 手書きcaption343を固定。Python oracleとnative processを分ける。最初のoracleのcaptionIndex local仮定、既知709算術helperのoptional field KeyErrorを保存し、別helperへ直した。gate/input/model/thresholdの変更なし。

未信頼JSONL line / response byte bound、本文を出さない応答、曖昧・否定・confidence policyは未実装。default接続は保留推奨。保存結果だけの再計算:

```sh
python3 experiments/native-static-japanese-review-v1/audit_saved.py
```
