# 固定24文・全26実行の台帳

元の実行順による比較は独立REPORTを参照。この表はlabel順であり、総合順位ではない。返信なしの結果を意味精度0と同列にしない。

| 実行label | 群 | 本文返信 | 全5属性一致 | 厳密形式 | 保留文への誤提案 | 返信p95秒 | server peak MiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bitnet-2b-i2s-cpu-r1 | initial-common-runtime | 0/24 | 未評価 | — | — | — | 0.9 |
| bitnet-2b-i2s-patched-cpu-r3 | separate-patched-bitnet-runtime | 0/24 | 未評価 | — | — | — | 1371.5 |
| bonsai-1.7b-q1-cpu-r1 | initial-common-runtime | 24/24 | 3/24 | 23/24 | 5/6 | 1.481 | 819.8 |
| bonsai-4b-q1-cpu-r1 | initial-common-runtime | 24/24 | 17/24 | 24/24 | 2/6 | 3.432 | 1497.7 |
| bonsai-8b-q1-cpu-r1 | initial-common-runtime | 24/24 | 6/24 | 20/24 | 3/6 | 6.197 | 2501.8 |
| granite3.1-1b-moe-q4-cpu-r1 | initial-common-runtime | 24/24 | 2/24 | 23/24 | 5/6 | 0.793 | 1730.1 |
| granite4-1b-q4-cpu-r1 | initial-common-runtime | 24/24 | 14/24 | 24/24 | 5/6 | 2.404 | 2246.0 |
| lfm2-350m-q4-cpu-r1 | initial-common-runtime | 24/24 | 0/24 | 18/24 | 3/6 | 0.418 | 585.8 |
| lfm2-700m-q4-cpu-r1 | initial-common-runtime | 24/24 | 0/24 | 11/24 | 0/6 | 0.825 | 1044.2 |
| lfm2.5-1.2b-q4-cpu-r1 | initial-common-runtime | 24/24 | 5/24 | 24/24 | 6/6 | 1.190 | 1541.7 |
| lfm2.5-1.2b-qad-q4-cpu-r1 | initial-common-runtime | 24/24 | 3/24 | 24/24 | 6/6 | 0.947 | 1471.9 |
| phi-3.5-mini-nojinja-cpu-r2 | seen24-template-diagnostic | 24/24 | 12/24 | 22/24 | 3/6 | 4.911 | 5392.9 |
| phi-3.5-mini-q4km-extra-cpu-r1 | post-initial-selection-extra | 0/24 | 未評価 | — | — | — | 5232.6 |
| phi-4-mini-q4km-extra-cpu-r1 | post-initial-selection-extra | 24/24 | 17/24 | 22/24 | 3/6 | 3.972 | 5152.0 |
| qwen2.5-0.5b-q4-cpu-r1 | initial-common-runtime | 24/24 | 5/24 | 24/24 | 6/6 | 0.580 | 750.6 |
| qwen2.5-1.5b-q4-cpu-r1 | initial-common-runtime | 24/24 | 5/24 | 21/24 | 3/6 | 1.610 | 2048.2 |
| qwen3-0.6b-q8-cpu-r1 | initial-common-runtime | 24/24 | 6/24 | 23/24 | 5/6 | 0.725 | 1602.3 |
| qwen3.5-0.8b-q4-0-baseline-cpu-r1 | initial-common-runtime | 24/24 | 1/24 | 13/24 | 3/6 | 0.808 | 1376.2 |
| qwen3.5-0.8b-q4-cpu-r1 | initial-common-runtime | 24/24 | 5/24 | 24/24 | 2/6 | 1.002 | 1316.5 |
| qwen3.5-2b-q4-baseline-cpu-r1 | initial-common-runtime | 24/24 | 9/24 | 24/24 | 1/6 | 2.069 | 2744.5 |
| smollm2-1.7b-q4-cpu-r1 | initial-common-runtime | 24/24 | 3/24 | 23/24 | 5/6 | 2.030 | 2524.2 |
| smollm2-360m-q8-cpu-r1 | initial-common-runtime | 24/24 | 1/24 | 24/24 | 6/6 | 0.500 | 936.2 |
| smollm3-3b-q4km-extra-cpu-r1 | post-initial-selection-extra | 24/24 | 12/24 | 24/24 | 3/6 | 3.477 | 3944.4 |
| ternary-bonsai-1.7b-g64-cpu-r1 | initial-common-runtime | 24/24 | 3/24 | 24/24 | 6/6 | 1.879 | 929.6 |
| ternary-bonsai-1.7b-pq2-g128-cpu-r1 | initial-common-runtime | 0/24 | 未評価 | — | — | — | 0.9 |
| ternary-bonsai-pq2-prism-cpu-r2 | separate-prism-runtime | 24/24 | 4/24 | 24/24 | 6/6 | 4.742 | 871.1 |

保留文への誤提案は厳密形式が有効な返信だけを数える。0/6でも形式失敗・返信なしがあれば安全や保留成功の証明にはならない。

26実行は23種類の重みに再試行3件を加えたもの。528本文返信、HTTP400による本文なし24件、timeout1件、未試行71件を分けて記録。startup失敗時のRSSはロード前の過程であり、モデル常駐RAMではない。

p95は成功HTTP返信のnearest-rank。起動・取得・描画・shutdownを含まず、起動前hashによるfile-cache warmingがある。RSSは250ms標本のserver単独値、UI/driver/OS/消費電力は含まない。

[機械可読集計](RUNS-R1.json) / [独立採点と互換診断](../small-model-sweep-evaluation-v1/REPORT-R2.md)
