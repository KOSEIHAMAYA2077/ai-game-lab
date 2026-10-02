# 既知形を保留付きで返すCPU候補 R1

**既定への採用は見送る。** 独立120文で明確no-shape文への誤反応は2/40に抑えたが、正例60文の受理22件中、exact形は14件、誤形は8件だった。説明3/36・物語1/12・明示要求10/12で、仕事/創作文の内容を一般的に理解する候補としては不足している。ほぼ既知aliasによる受理で、sparse fallbackの受理寄与は0。低い誤反応だけで品質向上や一般化を断定しない。

この新フォルダ内だけに実装した純CPU JavaScript。全入力を命令にしない。512 UTF-16以下の一窓からproposalを返し、holdならcurrent shapeを保持する。本文を身体へ蓄積する処理・低頻度scheduler・IME・OS入力・保存・rendererとは無接続。既存根性60形/Web/native13/16のsourceとdefaultを変更していない。

## 初回独立比較

評価担当が候補を見る前に新120文を著作/凍結、実装担当は本文/ラベル/個別失敗を未閲覧。candidate/weight/threshold/devを07:06:50 JSTに凍結してAPIだけ渡し、120×7条件の840callを一度実行。以後model call0・候補調整0。集計だけを受け取った。Human0、manual AI intentの人工評価であり、人の仕事・創作の観察評価ではない。

予測空間は60shapeだが、正例は代表12shapeについて60文（説明36/物語12/明示要求12）。全60shapeの独立精度を示さない。明確no-shape40・未解決20を別母数にする。各条件には同じ全文を渡す。

|条件|正例exact/60|正例受理/60|受理正例exact precision|明確no-shape誤反応/40|未解決hold/20|
|---|---:|---:|---:|---:|---:|
|既存shapeChoices baseline|19|29|19/29=65.5%|20|10|
|alias＋guard|13|21|13/21=61.9%|2|19|
|＋選別WordNet|13|22|13/22=59.1%|2|19|
|＋作者graph|14|22|14/22=63.6%|2|18|
|sparseのみ＋guard|0|1|0/1=0%|0|20|
|full guard無し|14|22|14/22=63.6%|17|18|
|full＋guard（固定候補）|14|22|14/22=63.6%|2|18|

fullのpositive coverage22/60=36.7%、positive exact14/60=23.3%、accepted-positive exact precision14/22=63.6%。baselineはcoverage29/60=48.3%、accepted-positive precision19/29=65.5%で、fullの正例品質が改善したとは言えない。明確no-shape false activation2/40=5%。内訳はordinary15両者誤反応0、引用baseline6/6→full0/6、否定5/6→0/6、code6/8→1/8、取消3/5→1/5。通常の語彙のない仕事文を元から保留できたことと、guardによる引用等への対処を分ける。joint precisionはfull14/(22+2)=58.3%、baseline19/(29+20)=38.8%、**positive＋明確holdのみで未解決20を除く**。未解決は2/20受理で、唯一正解のaccuracyへ混ぜない。positive:clear hold=60:40という人工prevalenceに依存する。

rawTop1はfull30/60、sparse24/60で、受理exact14/60・0/60とは別。rawargmaxが正しくてもgateで保留するもの、受理したが誤形のものがある。正例の受理channel内訳はalias21/graph1/synonym0/sparse0。fullの受理channelにsynonymはなく、WordNet-onlyでは受理が1件増えたが正解数は増えなかった。graphは正例exact13→14の1件、fullの疎featureはrawrankのみに寄与した（sparse-onlyの受理1件は誤形）。guard無しでは同じexact14でno-shape誤反応17/40、guardで2/40へ減った。guardの寄与と辞書/graph/IDFの寄与を混同しない。

正例の言語層別はfull日本語13/48 exact・受理18/48、英語1/12 exact・受理4/12。baseline日本語18/48 exact・受理25/48、英語1/12 exact・受理4/12。全体は日本語96/英語20/code4。英語definitionを足しただけで英語や日本語の未知語を扱えたとは言わない。

全文/各mode actual masked queryとfit個別term/definition/lemma、DEV114、pilot8のNFKC exact重複は0。しかし、文全体が新しいことと語彙の新規性は異なる。full actual queryの有限cue有りはpositive26/60（alias21/synonym0/graph5）、clear no-shape12/40（alias12）、unresolved6/20（alias4/graph2）。cueは重なり得る。alias/graph既知cueによる受理を未知語一般化と呼ばない。synonym cueはfullで0、WordNet-only ablationで正例1（誤形）。graph最長overlapでcueが消える場合もあり、辞書の独立寄与を十分に試す標本とは言えない。risk-vs-coverageは固定policyの一点を報告し、cut探索は行わず、閾値選択をしない。本文・case ID・個別ラベルを除いた独立集計 [EVALUATOR-AGGREGATES-R1.json](EVALUATOR-AGGREGATES-R1.json) のみコピーし、個別原票は独立担当側に保持。実装担当はfixtureを読まず修正しない。

## 方法と出所

作者alias、選別WordNet同synset427行/404term/74concept、作者20node graphを別sourceとして扱う。shape/sense対応は作者判断、graphは芸術的edgeでWordNet relationでもlearned modelでもない。graph最大3nodeの固定path重み、profileは全60のalias/synonym/graph/English definition feature集合をbinary TF-IDF/L2正規化する。fitはdocument frequency統計のみ。classifier/dense embedding/外部model/新downloadなし。

runtimeには845term/1,937feature/2,659sparse profile pair。各shapeはalias1/synonym.96/graph固定score/.8×cosineの最大channel。anchor .85・margin .10、sparse cosine .32・margin .10・matched≥3・rare(df≤6)≥2は最初のweightから変更0。quote mask、technical/否定全体hold、独立物体競合holdは作者の保守的ruleで、意味・意図を理解していない。詳細regex/境界/正規化は [METHOD-R1.md](METHOD-R1.md) と [retriever.js](retriever.js) が規範。

DEVはcanonical60＋作者positive24/hold20/ambiguous10。canonicalは全60受理、別positive24はalias8→WordNet9→graph13→full15受理exact。開発として採点しており独立精度ではない。R0人工bigramをR1で除去した履歴・最初のpilot8・全出力を保持。数値閾値探索はしていない。[REPORT-PRE-EVAL-R1.md](REPORT-PRE-EVAL-R1.md) の開発成績を今回の独立結果と分ける。

## CPU/重量と限界

R1serializedweight204,333B（199.5KiB）、入力はraw/normalize両方512 UTF-16上限、cropせずhold、無制限cacheなし。19境界/finite/determinism checks、人工200×2mode合格。Node→systemJSC704人工casesの判定/query/evidence/60rank差0（numeric tolerance1e-12）。JSC/Nodeへ載るpureCPU候補の実行可能性は確認した。

Mac arm64の独立candidate processではNode warm1140call p95 .0804ms/p99 .1117/max .1974、512alias密集100call max .3597ms。init4.88ms、JSC init7.05ms/1140call221ms（平均.194ms、batch Date.now）。warmquery局所値でI/O/bridge/input/body/GPUを含まず、cold常時最大保証でも一般PC実証でもない。

別担当の独立120一回ordered passでもfull p95 .0990ms/max .5099msだった。explicit warmup0、fullは6candidate条件の最後で、baselineのcold firstcallを含む値との公平なcold比較ではない。同機上の他作業との競合は未統制。posthoc nonzero top3は41/60だが、提案はtop1かholdに固定し、この診断で候補/gateを調整していない。

Node GC後init heap増1.37MiB/RSS増4.13MiB、warm whole-process RSS70.69MiB、peak72,464KiB。rawJSON/parsedweight/Map/sourceを含む差分なのでweight常駐allocation単独の測定ではない。JSC retainedweight・全widget RAM/電力/8h継続/Windows16GBは未測定。serialized shrinkを全appRAM低減としない。

多義語・短字境界・引用の入れ子・否定を含む物体記述・比喩は未解決で、低coverageと8誤形が残る。単一queryのCPU実験に限り、文字表面の質・継続した成長・注意/快適性/生産性は評価していない。[LIMITATIONS.md](LIMITATIONS.md) に境界を残す。

## 保存・採否

FREEZE-R1.json SHA `105bc4926757b5e4d68fc932cdf3eb78526c9aa63aaebb2e127fdcc58352fa98`。独立fixture SHA `6b524456b7615f85005888d4fc338de6993bad3016b20aa8cae87cbc70aedc42`、評価METHOD SHA `172c489bbc623738f6e8a69d0369aadebe5c3f129352f437b85b23526832b98d`。元source/依存/candidate SHA、license、全dev/pilot、CPU/parity原票、集計を残した。[REPRO.md](REPRO.md) のAPIでread-only再確認できる。

採否はdefault不採用・native未接続、独立研究candidateのみ保存。誤反応を抑えるguardとkeep-currentの契約は別実験として参考になるが、この候補のsemantic能力の採用とは別。次版で個別失敗を開発へ使うならこの120は回帰に分類し、未見評価を新たに凍結する。
