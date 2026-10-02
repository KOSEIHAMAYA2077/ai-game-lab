# Tiny char student: 常駐用の小さな解釈器

2026-10-03。MiniLMの文章encoderを常駐させず、**作者定義の6形＋最大2部位・1関係のProgram**を、日本語・英語の短い特徴で選ぶ比較実験。重みJSONは **122,601 bytes**、展開したint16重み・既知特徴bitsetは **91,136 bytes**。用意した形の制約内で動き、任意の物体を発明するtext-to-meshではない。

現時点では独立評価前の凍結候補で、アプリへは未統合。既存のMiniLM、学習済み関係head、公開版を変更しない。データは人工文のみ。入力の外部送信、Transformer、GPU推論、モデル取得を使わない。モデル名の「student」は比較案の呼称で、MiniLMを実行して教示を蒸留したモデルではない。

## 技術の担当範囲

| 担当 | 方法 | 限界 |
| --- | --- | --- |
| 形の分類 | 文字1–5gram＋英単語のbinary feature、FNV-1aで4096次元へハッシュ、L2正規化、線形softmax、int16量子化 | sphere / box / tube / blade / ring / vase / unknown。人工データの言い換えを越えた知識は持たない |
| 接続の分類 | 名詞・色・明示属性をマスクした同方式の4class head | end / above / through / none。意味が近くても修飾・文脈を解決できるとは限らない |
| 範囲と順序 | 明示名詞aliasでnoun spanを得て、構文規則で親子順・属性句を分ける | この部分は学習ではない。日本語の助詞や英語の位置語を手作業で対応させる |
| 形状属性 | 句内の長い・細い・大きい・小さい・曲がった・ねじれた等の規則 | 属性を学習したとは扱わない。既存validatorの数値範囲内のみ |
| 保留 | unknown/none、score/margin、否定、2部位超過、4000 code unit超過 | 未知・否定の一般的な保証ではない。未知でもハッシュ衝突や既知語の引用で誤って確信する可能性がある |
| 幾何 | 既存有限Program validatorへ渡す | この実験は形の解釈まで。実際の表面描画・材料交差確認・常駐全体RAMの評価は別工程 |

形や色をrelation headへ渡す前にマスクするため、「赤」から接続方法を決めない。親子順を規則で決めたこと、接続labelを学習で選んだことは、`evidence`を別に残す。保留した時は`program: null`で、身体・文字の削除を要求しない。

否定は文全体の明示規則で保留するため、「球ではなく箱」のような訂正も今回は保留になる。複雑な否定、引用、比喩を理解するモデルではない。1部位の形名は既知aliasから分類し、名詞anchorがない説明は句全体をprimitive headへ渡す。ハッシュの既知率は粗い補助指標で、意味理解の確信ではない。

## 開発データと成績

人工corpusは2,293例。作者定義の有限形状語彙・関係を教師ラベルとして生成した。すべての派生例を意味・言い換えfamily単位でtrainまたはdevへ入れ、近い文を無作為に両方へ分けない。これは独立の最終testではない。

| 分類 | train raw top-1 | family-held-out dev raw top-1 | 閾値適用後のdev受理 / そのうち正答 |
| --- | --- | --- | --- |
| primitive | 1,495/1,495 | 315/368（85.6%） | 117 / 117 |
| relation | 320/320 | 97/110（88.2%） | 49 / 49 |

保留を含めたdevの正答はprimitive197/368、relation84/110。受理精度を優先すると、既知の正しい言い換えも多く保留になる。「受理したものが全て正答」はこの開発集合内の値で、自由文に対する保証ではない。raw top-1、受理率、保留した既知例、危険な受理を分けて報告する。後から見る独立90例で同じ閾値のまま評価する。

- [人工corpusとfamily](artificial-corpus.json)
- [学習・dev分類と失敗](training-report.json)
- [閾値適用後のdev・Program smoke](development-report.json)
- [凍結manifest](FREEZE.json)

重み、閾値、データ、実装のSHAを独立testを見る前に凍結する。testを見た後に修正する場合は別版へ保存し、そのtestは回帰集合として扱う。

## 負荷の実測

このMacのNode v26.4.0 / arm64、単一JS threadで、人工短文と2000 code unitの繰り返し文を2,000回評価した。[測定JSON](benchmark-report.json)。

- module読み込み約1.05ms、最初の解釈約2.78ms。
- warmed median約0.030ms、p95約0.798ms、最大約1.129ms。
- Node harnessのGC後heap増分約1.08MiB、RSS増分約17.02MiB。

これは解釈器だけの差分で、Mac小窓・WKWebView・WebGL・Three.js全体のRAM/CPUではない。NodeのheapやRSSはネイティブ小窓のphys_footprintと同じ数値ではない。一般16GBノートPC実機、ブラウザ内の値、長時間常駐、最大4000文字の多様な文章はこの測定で実証していない。

## 再実行

既存のPython＋NumPy（測定時NumPy2.0.2）と既存Node依存だけを使う。新しいパッケージ取得は不要。`train_student.py`は人工corpusとモデルを再生成するため、**凍結評価を再現する時は再学習せず、先にmanifestを検査する**。

```sh
python3 experiments/widget-student-v1/verify_freeze.py
node experiments/widget-student-v1/build_runtime.mjs
node --expose-gc experiments/widget-student-v1/benchmark.mjs
node experiments/widget-student-v1/evaluate_development.mjs
```

学習を再現する場合は、別worktree/版で以下を実行する。学習時間はこのMacで約2.26秒。

```sh
OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 OMP_NUM_THREADS=1 python3 experiments/widget-student-v1/train_student.py
```

## 先行研究との関係

[fastText / Bag of Tricks for Efficient Text Classification（Joulin et al., EACL 2017）](https://aclanthology.org/E17-2068/)は、軽い特徴と分類器を使う効率的な文章分類の先行研究。本実験は、狭い形状Programの分類でもこの種の小さな方式を基準にできるかを試す。公式fastTextライブラリ、階層softmax、学習済みfastTextベクトルは使っておらず、結果を同論文の再現として扱わない。

[Model2Vec公式実装](https://github.com/MinishLab/model2vec)は、重い文encoderを推論時に使わないstatic embeddingを得る別候補。今回は導入・再現・蒸留していない。MiniLM teacherによるラベル付けや、日本語のtoken静的ベクトルと軽いheadの比較は、別データ・版で行う次の候補。

研究としては、**日本語の否定・修飾・親子関係を、軽い解釈器の受理/保留と制約付きProgramでどう扱うか**を対象にできる。小さなファイルになったことだけでは研究の新規性や自由文の正しさを示さない。
