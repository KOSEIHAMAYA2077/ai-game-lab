# 固定 native R5 CPU CLI・100分観測の独立監査

保存済み原票を固定helper R2で照合した。driver elapsed6000.0133435秒、通常20＋長文4の24返信、予定ps標本600/600有効・欠測0、正常exit0・failureなし、固定source/model8件のbyte/SHA一致を確認した。追加native/model/ps/UI/OS実行は0である。固定CLIの一回の100分観測であり、8時間動作、実ウィンドウ、全アプリ入力、一般16GB PC、意味精度、人間の快適さの達成値とは呼ばない。

|照合項目|結果|母数・意味|
|---|---:|---|
|通常照会|20/20返信|4人工短文を300秒ごとに再利用。mean/vector各128、ranks60、holdなし|
|long4000|4/4返信|球4000scalar→4001tokens、token_limit、mean/vectorなし、ranks0|
|合計返信|24|異なる経路を足した受信件数。長文rank完了24件ではない|
|ps有効標本|600/600|10秒予定の離散観測、欠測0|
|source/model固定入力|8/8|終了時のbyte/SHA再照合|
|driver終了|exit0 / failureなし|EOF後のunexpected outputもsourceの検査で報告なし|

長文4件はトークン化と保留境界の観測である。「4000文字のembedding・rankingを4回完了」とは記載しない。通常20件も既存の短文を再利用した稼働観測であり、前の独立20+4 parity、作者709既知回帰、wire20payload21replyと母数を合算しない。意味の正解ラベルや人間評価はない。

観測枠・標本・照会・EOFは別時点だった。最初のps標本はmonotonic0.047959625秒、最後は5990.103960833秒、標本の最初から最後の区間は5990.056001208秒である。driver終了までの残り9.909382667秒はpsで連続測定した区間ではない。最後の通常照会は予定5700秒・推定受信5700.166890416秒で、終了より299.846453084秒前だった。最後の長文は予定5400秒だった。sourceは6000秒の期限到達後にstdinをcloseしてexitを待つが、EOFの厳密なtimestampは保存していない。

nativeのtime -l real5999.96秒はdriverのelapsedより0.0533435秒短い。driver UTC start/endの差5999.906106秒とmonotonic elapsedには0.1072375秒差がある。予定・deadline判定はmonotonicを使い、UTCの差を同じclockの失敗と扱わない。clock差の原因を独立に実測したものでもない。

|資源指標|保存値からの再計算|範囲|
|---|---:|---|
|native time -l user＋sys|0.05秒|native子processだけ、表示精度0.01秒|
|上のCPU / native real|one-core 0.000833338889%|初期化＋照会＋長いstdin待機を含む単一run|
|psの丸めTIME差 / 標本区間|0.02秒 / 5990.056001208秒 = one-core 0.000333886695%|最初の標本以前・最後以降を含まない。上の値へ混ぜない|
|ps RSS peak|44,531,712B（42.46875MiB）|600離散標本。time -l最大RSSも同じ値|
|返信physicalFootprintBytes peak|34,652,664B（約33.05MiB）|24返信時点だけ、全100分の連続charged標本ではない|
|time -lのpeak memory footprint|35,127,800B（約33.50MiB）|原票のこのラベルをそのまま採録。返信時footprint/RSSとは別欄|

sample間隔は599区間で9.582848083〜10.170587333秒、平均10.000093491秒。時刻はstrict増加、丸めた累積CPUは非減少だった。通常RPCは0.536291〜22.364834ms（初回22.364834ms）、長文hold RPCは2.873625〜3.769167msだった。これらはpipe送受信・JSON等を含むdriverのreceipt時間であり、純粋なtokenizer・embedding kernel計時ではない。

非常に小さいCPU比は主に300秒間隔の入力の間に待つ今回の観測条件を示す。連続推論負荷、rendererと連動した常駐アプリ、電力、省電力core利用、熱、UIフレームレート、Windows・16GB laptopの保証には使わない。driverやps、並行した他のCPU作業・build等をnativeのCPU/RAMへ加算しておらず、無負荷のPCで測ったとも主張しない。RSS/footprintはunique RAMやwhole widget/host RAMではない。

初稿独立helper R1は「ids数は常に4000以下」という余分な仮定から途中原票1件をFAILにした。原票・sourceは保持し、hold/token_limitとrank0の境界に合わせた別helper R2で算術を訂正した。rootのsource・fixture・閾値・予定を変更していない。[訂正履歴](HELPER-CORRECTION-R2.json)、[初回途中記録](INTERIM-01.json)、[R2途中記録](INTERIM-02.json)を残し、初稿失敗を初めから成功だった扱いにしない。helper R2の最終結果は修正済み算術であり、新しいmodel成功ケースではない。

監査METHODはrootのrun開始後、途中原票を見る前に固定した。run開始前の独立事前登録とは呼ばない。root自身の実行METHOD/fixture/freezeの時系列とは区別する。[最終helper freeze](FINAL-AUDIT-HELPER-FREEZE-R2.json)は最終原票の前に固定し、最終call前にbyte/SHAを再照合した。

source reviewに残る汎用harnessの制約は[PRECHECK](PRECHECK-R1.md)へ保持する。初期PID discoveryがtry/finally外、writeの戻りbyte未照合、source内PID/PPID照合はあるが標本へprocess start identityは保存しない、progress JSONはatomic保存でない、freeze失敗ならsummary欠落が起こり得る、失敗cleanupのnumeric PID再利用境界を独立証明していない。今回RUN/summary/freeze/返信が揃った事実と一般cleanup保証を分ける。old R5の外側入力frame上限未実装というsource境界は後発wire候補の別研究で扱うが、このrunをそちらへ付け替えない。

[FINAL-01](FINAL-01.json)のcompletion=trueはこの固定CLIの保存原票が予定返信・正常終了・source不変・time -l存在に一致したという照合である。有限時間の離散標本から「メモリリークがない」「無期限に安全」とは結論しない。ここでの採否はsource変更や既定model採用の許可ではない。

[最終境界の補足算術](FINAL-BOUNDARIES-R1.json)はtime -lのpeak memory footprintとclock区間を最終原票から追加読取した事後診断で、既存gateやhelperを変更していない。原票そのものは[観測folder](../native-static-longrun-v1/)、独立結果はこのfolderに保存する。公開候補は人工文・数値・相対source参照のみで、実ユーザー本文や個人絶対pathは含めない。
