# 2時間試験の中断と観測できた範囲

2026-10-03 03:50 JST。既存の凍結 R5 試験と計測 helper を読み取りだけで確認した。**2時間完了ではなく、中断・終了理由不明**と分類する。root は03:43 JSTに engine/sampler の PID が存在せず、exec sessionもUnknownと報告した。原票の `running` は最後に書かれた値であり、現在も動いている証拠ではない。

| 最後に確認できたもの | 範囲・値 |
| --- | --- |
| 開始／予定 | 02:35:33 JST／7200秒、予定04:35:33 JST |
| 最終 progress | 1828.8717秒、27,434 render command commits、15.0005 commits/秒 |
| GPU完了を待った最後の画素検査 | 1800.2710秒、frame counter 27,005、非空画素6,393 |
| 更新 | 600/1200/1800秒の3回、各400文字追加。保存中の文字1,536→2,736、描画1,536。球→箱→メビウス→球 |
| atlas | 22→167種類、1→8行、4個作成。検査時の旧Swift texture object残数は0 |
| GPU検査 | 11回の非空画素・色別sum・画素SHA、3形×5地点×11回=165地点の位置/接線finite |
| 最終カウンタ | MTL error/timeout/deadline skip 0。submit p95上側bin .25ms、最大4.8727ms |
| 資源 | 364行、有効1819.4045秒。1PID・1コア換算CPU0.6227%、sampled peak charged footprint88.1MiB、RSS55.7MiB |
| 資源の最後の時刻 | 03:06:02.896 JST。後続の終了時刻・signal・exit codeは記録なし |

原票から CPU・peak・単調増加・件数を再計算し、[数値根拠](evidence-r1.json)へ保存した。入力本文は人工fixtureだけ。既存原票と実装・実行物の SHA は[読取manifest](read-only-manifest-r1.json)。元の原票は変更していない。

## 言えることと残ること

最終 progress の frames は `command.commit()` 後に増える。27,434件を全て GPU 完了 frame と断定しない。最後の `waitUntilCompleted()` と画素readback は1800.2710秒の検査。165地点のfinite検査は全文字・全時刻・文字quad・intakeの網羅検査ではない。非空画素は端切れ、文字の読みやすさ、意図どおりの色・姿を保証しない。

3回の更新では旧ID/text/ink/intakeSeedとatlas tile IDの保持を照合する。batch全体、born時刻、inputIndex、入力時の全工程時間、ファイルへ保存して再起動する履歴は検査していない。`historyRead/historyWrite=false`なので、これは日記保存の耐久試験ではない。

旧Swift textureの弱参照0は、driverやプロセス全体のRAM解放と同義ではない。資源は凍結R5のoffscreen engine単体で、窓、WindowServer、16GB laptop、GPU使用率・電力を含まない。小窓CPU5%/200MiB達成の根拠へ置き換えない。

`result.json`、終了時の`submit-histogram.json`、samplerの`resource-cpu-intervals.json`がない。NDJSONは全364行をparseできたが、終了記録はない。engineとsamplerが同時期に消えたという事実だけから、sessionの回収、signal、crash、OS状態、ツールの寿命制限のどれが原因かは決められない。sampler終了時の`finally`だけに依存したファイルは、強制終了では残らないこともある。診断JSONのwrite失敗はstderrへ出すだけの実装なので、ファイル欠落自体を特定のcrash証拠にもしない。

## 次の実行の方針

旧runへ追記・再開して2時間と足し合わせない。新run名・新PID/開始時刻・新出力先で7200秒を最初から行い、R5 shaderは凍結のまま使う。

今回の接続は結果を読む窓に限定し、試験本体の寿命をその接続から分ける設計が望ましい。短期案は別の持続する実行主体から開始し、stdout/stderr/終了コードをrunごとのsidecarへ保存する。`nohup`が保護するのはSIGHUPであり、外側がプロセス群を終了する場合まで保証しない。Appleの長期設計は per-user `launchd` agentだが、ログアウト時は終了する。この調査でagent登録・OS設定変更はしていない。[Appleのlaunchd設計](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)、[Appleの設定形式](https://github.com/apple-oss-distributions/launchd/blob/main/man/launchd.plist.5)。

試験用ならrunごとに一度だけ実行し、自動無限再起動を避ける。UIや原文保存のアプリ常駐とは別のジョブ。再起動が必要なら別attemptとして記録する。起動方法を選ぶ際は、この端末の `nohup(1)` / `launchd.plist(5)` を確認する。今は設計・読取だけで、新プロセスの起動/停止・GPU負荷・UI・Git操作は行っていない。

詳細な実行前・実行中・終了時のチェック案は[再現性チェック](REPRODUCTION-CHECKS.md)。

## rootによる別supervisorと新r2（04:31 JST）

返却後、新しい[supervise.py](supervise.py)をrootが追加した。既存run/attemptを拒否し、owned engine/sampler子ハンドルだけを管理。開始・source SHA・PID・stdout/stderr・終了codeを別attemptへ保存する。OS登録・設定変更・自動無限再起動はない。セッションを分けても存続は保証しない。

[30秒preflightと誤ったpathの拒否原票](evaluation/supervisor-preflight-r2/PUBLICATION.json)を保存した。最初は存在しないshaderを開始前に拒否。別名の修正preflightはengine/sampler exit0、450commit／30.007秒、MTL error/timeout/skip0。これはsupervisor経由で終了記録が作れた短期確認で、2時間結果ではない。

新r2のengine93049/sampler93050/supervisor93048は04:25:03開始、06:25:03予定。R5の凍結MSLを使い、旧runへ足し合わせない。[最新STATUS](../widget-metal-soak-v1/STATUS.md)。本走行完了と全検査は未確認。rootの実窓90秒比較とは別条件である。
