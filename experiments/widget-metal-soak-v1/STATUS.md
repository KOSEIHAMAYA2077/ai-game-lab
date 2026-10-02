# 最新: 2026-10-03 07:05 JST — 別r2完走

新r2はengine7,200.009秒/108,000commit、engine/sampler exit0、40pixel/600finite集計、MTL/timeout/skip0。root確認時own3PIDは終了。独立原票監査はhelper修正後11/11一致、初回10/11も保持。resource valid7,197.237秒CPU0.499%・charged peak127.095MiB、終了境界欠測1。旧初回約30分を合算せず、実窓/13・16形/8時間/16GB機と区別する。詳細は [回復と完走記録](../widget-metal-soak-recovery-v1/REPORT.md)。

以下は前の状態の履歴。

## 2026-10-03 04:31 JST — 別r2を走行中

旧r1は約30分で中断、原因不明・finalなし。元のrunning原票を保持し、終了コードを残す専用supervisorで別r2を開始した。新supervisor PID93048、engine93049、sampler93050。開始04:25:03 JST、要求7200秒、予定06:25:03 JST。`.local/metal-soak-2h-r2/` と別attemptへ出力。新30秒preflightはengine/sampler exit0、450commit、14.9963/s、MTL error/timeout/skip0、1pixel/15finite成功。最初のsupervisor preflightはshader path誤りを開始前に拒否し、そのstderrを残した。

新本走行はまだ未完。凍結R5 shaderのoffscreen engineのみで、Metal v2実窓、入力取得、保存耐久、GPU使用率／電力、8時間安定性の結果ではない。session分離は外部要因による終了を防ぐ保証ではなく、終了コードと最後の原票を突合する。[回復・supervisor](../widget-metal-soak-recovery-v1/REPORT.md)。所有プロセス以外は止めない。新担当はlaunch/child-identity/exit/run/progressを合わせ、期限後に結果を記録する。

以下は保持したr1履歴。

# 最新: 2026-10-03 03:43 JST — 中断として保存

2時間の予定走行は完了していない。PID83137/83230は存在せず、元exec sessionも取得不能、result.jsonはない。最後のengine記録は1828.87秒、資源の有効区間は1819.40秒。停止原因は不明。原票を [evaluation/interrupted-2h-r1/](evaluation/interrupted-2h-r1/) へ複製し、runningと記された元JSONも書き換えず保持した。これはoffscreen一processの記録で、実窓・2時間安定性・8時間安定性の証拠ではない。

以下は走行開始時点の記録。

# 2時間offscreen継続試験

2026-10-03、継続中。通常の窓アプリ性能ではなく、凍結R5のGPU描画とCPU状態の信頼性を確認する。既存版・保存・原票を変更しない。

- 30秒cadenceと30秒加速境界検査が完了、各450frame。3形・文字追加・atlas成長・旧ID/色/tile保持・旧texture object解放を確認。
- 本走行の実PID **83137**、exec session **36101**。
- 開始 **2026-10-02 17:35:33 UTC / 2026-10-03 02:35:33 JST**。
- 終了予定 **2026-10-02 19:35:33 UTC / 2026-10-03 04:35:33 JST**。
- 資源sampler PID **83230**、exec session **1218**。明示された同一PIDだけを5秒毎に計測。
- run出力はrepo内の **`.local/metal-soak-2h-r1/`**。helperは **`.local/metal-soak-helpers-r5/`**。ハーネス／source／実行物SHAはevaluation/harness-manifest.json。
- 初回2分では約15fps、MTL error0、in-flight timeout0。まだ10分境界にも2時間完了にも達していないため、完了・採用とは記さない。
- 凍結R5 MSL SHA256: `e3416ddc373018f7dfb7359efe4f55779949ce4f5185b7862a000ef0cdebde9a`。約7分38秒時点は6,879frame、15.002fps、MTL error0、timeout0、deadline skip0。長時間完了の結果ではない。

## 終了・中断の条件

- 通常は7200秒でハーネスが終了記録を書いて自動終了する。samplerはresultまたは実PIDの終了を確認して終了する。次の入力API調査へ移っても、走行の期限は04:35:33 JSTのままとする。
- MTL error、非有限座標、空の描画、旧ID／文字／色／atlas tileの不一致が出た場合はfailed原票を残し、採用を保留する。progressが120秒以上更新されない、timeoutが増え続ける、PIDが消失する場合は担当が状態を確認して中断として記録する。
- 手動で停止する必要がある場合は、run.jsonのPID・プロセス開始時刻・実行パスを突合し、今回所有する83137と83230だけを対象にする。PID再利用なら停止しない。他のアプリ・GPU compiler・caffeinateを停止しない。
- atlas／fontの成長でRAMが段階的に増える想定がある。固定atlas後も増加が続く場合、またはheadlessのcharged footprintが継続して512MiBを超える場合は、rootが原票を確認して今回の所有プロセスを止める判断をする。これはwidget予算達成／未達の判定ではない。
- 補助担当はcaffeinateを起動していない。PID82495（`-di`）はこの担当の所有ではなく、用途・期限を推測せず停止もしない。

## 次の担当へ

1. `run.json`と`progress.json`のPID／scope／期限を確認する。本人のMacロックを解除しようとしない。このハーネスはUI不要。
2. 意味のある区切り（最初の10分atlas更新、30分、1時間、期限後）でprogress・boundary・pixel/finite・resourceを読む。toolの待ちは60秒以下、長時間はsessionを保持して別作業する。
3. 期限後は`result.json`の実elapsed/frame/errorと、resource-summaryの終端を突合し、該当するsessionを短くpollしてexitを確認する。progressは最後のactive地点で、resultが終了の記録。
4. 実行が消失したらPID reuseを確認し、既存runは再開／上書きしない。必要なら新run名で再試験し、中断した原票も残す。
5. 完了と採否をREADME/STATUSへ追記し、rootが公開する場合は新しい版の区切りで反映する。**offscreenのCPU/RAMをwindow widgetの5%/200MiB達成として使わない。**

補助担当による編集を終え、2026-10-03 02:43 JSTにexperiments/widget-metal-soak-v1の所有、監視と結果の統合をrootへ返す。走行とsamplerは独立execとして継続中。追加のOS設定・入力監視・有料API・履歴送信はない。
