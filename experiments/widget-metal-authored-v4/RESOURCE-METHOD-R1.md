# v4資源判定（結果前）

v3の通常窓資源**結果は未読**。rootのv3 METHOD-R1.jsonと共通研究budgetだけを確認し、次の予算を凍結する。M5 32GiB Macでの比較であり、Windows16GB/iGPUの達成を意味しない。実測はroot所有の別runで行う。

- 400×440、同seed/人工template/1537stored・1536drawn/白、静穏15fps、入力/推論/保存読み書きなし。
- main PIDを起動時刻と実行物SHAで特定。user+system CPU差分／monotonic elapsed、100%は1論理core。calm mean≤5%、charged footprint≤200MiB。residentは別列。
- CPU submit wall-time p95≤3msを追加candidate gateにする。これはprocess CPU percentやGPU execution ms、実present FPSとは違う。
- 通常形のsphereを対照、新rig魚→鳥→蛇を各10秒warm＋90秒sample。sphereだけ60秒warm。最後にpause/hidden各30秒。時刻/viewport/shape/frames/poseUpdates/scheduledを原票に含める。
- 1body draw/1536、instance80B、旧uniform336B、新fixed rig uniform1200Bの不変を確認。成分のbyte和をwhole-process RAMと呼ばない。
- pause/hideでは時間とframe/pose更新を停止。再表示pausedは表示回復の一度のdirty drawを区別し、timerが再開していないことを確認。CPUがゼロになったという主張はempty対照・検出限界が必要。
- build/GPU/重い検証をquiet sampleに並走させない。既存R5 soak終了後の試験であるか、並走条件が残るかをrootが記録する。

形別のGPU differential費用が予算を超えたらstageを保留し、結果に合わせて予算を緩めない。16形品質/数値と通常窓資源は別gate。電力・GPU利用率・8時間常用・生産性・快適性は本予算だけで合格にしない。
