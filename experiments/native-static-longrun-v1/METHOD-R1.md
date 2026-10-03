# Native StaticEmbedding の短期常駐補足 R1

目的は固定 R5 CPU CLI を100分間保持し、人工 query の間でメモリとCPU時間がどう推移するかを記録すること。UI/描画/OS入力のない独立 process であり、全widget、省電力、意味精度、16GB Windows、8時間利用を実証しない。

- candidate NativeStaticR5.swift / native-static-r5 と既取得 tokenizer /128F16 table/captions はimmutable・read-only。モデル取得・変更・学習・新しいsemantic採点なし。
- 100分＝6000秒。初回1 query後、300秒間隔で人工4文を順に循環。入力1件ごとにJSONL返信を待つ。終了時stdin EOFで通常終了する。
- 通常queryとは別に、開始直後と30/60/90分で4000 Unicode scalarの人工反復文を1回追加。これは最大時間・全言語の保証ではない。
- timeoutは各返信15秒。driverが受け取る1返信は1MiB上限（native自体の外側入力frame boundの代替にはならない）。原票を残し、timeout時はowned childだけ停止。自動再試行・candidate修正なし。
- 10秒ごとにnative PIDだけのps resident/累積CPU時間を取得。query replyのtask_info physical footprint/maxRSSは別標本。/usr/bin/time -l終了時max resident、user+system CPUと実elapsedを別に報告。
- nativeは実測で作った子process、親driver/time wrapperはRAM/CPU母数外。CPU百分率は1core基準（native user+system / native elapsed）。ps TIMEの丸めがあるため短い区間の0秒はCPU完全0の証拠にしない。
- 並行の別実験・Git・資料監査がある通常hostで、CPU競合を統制した試験ではない。作者短batchや旧Pythonとは同一workload対の因果比較をしない。
- 出力は人工文とnative診断だけ。実本文・window title・clipboard・OS keyboard APIは取得しない。保存に本物の執筆本文を入れない。
- 実行前にsource/binary/model/captions/METHOD/driverのSHAを固定し、別のRUN recordへ開始PID/UTC、終了・失敗・標本母数を残す。

最後のsample、scheduled query、process終了の時刻差を示す。missing/partialは隠さない。idle中のresident増加が小さくても、memory leakが存在しない証明にはしない。
