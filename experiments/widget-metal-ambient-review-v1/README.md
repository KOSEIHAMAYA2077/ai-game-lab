# Native 入力 → 文字表面の独立レビュー

専用編集欄の人工コールバックと単一 R3 body、JSC bridge、80 B 表示インスタンスを確認した。Build R4 初回の独立 12/12＋境界 6/6、Build R5 同期待値の修正後回帰 12/12＋6/6。既知取消 1/1 と応答容量 1 fixture は別の母数。過去版の失敗と独立ハーネスの初回コンパイル失敗も保持する。

[REPORT](REPORT.md)に結果、未確認事項、再現方法を記載。[METHOD](METHOD-R1.json) / [CASES](CASES-R1.json) は source 未読・実行前に固定。[SUMMARY](SUMMARY.json) は保存原票の再計算と source pin の一致。再計算は repository root から `python3 experiments/widget-metal-ambient-review-v1/audit_saved.py`。

実ウィンドウ・実 IME・OS 全体入力・GPU・常駐資源は今回未評価。一般 unmark を材料 0 とする保守的方針、ACK=true held の容量消費、hide の全経路で preedit 取消を保証できない点、毎 advance の全文 body JSON を明記。対応は球 / 箱 / 輪の 3 種類で、native 16 形の言語対応を意味しない。
