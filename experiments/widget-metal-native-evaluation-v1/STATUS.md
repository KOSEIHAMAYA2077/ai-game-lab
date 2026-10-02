# 独立資源比較の現在地

2026-10-03 01:51 JST。ロックを主担当が実UIで確認したため、Metal/WK通常表示の計測は未開始。既存の性能値をMetalへ帰属したり、非表示の値を通常表示へ読み替えない。

準備済み: 新しいignored .localへ既存校正済みhelperをコンパイル。R3ソースのfixture・history無効処理とflat metrics schemaを読んだ。[計画](PLAN.md)と[状態を照合する集計](summarize.py)を用意。実測原票、アプリの実PID帰属、shader初回の実app値、calm/paused/hidden CPU・RAMの結果はまだ無い。

次の解除可能時は、主担当の実起動と主PID/metrics出力通知を受けて新しい起動前後の帰属を取り、人工白球でshader準備と通常表示90秒を分ける。実Pause/Unpause/Hide/Quitは主担当が操作する。モデルと重い検証を並行せず、全state一致の窓だけを採用する。
