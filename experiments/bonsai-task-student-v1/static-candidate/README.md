# Local static feature exporter

[export_features.py](export_features.py) は取得済みの `hotchpotch/static-embedding-japanese`、revision `95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3` の tokenizer と32768×128 float16表だけから特徴を返す。新しいモデル取得、head 学習、caption順位付け、形の推論は行わない。Python 3.9の既存環境（numpy 2.0.2 / tokenizers 0.22.1）を使う。

実行場所はリポジトリのルート。

```sh
.local/static-japanese-v1/venv/bin/python -B experiments/bonsai-task-student-v1/static-candidate/export_features.py --metadata
.local/static-japanese-v1/venv/bin/python -B experiments/bonsai-task-student-v1/static-candidate/export_features.py < feature-requests.jsonl
```

入力は一行ずつ `{"id":"example","text":"花を活ける口の狭い器"}`。出力は同じidと `vector`（128数値またはnull）、`hold`、tokenCount、unknownFraction、encodingMs。`--debug` はtokenIdsと正規化前の平均を追加する。

元の tokenizer をそのまま使い、自動 special tokens、padding、truncation は加えない。64 tokenずつfloat32で合計し、全tokenの平均をL2正規化する。これは既存の `experiments/static-japanese-retrieval-v1/retrieval.py` の算術手順。入力512 Unicode scalar、4000token、JSONL一行65536byteを上限とし、空、未知token過多、不正Unicode、不正JSON等を理由付きで返す。

固定された SHA-256:

| 内容 | SHA-256 |
|---|---|
| exporter | `59040afc86950ec93435f533c3b4ec61029ca745a0db1de053880de0f772d4c6` |
| 8,388,608byteの128-F16表 | `65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201` |
| tokenizer | `833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9` |
| 既存モデルmanifest | `e2e32fb1005315c1d6c0b102e0b11810180112025b8a40b8cda48bb179e7fd8f` |

[python-feature-parity.json](python-feature-parity.json) に、train/dev文と人工の境界入力45例を記録した。既存Python encoderで比較できる44例はtoken IDs、hold、vectorが完全一致（最大差0）。513文字の1例は新exporterの512文字契約で拒否した。JSONLの不正・過大入力後にも次の正常行を処理できる。exporterの固定ハッシュも不変。

[StaticFeatureR1.swift](StaticFeatureR1.swift) と `static-feature-r1` は初期の複製試作で、訓練・選択には未使用。Python経路を採用したため追加検証は止めた。この資料はSwift/JSとの一致を主張しない。五候補のdev監査は [training-review/README.md](../training-review/README.md)。holdout本文・予測は読んでいない。
