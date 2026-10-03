# 計算領域を減らす資源診断

Bonsai1.7/4に同じ既見36文を渡す診断。context1024、batch64、ubatch32、出力128へまとめて変更。モデルを常駐させる場合のserver単独RAMと、4Bの600秒idleを測った。

[独立原票・方法・結論](../small-model-sweep-resource-evaluation-v1/README.md) / [事前計画](PLAN-R1.json) / [finaldriver凍結](DRIVER-FREEZE-R2.json) / [人工原返信](raw-public-r1/) / [実行source](run_r2.py)。

最初のcounter mockにNoneを使ったsetup失敗はモデル呼出し前。fake PIDへ直した検査を[記録](COUNTER-SELF-CHECK-R1.json)。driver R1 draftを保存し、全体deadlineでidleも制限するR2を出力前に固定。completedだけで600秒完走と判断せず、実経過を確認した。小窓・OS・monitor・一般16GB機の資源は含まない。
