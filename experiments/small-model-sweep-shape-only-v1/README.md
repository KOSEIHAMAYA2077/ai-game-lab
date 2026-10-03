# 形だけを返す別比較

初回24文で属性の補完が多かったため、action/shapeのみのpromptを別版で固定し、別の未見36文で6候補を試した。初回契約・原票を上書きしていない。

[独立比較・得点・RAM](../small-model-sweep-shape-only-evaluation-v1/results-r1/README.md) / [事前選定](SELECTION-R1.json) / [最終prompt](prompt-r2.json) / [凍結](PROMPT-FREEZE-R2.json) / [人工原返信](raw-public-r1/) / [実行source](run_r2.py)。

R1のprompt/driver draftを保存し、未見fixture本文・出力を読む前にR2を固定した。R1とR2の契約・問題集合は異なり、直接の改善率にしない。
