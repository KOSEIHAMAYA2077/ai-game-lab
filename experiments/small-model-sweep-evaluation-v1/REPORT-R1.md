# 小モデル21実行の独立評価 R1

2026-10-03 14:32 JSTの保存済み原票を集計。20計画artifactと、PQ2を専用Prism runtimeへ切り替えた1再試行を分けて数える。**12有限形の厳密契約では、現時点の最大はBonsai4B Q1の17/24。どの候補も標準widgetへ採用した結果ではない。**

新しい人工日本語24文を、最初のモデル返信を見る前に固定した。形名6・見た目と比喩6・属性複合6・hold6。rootとの相談に使った2文は除外し、例文のないpromptは評価本文をrootへ返す前に固定された。[方法](METHOD-R1.md)・[24人工文と期待値](cases-r1.json)・[凍結SHA](FREEZE-R1.json)・[相談2文の除外](consultation-examples-r1.json)。モデルによる期待値の採点や改変は行っていない。

## 何を数えたか

主指標は、元の返信全体が厳密JSONで契約を満たし、action / shape / color / count / motionの全5項目が期待値と一致する件数 / 固定24件。未指定color/motionはnull、countは1。holdはshape/color/motionをnullに戻す。コード囲いや説明文を除去したり、値を修復したりして主得点を上げていない。

19実行が24件ずつ返信を完了し、456件を独立採点。共有runtimeで起動しなかった2実行は、24件ずつ未試行であり、観測された意味誤答とは扱わない。原票の固定分母には0点として残すが、下の意味表から分ける。全21実行にはshutdown記録があり、採点時にrunningはない。reply実行のlength終了、HTTP500、query timeoutは0件。これは任意の長文や無制限の生成で失敗がないという意味ではない。

## 完了した返信の全項目一致

形名・比喩・属性・holdの列は各6件。形式は独立した厳密契約判定 /24。hold誤提案は形式を満たしたproposeだけを数えるため、形式違反が多い候補で0でも安全性を意味しない。

| 保存実行label | 形式 /24 | 全一致 /24 | 形名 /6 | 比喩 /6 | 属性 /6 | hold /6 | hold誤提案 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [bonsai-1.7b-q1-cpu-r1](results-r1/bonsai-1.7b-q1-cpu-r1-score.json) | 23 | 3 | 0 | 0 | 3 | 0 | 5 |
| [bonsai-4b-q1-cpu-r1](results-r1/bonsai-4b-q1-cpu-r1-score.json) | 24 | 17 | 6 | 3 | 4 | 4 | 2 |
| [bonsai-8b-q1-cpu-r1](results-r1/bonsai-8b-q1-cpu-r1-score.json) | 20 | 6 | 0 | 0 | 6 | 0 | 3 |
| [granite3.1-1b-moe-q4-cpu-r1](results-r1/granite3.1-1b-moe-q4-cpu-r1-score.json) | 23 | 2 | 0 | 0 | 2 | 0 | 5 |
| [granite4-1b-q4-cpu-r1](results-r1/granite4-1b-q4-cpu-r1-score.json) | 24 | 14 | 6 | 1 | 6 | 1 | 5 |
| [lfm2-350m-q4-cpu-r1](results-r1/lfm2-350m-q4-cpu-r1-score.json) | 18 | 0 | 0 | 0 | 0 | 0 | 3 |
| [lfm2-700m-q4-cpu-r1](results-r1/lfm2-700m-q4-cpu-r1-score.json) | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| [lfm2.5-1.2b-q4-cpu-r1](results-r1/lfm2.5-1.2b-q4-cpu-r1-score.json) | 24 | 5 | 2 | 0 | 3 | 0 | 6 |
| [lfm2.5-1.2b-qad-q4-cpu-r1](results-r1/lfm2.5-1.2b-qad-q4-cpu-r1-score.json) | 24 | 3 | 0 | 0 | 3 | 0 | 6 |
| [qwen2.5-0.5b-q4-cpu-r1](results-r1/qwen2.5-0.5b-q4-cpu-r1-score.json) | 24 | 5 | 3 | 0 | 2 | 0 | 6 |
| [qwen2.5-1.5b-q4-cpu-r1](results-r1/qwen2.5-1.5b-q4-cpu-r1-score.json) | 21 | 5 | 0 | 0 | 5 | 0 | 3 |
| [qwen3-0.6b-q8-cpu-r1](results-r1/qwen3-0.6b-q8-cpu-r1-score.json) | 23 | 6 | 3 | 0 | 3 | 0 | 5 |
| [qwen3.5-0.8b-q4-0-baseline-cpu-r1](results-r1/qwen3.5-0.8b-q4-0-baseline-cpu-r1-score.json) | 13 | 1 | 1 | 0 | 0 | 0 | 3 |
| [qwen3.5-0.8b-q4-cpu-r1](results-r1/qwen3.5-0.8b-q4-cpu-r1-score.json) | 24 | 5 | 0 | 0 | 1 | 4 | 2 |
| [qwen3.5-2b-q4-baseline-cpu-r1](results-r1/qwen3.5-2b-q4-baseline-cpu-r1-score.json) | 24 | 9 | 2 | 0 | 2 | 5 | 1 |
| [smollm2-1.7b-q4-cpu-r1](results-r1/smollm2-1.7b-q4-cpu-r1-score.json) | 23 | 3 | 0 | 0 | 3 | 0 | 5 |
| [smollm2-360m-q8-cpu-r1](results-r1/smollm2-360m-q8-cpu-r1-score.json) | 24 | 1 | 0 | 0 | 1 | 0 | 6 |
| [ternary-bonsai-1.7b-g64-cpu-r1](results-r1/ternary-bonsai-1.7b-g64-cpu-r1-score.json) | 24 | 3 | 1 | 0 | 2 | 0 | 6 |
| [ternary-bonsai-pq2-prism-cpu-r2](results-r1/ternary-bonsai-pq2-prism-cpu-r2-score.json) | 24 | 4 | 1 | 0 | 3 | 0 | 6 |

## 起動・runtimeの失敗は別枠

| 保存実行label | 状態 | 試行した文 | 未試行 | 意味精度 |
| --- | --- | ---: | ---: | --- |
| [bitnet-2b-i2s-cpu-r1](results-r1/bitnet-2b-i2s-cpu-r1-context.json) | startup_failed | 0 | 24 | 返信がなく未評価 |
| [ternary-bonsai-1.7b-pq2-g128-cpu-r1](results-r1/ternary-bonsai-1.7b-pq2-g128-cpu-r1-context.json) | startup_failed | 0 | 24 | 返信がなく未評価 |

PQ2共有runtimeの失敗と、専用Prism runtimeの24返信・4/24は異なる実行であり、失敗を上書きしていない。BitNet I2_Sも共有loaderの失敗であり、言語理解の弱さを観測した値とは扱わない。loaderやchat templateごとの互換性はroot側のsource・log記録と併読する。

## 形だけの一致と属性補完を分ける診断

次の値は、最初の保存返信を見た後に依頼された追加の原因分析であり、事前固定の主指標ではない。厳密に読めた5キーJSONの元の各値を読み、他属性の誤りを無視したshape単独一致を数える。期待値・採点器・値を変更しない。**修復後の精度や採用可能な返信数ではない。**

| 候補 | 全一致 /24 | propose対象のshape単独 /18 | 未指定colorの補完件数 | 未指定motionの補完件数 |
| --- | ---: | ---: | ---: | ---: |
| [bonsai-1.7b-q1-cpu-r1](results-r1/bonsai-1.7b-q1-cpu-r1-diagnostics.json) | 3 | 10 | 18 | 17 |
| [bonsai-4b-q1-cpu-r1](results-r1/bonsai-4b-q1-cpu-r1-diagnostics.json) | 17 | 14 | 3 | 2 |
| [bonsai-8b-q1-cpu-r1](results-r1/bonsai-8b-q1-cpu-r1-diagnostics.json) | 6 | 17 | 15 | 14 |
| [granite4-1b-q4-cpu-r1](results-r1/granite4-1b-q4-cpu-r1-diagnostics.json) | 14 | 17 | 9 | 2 |

Bonsai1.7Bでは形の取り違えに加え、要求されていない白・flowを補うことが多い。Bonsai8BとGranite4のshape単独17/18も、hold・色・動作の全体契約を満たした17/18ではない。形の提案、明示属性の抽出、hold判断を分ける実装は次の比較案になり得るが、この24文を見て後処理を合わせ、その値を新しい独立精度として発表してはいけない。

各候補のaction/shape/color/count/motion単独一致は、[追加診断一覧](results-r1/CHECKPOINT-R3-diagnostics.json)と各labelのdiagnostics.jsonに保存した。他属性エラーを無視した診断と、元の固定採点器が返す形式有効返信だけの単独一致を別のキーで保持する。

## 時間とメモリの読み方

Apple M5 / 32GiB上のCPU4 threadsで実行された保存結果を読む。replyの時計はモデル起動後からHTTP応答の受信までであり、初回download・モデル起動・文字表面の描画を含まない。inputファイルの事前hashでfile cacheが温まるため、startupは制御されたcold起動ではない。p95は24件のnearest-rank（小標本）で、一般的な遅延保証ではない。

| 候補 | startup 秒 | reply p95 秒 | server sampled peak MiB |
| --- | ---: | ---: | ---: |
| [bonsai-1.7b-q1-cpu-r1](results-r1/bonsai-1.7b-q1-cpu-r1-context.json) | 0.762 | 1.481 | 819.8 |
| [bonsai-4b-q1-cpu-r1](results-r1/bonsai-4b-q1-cpu-r1-context.json) | 1.045 | 3.432 | 1497.7 |
| [bonsai-8b-q1-cpu-r1](results-r1/bonsai-8b-q1-cpu-r1-context.json) | 1.758 | 6.197 | 2501.8 |
| [granite3.1-1b-moe-q4-cpu-r1](results-r1/granite3.1-1b-moe-q4-cpu-r1-context.json) | 0.594 | 0.793 | 1730.1 |
| [granite4-1b-q4-cpu-r1](results-r1/granite4-1b-q4-cpu-r1-context.json) | 0.883 | 2.404 | 2246.0 |
| [lfm2-350m-q4-cpu-r1](results-r1/lfm2-350m-q4-cpu-r1-context.json) | 0.320 | 0.418 | 585.8 |
| [lfm2-700m-q4-cpu-r1](results-r1/lfm2-700m-q4-cpu-r1-context.json) | 0.452 | 0.825 | 1044.2 |
| [lfm2.5-1.2b-q4-cpu-r1](results-r1/lfm2.5-1.2b-q4-cpu-r1-context.json) | 0.606 | 1.190 | 1541.7 |
| [lfm2.5-1.2b-qad-q4-cpu-r1](results-r1/lfm2.5-1.2b-qad-q4-cpu-r1-context.json) | 0.322 | 0.947 | 1471.9 |
| [qwen2.5-0.5b-q4-cpu-r1](results-r1/qwen2.5-0.5b-q4-cpu-r1-context.json) | 0.463 | 0.580 | 750.6 |
| [qwen2.5-1.5b-q4-cpu-r1](results-r1/qwen2.5-1.5b-q4-cpu-r1-context.json) | 0.886 | 1.610 | 2048.2 |
| [qwen3-0.6b-q8-cpu-r1](results-r1/qwen3-0.6b-q8-cpu-r1-context.json) | 0.734 | 0.725 | 1602.3 |
| [qwen3.5-0.8b-q4-0-baseline-cpu-r1](results-r1/qwen3.5-0.8b-q4-0-baseline-cpu-r1-context.json) | 0.613 | 0.808 | 1376.2 |
| [qwen3.5-0.8b-q4-cpu-r1](results-r1/qwen3.5-0.8b-q4-cpu-r1-context.json) | 0.748 | 1.002 | 1316.5 |
| [qwen3.5-2b-q4-baseline-cpu-r1](results-r1/qwen3.5-2b-q4-baseline-cpu-r1-context.json) | 1.161 | 2.069 | 2744.5 |
| [smollm2-1.7b-q4-cpu-r1](results-r1/smollm2-1.7b-q4-cpu-r1-context.json) | 0.885 | 2.030 | 2524.2 |
| [smollm2-360m-q8-cpu-r1](results-r1/smollm2-360m-q8-cpu-r1-context.json) | 0.318 | 0.500 | 936.2 |
| [ternary-bonsai-1.7b-g64-cpu-r1](results-r1/ternary-bonsai-1.7b-g64-cpu-r1-context.json) | 0.478 | 1.879 | 929.6 |
| [ternary-bonsai-pq2-prism-cpu-r2](results-r1/ternary-bonsai-pq2-prism-cpu-r2-context.json) | 12.349 | 4.742 | 871.1 |

RSSはowned serverだけを約250ms周期で読む標本値で、driver・OS・widget UIを含まず、短いピークを逃し得る。disk上の圧縮モデルサイズ、パラメータ数、RAM、active parametersは別物。一般16GBノートのCPU/iGPUや、仕事中の常駐widget、電力を実測した結果ではない。

## 保存原票との照合

各456件のrequestは固定prompt＋case本文だけと一致し、fixtureのexpected/rationale/groupをmodel入力へ混ぜていない。各HTTP200の元のmessage.contentは、未修復のexport raw_textと一致。21実行の原票shaとsummary sha、採点器sha、固有model/runtimeのshaは各contextとexport-auditに保存した。[export照合一覧](results-r1/CHECKPOINT-R3-export-audits.json)。

固定した6評価ファイルのSHAは、各採点時に全一致した。採点担当のmodel起動・download・HTTP・GUI操作は0件。採点器の人工自己検査は16/16。[実行driverの独立source確認](RUNNER-SOURCE-REVIEW-R1.md)では、重複JSON key、timeout後の未試行、HTTP500の分類が意味得点と混ざらないことを確認した。

この比較にはJSON grammarの誘導が含まれる。全候補へ同じ固定prompt/schemaを渡す契約比較であり、素の自由回答の能力比較ではない。tokenizerやchat template、runtimeによる誘導の差も結果へ影響し得る。モデルの一般的な優劣として断定しない。

## 採否と残る検証

結果未閲覧の別担当がroot実行開始後に提案した[採否案](../small-model-sweep-portability-v1/ADOPTION-PRIOR-R1.json)は、実験全体の開始前登録とは呼ばない。そのpilot gateは形式24、positive90%以上、hold誤propose0などの合成条件。今回はpositive18なので90%以上は17/18以上であり、hold6全一致と合わせると全一致23/24以上が必要になる（overall22の単独条件は冗長）。現時点の候補はその全体条件に達しない。

独立した少数人工文・一つの固定契約・一つのhostであり、文章一般を代表しない。曖昧な見た目のラベルは作者定義で、感性や唯一解を証明しない。特に今回のholdは「明示された肯定依頼だけ処理する」契約であり、文章の内容を自由に連想させるambient用途の楽しさとは別評価である。

次は、形の提案と属性抽出を分けた案を、この24文を開発用へ移した上で、新しい独立fixtureで比較する。実widget接続・実16GB機・人物による作業と連想の評価が揃うまで、公開版の標準モデルへ採用しない。これは評価担当の提案であり、その新しい試作を実装・測定した記録ではない。
