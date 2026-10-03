# BitNetの短い要求だけを試す診断

固定24文の大きな要求では最初の1文が30秒timeoutだったため、計算領域を変えた別実行で、短い人工要求を1文だけ試した。**HTTP返信は得られたが、指定した単語には一致しなかった。** この1件を固定24文の成功や、新しい未見精度として加算しない。

| 項目 | 結果 |
| --- | --- |
| system | `Return exactly the single word sphere.` |
| user | `球体` |
| 元の返信 | `@@@@@@@@` |
| HTTP / finish reason | 200 / length |
| HTTP全文返信時間 | 5.074636秒 |
| server報告tokens | prompt21 / completion8 |
| server報告prompt処理 | 3726.387ms / 5.6355tokens/sec |
| sampled server peak RSS | 1304559616B、約1244.1MiB |
| 所有process終了 | SIGTERM、exit0 |

同じ固定BitNet重み・別copyのMac修正runtimeで、context512、batch64、ubatch32、出力上限8、CPU4threads、GPU/offloadなし、JSON grammarなし。短い要求でも用意した回答を返さず、出力上限にも達している。これ以上出力を伸ばした場合の結果は未測定。

旧GGUFのpre-tokenizer typeが欠けているとの警告が出た。今回のbuildではTL1/TL2を無効にしてI2_S経路を使用しており、他の最適化構成やIntel/AMDの性能を表さない。警告・build互換・prompt長・出力上限の影響を切り分けていないため、BitNet一般の能力不足や全実装の遅さとは断定しない。修正kernelの数値的正しさも未検証。

長い要求の失敗は[固定24文の独立報告](../small-model-sweep-evaluation-v1/REPORT-R2.md)へ保持。今回はその後の狭い互換診断であり、23重み・26実行の台帳には追加していない。別のshape-only/資源試験終了後に単独で実行した。

[事前凍結](FREEZE-R1.json) / [人工入力](case-r1.json) / [prompt](prompt-r1.json) / [元の人工返信](raw-public-r1.jsonl) / [provenance](PROVENANCE-R1.json) / [実行summary](results/bitnet-2b-i2s-micro-cpu-r1/summary.json)

同じ重みを再取得せず使った。個人本文・私的server log・端末絶対pathは公開していない。推論はローカルloopbackのみ。
