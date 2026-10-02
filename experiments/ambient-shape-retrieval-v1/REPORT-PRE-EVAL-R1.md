# R1候補の凍結時点（独立評価前）

CPUの既知60形提案を新フォルダ内だけに実装した。既定resolver/geometry、native13/16、保存、OS入力を変更していない。学習分類器なし、作者alias→選別WordNet同synset→作者20node graph→IDF疎profileの4出所を別に返す。confidence gateが弱い・引用・否定・コード・複数物体競合なら現在形保持。全入力を命令に変換しない。

FREEZE-R1.json SHA `105bc4926757b5e4d68fc932cdf3eb78526c9aa63aaebb2e127fdcc58352fa98`、07:06:50 JST。元source11/凍結24/主要dep6のSHA drift0。追加transitive baseline depとfreeze generatorはFREEZE-SUPPORT-R1.json。独立120本文/ラベル未閲覧で候補を凍結、APIだけを別担当へ渡した。後の結果で候補・閾値・devを調整しない。

開発成績（作者＝実装担当、Human0、未見評価ではない）:

|条件|canonical60受理正解|作者dev positive24 raw exact|同24受理正解/受理|hold20誤反応|曖昧10受理|
|---|---:|---:|---:|---:|---:|
|alias＋guard|60|8|8/8|0|0|
|＋WordNet|60|9|9/9|0|0|
|＋作者graph|60|16|13/13|0|0|
|sparseのみ＋guard|4|18|4/5|0|0|
|full guard無し|60|20|15/15|9|0|
|full＋guard（候補）|60|20|15/15|0|0|

canonical60は資料名そのままなので、語彙一般化を示さない。別dev24のfull受理内訳はalias8/synonym1/graph4/sparse2。60を含めた75/84だけを代表精度としない。初回pilot8とR0weightは保持。R0→R1は複数termをjoinした人工English bigramの除去で、数値閾値変更は0。

weight204,333B（約199.5KiB）、845terms/1,937features/2,659profile pairs/60profile。512 UTF-16入力＋normalize後512上限、超過はcropせずhold。無制限cacheなし。19境界/finite/determinism checks、200人工入力×2mode合格。Node↔system JSC704人工casesの判定/query/evidence/60rank差0、absolute numeric tolerance1e-12。

Mac arm64の候補だけのprocess: Node init4.88ms（parse.48/create1.22）、warm1140 query p50 .0404ms/p95 .0804/p99 .1117/max .1974。512多数alias100 query最大 .3597ms。systemJSC init7.05ms、同1140 batch221ms/平均 .194ms。query measurementはwarm、I/O/bridge/OS/input/body/GPUを含まない。一般PC保証ではない。

Node explicitGC後init heap増1,431,400B、RSS増4,325,376B。afterinit heap5,532,480B/RSS54,149,120B、warm後heap5,849,680B/RSS74,121,216B、whole process peak72,464KiB。rawJSON/parsedweight/Map/sourceを含む差分で、weight単独常駐allocationと全appRAMは別。JSC weight常駐量・Windows16GB・電力・8h継続は未測定。

独立評価は [METHOD-R1.md](METHOD-R1.md) の60positive/clear hold/曖昧層を分離して初回一度比較する。fresh全文とactual masked queryの完全重複、alias/synset/graph cueも別記する。現在の暫定採否はdefault採用見送り、候補は独立研究用。誤反応とcoverageの結果を受けても、この120への再調整は行わない。
