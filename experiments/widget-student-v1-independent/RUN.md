# 評価の入口

[PLAN.md](PLAN.md) の独立性条件を満たし、主担当から開始指示を受けた後に使う。今はfixtureを固定しただけで、モデル成績は未測定。

1. studentの重み、閾値、前処理、推論ソース、schema/コンパイラのSHAを受け取る。モデル担当へfixtureを先渡ししない。
2. fixtureの90文を1回ずつ推論し、以下の形式で新しいバージョンの結果JSONを保存する。
3. 保存した予測にscorerを適用する。既存結果は上書きせず、新しい名前を使う。

```json
{
  "model_name": "frozen-model-name",
  "frozen_manifest": {
    "weights_sha256": "...",
    "inference_sha256": "...",
    "threshold_sha256": "...",
    "preprocessing_sha256": "..."
  },
  "environment": {"runtime": "...", "hardware": "..."},
  "resource_measurements": {
    "explicit_js_buffers_bytes": null,
    "whole_app_physical_footprint_bytes": null,
    "note": "null means not measured, not zero"
  },
  "predictions": [
    {
      "id": "case-id",
      "program": null,
      "elapsed_ms": 0.3,
      "error": null
    }
  ]
}
```

`program` は既存Program形式そのまま、見送りはnull。任意の形状コード、推論文、裸のprimitiveラベルは直接成功として採点しない。確定文を必ず全部含め、欠けたケースを成功率の分母から落とさない。

geometryを別に実測した場合は、各予測に `geometry: {compiled: true, finite: true, through_material: true, sample_count: ...}` を添える。through_materialはthrough出力のみ必要。実際にコンパイル・サンプリングしていない場合は添えない。scorerは未測定のgeometryを成功に換算しない。

```sh
python3 experiments/widget-student-v1-independent/check_scoring.py
python3 experiments/widget-student-v1-independent/score.py \
  --predictions experiments/widget-student-v1-independent/results/student-first-pass-v1.json \
  --output experiments/widget-student-v1-independent/results/student-first-pass-v1-scored.json
```

scorer自体はモデル・学習データをimportしない。oracle、すべて見送り、親子逆転、不正Program、timeoutによるnull、壊れたgeometry、欠けたケースという評価器の整合性確認を実施済み。これはモデル精度の結果ではない。
