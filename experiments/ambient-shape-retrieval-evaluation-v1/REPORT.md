# 文章→既知60形の候補検索: 独立120文 R1

R1 full は、形への説明を自然に拾う候補として既定採用を見送る。固定人工正例60文のうち意図した形を受理したのは **14/60**、形を出さない40文への誤反応は **2/40**、曖昧20文の保留は **18/20** だった。従来 prototype baseline はそれぞれ19/60、20/40、10/20。保留guardは誤反応を減らした一方、fullの説明文は3/36、物語は1/12に留まる。これは本 fixture の観測と root の採否であり、実生活の誤反応率や人間の満足度ではない。

## 先に固定したもの

- 評価担当が自作した120短文/期待意図を **2026-10-03 06:58:12 JST** に固定。Human0、ユーザーの実文章を使っていない。形対応や物語の主対象はAIの仮の解釈で、芸術的連想に唯一正解を主張しない。物語への反応は明示命令・実行許可と別。
- 正例60は12代表family×5文。description36、narrative12、explicit_request12。no_shape40は普通15、引用6、否定6、コード8、取消5。unresolved20は比喩6、複数方向2、混合4、inventory外5、抽象3。日本語96、英語20、code言語4（codeカテゴリ自体は8）。60形全体の均一な網羅試験ではない。
- fixture SHA `6b524456b7615f85005888d4fc338de6993bad3016b20aa8cae87cbc70aedc42`、METHOD SHA `172c489bbc623738f6e8a69d0369aadebe5c3f129352f437b85b23526832b98d`。作者へはSHA/分類範囲だけ通知し本文・個別ラベルを渡さなかった。
- 作者candidate/weight/dev/thresholdのfreezeは07:06:50 JST、manifest SHA `105bc4926757b5e4d68fc932cdf3eb78526c9aa63aaebb2e127fdcc58352fa98`。root確認後にsourceを読み、07:10:26 JSTに41 listed filesをpinし、runnerを結果前に固定した。
- 07:10:34 JSTにbaselineと固定6 modeを各120文へ一回、合計840 calls。ウォームアップ0。受理はAPIのaccepted/shape、baselineはshapeChoicesの先頭という固定の代理評価。baselineの色や動作だけのrecognized/interpret結果を形の受理へ混ぜず、interactive側のランダム選択を再現したとは言わない。

参照: [METHOD](METHOD-R1.json)、[fixture](FIXTURES-R1.json)、[runner freeze](RUNNER-FREEZE-R1.json)、[candidate pin](CANDIDATE-PIN-R1.json)。作者の資料は [candidate METHOD](../ambient-shape-retrieval-v1/METHOD-R1.md)。初回scorer consoleのassert件数マーカーは15と誤記したが実際は16検算。候補を読む前に16へ訂正し[LABEL-CHECK](LABEL-CHECK-R1.json)へ記録した。metric期待値やfixture変更はない。

## 比較

正例hitは「受理した一つのshapeが事前allowed集合に含まれる」。保留も誤形も正例miss。clear no_shapeの受理は誤反応。曖昧層は受理せず現在形を保持することを正しい保留と数える。none/holdの理由を意味として理解したとの主張はしない。120を一つのheadline accuracyに合算しない。

| 条件 | 正例受理hit | 正例受理件数 | 正例誤形 | clear誤反応 | 曖昧保留 | before-guard rawTop1 | returned top3 recall (非0-score診断) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 19/60 | 29 | 10 | 20/40 | 10/20 | —/60 | —/60 (—) |
| alias | 13/60 | 21 | 8 | 2/40 | 19/20 | 13/60 | 17/60 (13) |
| alias_wordnet | 13/60 | 22 | 9 | 2/40 | 19/20 | 13/60 | 17/60 (13) |
| alias_wordnet_graph | 14/60 | 22 | 8 | 2/40 | 18/20 | 18/60 | 22/60 (18) |
| sparse_only | 0/60 | 1 | 1 | 0/40 | 20/20 | 24/60 | 35/60 (35) |
| unguarded | 14/60 | 22 | 8 | 17/40 | 18/20 | 30/60 | 41/60 (41) |
| full | 14/60 | 22 | 8 | 2/40 | 18/20 | 30/60 | 41/60 (41) |

baselineのrawTop1/rankingは提供されないため「—/60」は未測定。rawTop1はguard前の全文からのargmaxで、受理・実masked queryのrankingと別。top3は返された60rankingの先頭3で、alias系では0-scoreのinventory順候補が4 hitを含む。括弧内は**結果後**に非0-score候補だけを数えた診断で、事前指標を置換しない。fullのtop3 41/60は候補提示の手掛かりだが、自動採用の正解14/60とは別。

| 条件 | 正例の種類 | hit | 受理 | 誤形 | 保留 |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline | description | 5/36 | 13 | 8 | 23 |
| baseline | narrative | 3/12 | 5 | 2 | 7 |
| baseline | explicit_request | 11/12 | 11 | 0 | 1 |
| full | description | 3/36 | 10 | 7 | 26 |
| full | narrative | 1/12 | 2 | 1 | 10 |
| full | explicit_request | 10/12 | 10 | 0 | 2 |

fullの正例受理22中、正しい14、誤形8。日本語の正例hit13/48、英語1/12。baseline→fullで正例の正解が新たに増えた1文、失われた6文。graph-only→fullでは全120文のaccepted shape変更0。unguarded→fullではclear no_shapeの受理15文が保留になり、正例hitは不変だった。これは同じ固定実装内の差であり、別版/widget全体の因果効果ではない。[事後delta](DELTA-R1.json)に個別IDを残した。

| fullのclear層 | 誤反応 |
| --- | ---: |
| ordinary | 0/15 |
| quotation | 0/6 |
| negation | 0/6 |
| code | 1/8 |
| cancellation | 1/5 |

## なぜ採用を見送るか

- **部品名を全体より優先する。** P07の六つの正方形からなる塊はcubeの期待に対してsquare、P31の透明な傘と触手はjellyfishの期待に対してumbrella、P41の幹・枝・葉はtreeに対してleaf、P53の花を挿した器はvaseに対してflowerになった。いずれも事前manual期待であり、短い芸術文の唯一の読みではないが、部分名だけで形を決める限界を示す。
- **形の性質を説明する否定までholdする。** P02の「角のない」、P12の表裏を分けられない帯、P26の「手足のない」はwhole-query否定guardで止まる。否定問題の存在は過去から既知であり、今回の新発見とは扱わない。単語否定と形を否定する発話を区別できていない。
- **graph候補の近い競合で取りこぼす。** P14のねじれた輪とP52の花を挿す器は、固定margin条件のため保留。この結果に合わせてthresholdを変えていない。
- **code/取消guardの有限語漏れが残る。** N31のログキー`jellyfish.retry`をjellyfishとして受理、N35の「撤回」を含む案をflowerとして受理。語の追加だけでこのfixtureを直しても既知回帰であり、実文書全体の意図理解や普遍的な誤反応回避にはならない。
- U06の枝分かれ/森という比喩はtree、U09の球と箱の混合はcondenseとして受理。曖昧20の18保留は原理的に曖昧さを理解した証拠ではなく、有限cueと保留規則の結果。

個別本文・ラベルは評価後も作者の調整に使わせず、root/公開報告用の固定原票へ保持した。今後このfixtureに調整した版を作る場合は別version/既知回帰となる。

## 新しい全文と、知識から独立した新語は別

全文および各modeの実際のNFKC/lowercase/masked queryを、fit個別unit（alias/synonym/graph term、選別synset definition/lemma）、DEV114、pilot8とexact比較すると重複はすべて0。feature bagの組合せ、部分語、言い換えの重複がないという意味ではない。元語彙や既知の否定問題との独立性、general training dataからの独立性を主張しない。

fullの正例60には、実queryにalias cue21、synonym cue0、graph cue5（channel間の件数は重なり得る）、何らかの有限cue26。**受理22のchannelはalias21、graph1、synonym0、sparse0**。形に合う新しい説明の意味理解が改善したとの根拠はない。疎特徴はbefore-guard rawTop1を30/60、top3を41/60へ押し上げたが、固定受理policyではfull accepted shapeがgraph-onlyと同一。sparse-onlyも正例受理正解0/60、rawTop1 24/60で、rankingと自動採用を分ける必要がある。[原票のoverlap](RESULTS-R1.json)と[集計](SUMMARY-R1.json)に全件を残した。

## 技術と負荷の範囲

有限60shape、845term、20nodeの作者graph、選別WordNet74synset、1937個のEnglish word/bigram・日本語字bigramからなる疎profile。binary TF、IDF=ln(61/(df+1))+1、L2正規化とcosineを使う。分類器・dense embedding・勾配学習・任意text-to-mesh生成はない。shape対応やsenseは作者の選択。shape60はrenderer/native16の全移植や骨格生成を意味しない。

R1 weightは204,333B、pure core retrieverは8,606B。これらはserialized component bytesで、retained JS heap/process RSS/widget全体RAMではない。baseline-onlyのOxc/native bindingを含むNode比較環境と、pure runtimeは別。

実行環境: Apple M5、arm64、Darwin25.5.0、32GiB、Nodev26.4.0。同一processの一回計時で、並行root/agent作業のあり得るPC。api import/load 2.876083ms、baseline import/load 21.108084msはcall時間と別。下表は各120call、ウォームアップ0/先頭call込み。mode順序・JIT・キャッシュを平衡化していないので、細かなmode間速度差を一般的な優劣としない。

| 条件 | p50 ms | p95 ms | p99 ms | max ms |
| --- | ---: | ---: | ---: | ---: |
| baseline | 0.227250 | 0.714458 | 4.578541 | 6.923750 |
| alias | 0.021959 | 0.091042 | 0.574459 | 0.863666 |
| alias_wordnet | 0.031292 | 0.066458 | 0.332875 | 0.432750 |
| alias_wordnet_graph | 0.040584 | 0.079417 | 0.138292 | 0.418750 |
| sparse_only | 0.028542 | 0.057834 | 0.350458 | 0.364458 |
| unguarded | 0.046125 | 0.065041 | 0.356541 | 0.408125 |
| full | 0.054041 | 0.099042 | 0.121125 | 0.509917 |

この小さなCPU実験は、16GB laptop/Windows/iGPUでの達成、常駐アプリのRAM/FPS/電力、IME/OS監視、人間の快適さを測っていない。処理量の小ささより、この実験では形を選ぶ品質が主な制限だった。

## 原票と追試

- [RESULTS-R1.json](RESULTS-R1.json): 840callのAPI戻り値/60ranking/実query/elapsed/overlap。12,578,186B。実文章なし、人工文のみ。
- [SUMMARY-R1.json](SUMMARY-R1.json): mode別・層別の事前指標。source41 + fixture3を実行前後に検証。
- [AUDIT-R1.json](AUDIT-R1.json): 別Python算術で7modeのgroup/sourceKind/rawTop1/top3/p50/p95/p99/maxを再計算しmismatch0。候補呼出し0。0-score診断とSUPPORT pinは結果後と表示。
- [INPUT-CHECK-AFTER](INPUT-CHECK-AFTER-R1.json): initial41 pin/fixture3の不変性。候補freeze/support全体も最終checkへ記録。

追加FREEZE-SUPPORT-R1は初回実行後に受領した。freeze generatorとbaseline-only transitive import2の計3fileを事後にhash確認したが、**初回pin前にそれらも固定していたとは言わない**。候補core/weight/threshold/devの初回freezeは不変。補足は[AUDIT-R1](AUDIT-R1.json)へ分離した。

repo rootから保存済み原票の算術だけ再現する:

```sh
node experiments/ambient-shape-retrieval-evaluation-v1/replay-r1.mjs
```

fixture freeze検証と7modeの再計算、mismatch0を出し、model calls0/出力変更0。初回採取用`evaluate-r1.mjs`は既存出力を拒否し、元原票を上書きしない。再採取が必要なら新しい出力versionで、以後は既知fixture回帰として扱う。作者のDEV成功値を今回の未見全文の結果と混ぜない。

## 次の方針

rootの既定不採用を支持する。既存の明示形名による遊びは維持し、この検索器は研究用比較として残す。次版では、(1) whole objectとその部品/否定/引用を区別する小さいcontext層、(2) 名前を含まない日本語の視覚説明を持つprofile/corpus、(3) 低頻度の候補提示と自動変更を分けるpolicyを、別fixture/別versionで検討できる。既定採用前に、人間が書いた許可済み人工文・自由記述と、実際に邪魔でない頻度の試遊を測る必要がある。今回のthresholdの事後探索/変更、現body/ID/renderer/OS/UI/保存の変更は行っていない。
