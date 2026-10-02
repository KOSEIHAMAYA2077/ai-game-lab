# 再実行の観測を切り分ける案

2026-10-03。未実装の設計。既存ハーネス・実行物は改変していない。

## 実行前

1. run/attemptの一意名、新出力先、frozen shader/source/helper SHAを記録。既存run・resultがあれば停止し上書きしない。
2. 起動主体、PID、プロセス開始counter、実行物SHA、UTCとmonotonic開始を記録。PIDだけで再利用を判定しない。
3. lifecycle記録、stderr、samplerの観測先を別名で指定。raw resource NDJSONは一行ごとにflushし、再監視は別monitor-attemptへ書く。
4. 原文履歴の読取/書込なし、人工入力、400×440、1,536描画、15fps、境界600秒、画素180秒、7200秒を再確認。加速preflightを本試験へ混ぜない。

## 接続とは別の寿命・監視

- workerを所有する持続的な実行主体と、結果を読むmonitorを分ける。外側のobserverが消えてもworkerが動いたことを、次のobserverがファイル/PID開始counterから確認する。
- supervisorは worker の終了を `wait` で受け、exit code/signal/UTCを `supervisor-exit.json` などに記録する。supervisor自身が消えればその記録も失われるので、欠落を成功に読み替えない。
- 再監視では既存sampleファイルを置換せず、新monitor-attemptに追加。前monitorの最終counterと次monitorの最初のcounterで、観測の空白を明示する。CPU区間は同じ開始counterの場合だけ接続できる。
- `worker progress古い / process生存`、`process消失 / resultなし`、`resultあり / supervisor exitなし`、`process開始counter変更`を別状態とする。進行の古さだけで無許可のkillや再起動はしない。
- 将来の観測版ではphase=`mutation/submit/GPU-wait/readback/checkpoint/drain`と最終成功時刻を数値で記録すると、どこまで到達したかが残る。freeze R5と混ぜず新観測版として比較する。

## 判定の単位

| 記録 | 判定できるもの | 判定できないもの |
| --- | --- | --- |
| command commit counter | CPUがsubmitした件数・cadence | 全件GPU完了、画面presentation FPS |
| completed counterとerror | 完了handlerまで進んだ件数 | 見た目、全shape/材料の有限性 |
| draw wait + pixel readback | その検査時点の描画完了・非空画像 | 全時刻の品質、clip/字形/色意味の完全性 |
| boundary照合 | 調べたID/text/ink/seed/tileの保持 | 未検査metadata、日記のディスク保存 |
| NDJSON process counter | 同一PID開始counterのCPU/RSS/charged footprint | 全system RAM、GPU/電力、小窓全体予算 |
| atomic progress | 最後に成功した一つのcheckpoint | 正常終了、強制終了時の全状態 |
| drained final + supervisor exit | 予定時間到達と実終了を突合 | 未検査の見た目・任意のPC性能 |

## 終了時

1. `result` のrequested/actual時間をUTCとmonotonicで突合する。時間の空白・sleep等の因果は数値だけから推測しない。
2. queue drain後の最終GPU完了件数・MTL errorを記録。drain前のcompletedを最終保証にしない。
3. boundary/check/pixel/finite件数、ID保持、texture・資源の傾向、CPU区間の欠測を照合する。予定境界の件数はループが時刻終了を先に判定する実装に合わせる。
4. final書込成功とsupervisorのexit codeを照合。resultなしは中断/不明、signal終了は別記録。`completed`だけを品質合格にしない。
5. 旧attemptのSHAと原票を保ち、途中結果を新attemptへ足さない。実窓・IME・保存再起動は別ハーネスで確認する。

## 小さい確認から

次のrootの実装では、まず30秒の新attemptで通常終了、monitor接続を終えて再接続、worker消失時のobserver分類、write失敗の診断を人工fixtureで確認する。その後に7200秒本試験。これらは提案であり、今回この担当は起動・停止・fault injectionを行っていない。
