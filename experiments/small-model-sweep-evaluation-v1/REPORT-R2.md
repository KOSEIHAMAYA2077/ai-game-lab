# 追加小モデル・互換診断の独立評価 R2

2026-10-03 15:00 JSTの原票まで。元の [REPORT-R1](REPORT-R1.md)、R1manifest、人工24文、期待値、採点器は保持したまま、追加3モデルとruntime/templateの再試行を別labelで保存した。

**全26実行の最高全項目一致はBonsai4B Q1とPhi4-miniの17/24。標準widgetの採用条件は満たしていない。** Phi4-miniのqueryは約4秒で返ったが、sampled server RSS約5GiBを使い、全widgetや一般16GBノートの負荷は未評価である。モデルを増やしたこと自体を完成度や言語理解の達成とは扱わない。

## 件数と契約

- 当初20計画artifact、追加Phi3.5 / Phi4-mini / SmolLM3の3artifactで計23重み。
- PQ2専用Prism、BitNet patched、Phi3.5 no-jinjaの再試行3件を別に数え、計26実行。
- 22実行が各24件のHTTP200 model返信を返し、計528返信を採点。
- Phi3.5 defaultは24queryを処理したが、全件HTTP400でmodel本文なし。
- BitNet patchedはload後の最初のqueryが30秒でtimeout、残り23件は未試行。
- 共有runtimeのBitNet/PQ2はstartup failureで、各24件が未試行。

合計553query試行と71未試行で、26×24=624の固定機会数を保持する。実際のmodel返信528件だけを意味診断できる。reply実行のlength終了・HTTP500は0件。Phi3.5のHTTP400×24、BitNetのquery timeout×1を隠して「全実行エラー0」としない。

今回もJSONの修復、追加モデルへのprompt調整、期待値やscore.pyの変更は0件。元の24件を保持した比較で、新たな24文のfresh試験を増やしたという意味ではない。追加モデル・互換診断の選択は最初の実行計画の20artifactとは別の段階として記録する。

## 追加結果

形名 / 比喩 / 属性 / holdは各6。意味本文のない実行には全一致を表示せず、runtime・grammar失敗と分ける。固定分母のscore JSONには0点と欠測を保持した。

| 別label | HTTP200 model返信 | 厳密形式 /24 | 全一致 /24 | 形名 /6 | 比喩 /6 | 属性 /6 | hold /6 | 区分 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| [bitnet-2b-i2s-patched-cpu-r3](results-r1/bitnet-2b-i2s-patched-cpu-r3-context.json) | 0 | — | — | — | — | — | — | patched runtime・timeout |
| [phi-3.5-mini-nojinja-cpu-r2](results-r1/phi-3.5-mini-nojinja-cpu-r2-context.json) | 24 | 22 | 12 | 5 | 0 | 6 | 1 | template互換診断 |
| [phi-3.5-mini-q4km-extra-cpu-r1](results-r1/phi-3.5-mini-q4km-extra-cpu-r1-context.json) | 0 | — | — | — | — | — | — | default grammar非互換 |
| [phi-4-mini-q4km-extra-cpu-r1](results-r1/phi-4-mini-q4km-extra-cpu-r1-context.json) | 24 | 22 | 17 | 6 | 4 | 5 | 2 | 追加artifact初回 |
| [smollm3-3b-q4km-extra-cpu-r1](results-r1/smollm3-3b-q4km-extra-cpu-r1-context.json) | 24 | 24 | 12 | 6 | 0 | 3 | 3 | 追加artifact初回 |

Phi3.5 defaultのdriver `status=completed` は、batchを最後まで処理した意味であり、24返信の成功ではない。保存summaryのHTTP statusとreply件数を併読する。no-jinjaの12/24は別driver/templateの診断で、元の非互換を削除したり、同条件の初回結果へ置き換えたりしていない。

BitNet patchedはowned SIGTERM後の待機で終了せず、owned SIGKILLへ進み、exit -9。正常なアプリ終了や数値kernelの正しさを証明しない。query全体のtimeoutの原因をこの採点担当は断定していない。

## 追加候補の保存された値を読む診断

厳密な5キーJSONの各フィールドを、他のフィールド誤りを無視して読む追加診断である。主得点や採用可能な返信数ではなく、修復後の精度でもない。propose対象shapeの分母は18、フィールド単独の分母は24。

| 候補 | action /24 | shape /24 | color /24 | count /24 | motion /24 | propose shape /18 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [phi-3.5-mini-nojinja-cpu-r2](results-r1/phi-3.5-mini-nojinja-cpu-r2-diagnostics.json) | 21 | 19 | 20 | 23 | 15 | 18 |
| [phi-4-mini-q4km-extra-cpu-r1](results-r1/phi-4-mini-q4km-extra-cpu-r1-diagnostics.json) | 20 | 19 | 20 | 23 | 21 | 17 |
| [smollm3-3b-q4km-extra-cpu-r1](results-r1/smollm3-3b-q4km-extra-cpu-r1-diagnostics.json) | 14 | 13 | 16 | 20 | 18 | 10 |

## 起動・query・server RSS

同一Apple M5 / 32GiB上の保存値だが、再試行はtemplate/runtimeが違う。query時計はstartup・download・描画を除く。p95は24件のnearest-rank。server RSSは約250ms標本、driver/UI/OSを含まず、圧縮重みのdiskサイズとは違う。

| 別label | startup 秒 | HTTP200 reply p95 秒 | sampled server peak MiB | HTTP status / timeout |
| --- | ---: | ---: | ---: | --- |
| [bitnet-2b-i2s-patched-cpu-r3](results-r1/bitnet-2b-i2s-patched-cpu-r3-context.json) | 1.174 | — | 1371.5 | query timeout1/残り23未試行 |
| [phi-3.5-mini-nojinja-cpu-r2](results-r1/phi-3.5-mini-nojinja-cpu-r2-context.json) | 1.772 | 4.911 | 5392.9 | HTTP200×24 |
| [phi-3.5-mini-q4km-extra-cpu-r1](results-r1/phi-3.5-mini-q4km-extra-cpu-r1-context.json) | 1.897 | — | 5232.6 | HTTP400×24 |
| [phi-4-mini-q4km-extra-cpu-r1](results-r1/phi-4-mini-q4km-extra-cpu-r1-context.json) | 1.887 | 3.972 | 5152.0 | HTTP200×24 |
| [smollm3-3b-q4km-extra-cpu-r1](results-r1/smollm3-3b-q4km-extra-cpu-r1-context.json) | 1.455 | 3.477 | 3944.4 | HTTP200×24 |

約4〜5秒のqueryは、ユーザーが許容したモデル生成から文字の形成まで30秒の達成を証明しない。rawでは文字表面へ接続しておらず、温まったfile cacheのCLI比較である。高い一時RAMを許す任意の手動実験と、仕事中の低資源widgetへの標準採用も分ける必要がある。

## BitNet patchの独立source確認

[最初のsource review](BITNET-PATCH-SOURCE-REVIEW-R1.json)では、元と新のggml-cpu.cの変化が一つのstride条件だけであることを確認。LLAMAFILE条件内にしかない `src1_cont` 参照を、同じ純読み取りpredicate `ggml_is_contiguous(src1)` へ置換しており、非LLAMAFILE buildのscope修正として妥当と判断した。

rootが後から示したmetadataの正しい名前は `BITNET-PATCH-R3.json`。MACはdiff名だけに入るため、最初のreviewでmetadata未確認だった事実を保持し、[metadata追認R2](BITNET-PATCH-METADATA-REVIEW-R2.json)へ別記した。旧SHA・新SHAはroot metadataと独立reviewで一致。担当はbuild・kernel・modelを実行していない。

full source tree・build options・SIMD tensor kernelの数値一致・特殊layout・全shapeのfinite出力は独立未検証。patched static BitNetを公式の無変更runtimeと呼ばず、主たるmainline比較と違う群で扱う。loadやcompile成功だけでkernel正しさを合格にしない。

## 保存された入力と返信の照合

[CHECKPOINT-R5](results-r1/CHECKPOINT-R5.json)に全26実行の主採点、[diagnostics](results-r1/CHECKPOINT-R5-diagnostics.json)に追加の値診断、[export audit](results-r1/CHECKPOINT-R5-export-audits.json)に553保存requestと528元HTTP contentの一致を保存。requestは固定prompt＋本文だけ、expected/rationale/groupを含めず、成功したraw_textはHTTP message.contentと完全一致した。

全26summaryはfinal shutdownを持ち、採点時のrunningは0。初回凍結の6評価ファイルのSHAは全一致。元R1の107返却payloadは保持する。担当のモデル起動・download・GUI・HTTP・kernel呼出しは0件。

[公開人工export](PUBLIC-EXPORT-AUDIT-R2.json)は26ファイル、元のraw bytesと同じSHAで、download・推論なしで主採点を再現できる。553 JSONL recordには失敗25行が含まれ、すべてがmodel本文ではない。別のshape-only fixture・契約で得た216返信は、この528返信へ合算しない。

## 次の判断

当初提案のpilot gateは、このpositive18・hold6では合成して全一致23/24以上が必要。追加候補やno-jinja診断にも合格はない。色・動作の補完、否定や普通の仕事文の誤propose、見た目比喩の取り違えが残る。

文章の形の提案と、明示属性の抽出、現在形を保持する判断を分ける案は引き続き有効な次の比較仮説。既読の24文へ後処理を合わせても、新しい独立精度とは呼ばない。新しい評価文・実widget・実16GB機・人による仕事中の連想を別に確かめるまでは、既存の公開根性版を標準として維持する。
