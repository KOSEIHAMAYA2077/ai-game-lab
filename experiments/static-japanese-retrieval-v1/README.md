# 日本語 StaticEmbedding の独立比較

2026-10-03。Glyph Matter の作者定義60形と6基本部品を、端末内の日本語埋め込みで検索する実験。ゲーム、既存の小窓、共有の依存関係、公開UIには接続していない。任意の文章からメッシュを生成する方式ではない。

**現段階は比較候補。全1024次元の読み取り専用 mmap は精度を保ちながら独立Pythonプロセスのメモリ観測を下げられる可能性がある。128次元は保存容量を削減できるが、誤選択と保留を独立評価で判断する。既定UIへのモデルダウンロード追加や採用はしていない。**

## 出所と実装

- [作者のモデル](https://huggingface.co/hotchpotch/static-embedding-japanese/tree/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3) を revision `95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3` に固定。重み `0_StaticEmbedding/model.safetensors` は 134,217,824 bytes、公式LFS SHA-256 `f0c60b3d2952fb89e67a063ac4aa558ff4b02facaac5fd674d637b9e2c52ccca` と一致した。トークナイザと小さい設定・カードを合わせた取得は約136MB。ONNX、量子化ONNX、教師、学習データは取得していない。
- [モデルカード](https://huggingface.co/hotchpotch/static-embedding-japanese/blob/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3/README.md) のメタデータと本文で、モデル重み・学習コードの MIT 表記を確認。リポジトリに独立した LICENSE ファイルはなかった。カードをローカルに保存し、[model-manifest.json](model-manifest.json) に出所・サイズ・SHAを残す。[トークナイザの作者モデル](https://huggingface.co/hotchpotch/xlm-roberta-japanese-tokenizer) も MIT メタデータだった。ただし実験で使うのは静的モデルに同梱された固定版 tokenizer.json。
- Tensor は `embedding.weight` 一つ、`F32[32768,1024]`。Unigram の基本語彙32,702＋追加トークン66＝32,768。`Nmt → NFKC → Lowercase` 正規化、Metaspace 前処理、UNK ID 3、byte fallback なし。トークナイザに特殊トークンの後処理はあるが、推論では追加を無効にする。
- 設定に記録された Sentence Transformers **3.3.1** の [StaticEmbedding実装](https://github.com/UKPLab/sentence-transformers/blob/f6922f0269426ab93efd9ac6d9c0da5cc207c1cb/sentence_transformers/models/StaticEmbedding.py) を読んだ。paddingを無効にし、特殊トークンなしのIDを `EmbeddingBag` で平均する。設定の類似度は cosine、Normalize module はない。実験もfloat32で平均し、cosine計算時にだけL2正規化する。遠隔コードを実行せず、PyTorch / Sentence Transformers を依存に加えていない。
- 作者の [学習コード](https://huggingface.co/hotchpotch/static-embedding-japanese/blob/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3/trainer.py) と [Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) を確認した。先頭次元を使えるように学習されたモデルなので、128次元版は全テーブルの先頭128列を切り出した。再学習はしていない。float16版はこの実験内の追加変換で、作者配布の量子化モデルと同一ではない。

取得した外部ファイル、変換した重み、専用環境は `.local/static-japanese-v1/` に保存し、Gitから除外する。公開候補のこのフォルダに重みや端末固有の絶対パスを置いていない。実行時はローカルファイルだけを読み、入力文章を送信しない。

## 校正と凍結

[captions.json](captions.json) は60形＋6基本部品の短い日本語説明と名前・別名343本。形と部品の検索空間を分け、同じものを指す `condense` と `sphere` を競合させない。ラベルごとに、固定captionのcosine最大値を使う。比較のcharacter n-gram検索も同じcaptionを使う。これは既存の学習済み tiny student との比較ではない。

[calibration.json](calibration.json) の112例は、初回検索実行前にこの担当が作成した調整用人工文。既存 tiny heldout は読んでいない。閾値候補と選択目的を [method-plan.json](method-plan.json) へ先に記録した。校正で、別名を優先すると説明中の付随する名詞を誤選択したため、候補v2では別名を複数対象の保留にだけ使う。NumPyのmacOS行列積に警告が出たため、有限値と明示的加算との誤差6e-8以下を確認し、v2ではfloat32の乗算・加算へ変更した。v1の実装・校正・候補は保持する。

最終評価候補は [method-plan-v2.json](method-plan-v2.json)、[retrieval_v2.py](retrieval_v2.py)、[frozen-candidate-v2.json](frozen-candidate-v2.json)。最後のSHA-256は `ee83896eb1f074a787a8f587d12577761c399b224d5b5a8675351c5b5884abe1`。別担当の新しい評価文を見る前に、caption・トークナイザ・全4比較方式・閾値・計算法を凍結して伝えた。その後の評価から再調整していない。

平均ベクトルは語順や否定の対象を表現しない。`retrieval_only` は検索と閾値だけ、`guarded` は作者ルールとして否定・複数形名・一部の合成関係を保留する。ルールは新しいラベルを選ばず、検索結果を抑える。二部位の順序や関係を推論するモデルではない。

校正結果は学習に使った例であり、汎化精度として扱わない。raw top1、閾値による保留、正解、許可した中の正解率、負例の誤許可を分ける。

| 60形・校正 | raw top1正解 | guarded許可 / 正解 | 形なし38例の誤許可 |
| --- | ---: | ---: | ---: |
| 1024 float32 | 55/60 | 42 / 42 | 1/38 |
| 128 float32 | 52/60 | 39 / 39 | 1/38 |
| 128 float16 | 52/60 | 39 / 39 | 1/38 |
| 同captionのcharacter n-gram | 49/60 | 25 / 25 | 1/38 |

6基本部品の校正は全方式raw top1が6/6、guardedは1024/128で5/6、character n-gramで4/6。例数が少ない。詳細と**診断用**risk/coverage点は [calibration-analysis-v2.json](calibration-analysis-v2.json)。点を見て閾値を選び直す処理はない。

## 新しい独立評価

別担当が候補・caption・校正文・数値閾値を見る前に140人工文を作り、80要求・40保留対象・20曖昧文を固定して評価した。日本語と英語を半数ずつ含む。判定はAI担当による作者定義形への対応付けで、本人や第三者の人手注釈ではない。全文をそのまま入力し、短い名詞への切り出しや翻訳はしていない。[独立評価の原票・方法・失敗](../static-japanese-fresh-evaluation-v1/REPORT.md)。fixture SHAは `1f0d971a19adbba9551799f5543bb2e42b9e144c6fdf8028d428d4c7f0affb1e`。

| 凍結候補・60形 | raw top1正解 | guarded正解 / 要求 | guarded許可 | 許可要求中の正解率 | 保留40例の誤許可 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1024 float32 | 52/80 | 30/80 | 34/80 | 30/34、88.2% | 5/40 |
| 128 float32 | 48/80 | 23/80 | 23/80 | 23/23、100% | 3/40 |
| 128 float16 | 48/80 | 23/80 | 23/80 | 23/23、100% | 3/40 |
| 同captionのcharacter n-gram | 40/80 | 18/80 | 20/80 | 18/20、90% | 1/40 |
| 既存の作者ルール `shapeChoices/interpret` | — | 40/80 | 56/80 | 40/56、71.4% | 25/40 |

独立評価の許容する近接形は、評価前に認めたcube/cuboidだけ。校正用の広い`family`分類を、独立評価の許容正解へ混ぜない。独立評価ではexactと許容familyの**許可後**正解数が偶然同じだった。raw top1のfullと128の一致は103/140、128float32とfloat16は139/140。float16で1件上位が違ったが、どちらも保留で最終判断は一致した。

言語別のraw top1は全1024で日本語37/40・英語15/40、128で日本語36/40・英語12/40。guardedでは全1024の日本語正解25/40・英語5/40、128の日本語21/40・英語2/40。日本語と英語で対象labelや表現分布も異なるため、言語だけの影響を測定したとはしない。

6基本部品は事前に対応付けられた27要求で独立に評価し、guarded正解は全1024で4/27、128で5/27、保留対象の誤許可はどちらも5/40だった。60分類と混ぜた総合点は作らない。

取り消し・引用・矛盾した箱の属性を誤許可する一方、`角なし`や`with`を含む正しい一対象要求も広いscopeルールが止める。これは閾値だけでは解けない意図と否定範囲の問題。140例は以後、回帰資料として扱い、caption・閾値・guardの修正に使って新しい独立テストと呼ばない。3件の意味・形状対応の衝突を含む元点数と、77例の事後感度分析は別に残っている。

**採用結論：既定の自動形選択へ入れない。** 日本語の表現と形の関連付けには調査価値があるが、許可率・保留対象の誤許可・英語の取りこぼし・未知文字の入力検証に不足がある。mmapの全1024次元と128float16を比較候補として保存し、次版は新しい独立評価とアプリ全体の検証を必要とする。

## 数値確認と入力の欠点

[numerical-checks.json](numerical-checks.json) に、455件のcaption・校正文が全次元版と128次元版で同じトークンIDになったこと、校正で使った380IDの先頭128列が完全一致したこと、少数例の平均がfloat64の直接加算と許容誤差内で一致したことを保存した。作者カードの公表済み4類似度も最大4e-5未満の差で再現した。既存の3 Python環境にPyTorchがなかったため、PyTorch実物とのパリティを確認したとはしない。

凍結v2は空入力と4,001文字を保留するが、**UNK数 / token数の上限は十分でない**。Unigramが未知の絵文字を1個のUNKにまとめると、「球＋絵文字3,999個」を球として許可してしまった。この担当の数値端例で検出し、評価候補を変更せず記録した。

[strict_input_guard_v3.py](strict_input_guard_v3.py) は次候補の入力検証案。意味のある既知tokenを最低1個求め、未知文字の範囲が80%を超えたら保留する。7件の自己作成端例を通し、非空の校正文で追加保留がないことを確認した。[検証原票](strict-input-guard-v3-checks.json)。**これは凍結v2の独立評価成績へ混ぜない。採用前に必要な入力検証修正**として残す。

## 保存容量と独立プロセスのメモリ・時間

| 方式 | 重みのファイル / 配列容量 | caption index | 通常読込RSS | mmap RSS | mmap warm p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1024 float32 | 128MiB | 約1.34MiB | 約242.3MiB | 約90.0MiB | 0.136ms |
| 128 float32 | 16MiB | 約0.167MiB | 約96.1MiB | 約84.7MiB | 0.078ms |
| 128 float16 | 8MiB | 約0.167MiB | 約88.1MiB | 約83.1MiB | 0.081ms |

tokenizer.json は2,127,941 bytes。mmapの重み容量は**ファイル / 仮想マップ容量**であり、常にその全量がRSSになるとはしない。RSSはPython・ライブラリ・tokenizer・index・作業領域を含む一つのプロセスを計測した値。通常読込にはSHA確認や有限値チェックの一時領域も影響する。アプリ全体RAMの削減量ではない。

CPUで短い人工文8本を240回計算した。4,000文字のtokenization＋検索は約1.4〜1.9ms、マップ準備（SHA全読・tokenizer・caption index含む）は1024で約93ms、128で約32ms。モデル取得時間、Pythonの起動時間、入力から文字吸収完了までの時間を含めていない。

原票は `benchmark-*.json`、`benchmark-mmap-*.json`。[mmap-parity.json](mmap-parity.json) では全3方式の112校正文について、通常読込とmmapの全ランキング・数値・メタデータが一致した。この実行は画面ロック中の短時間の独立CPU測定で、並列作業中、ファイルキャッシュ状態も制御していない。落ち着いた通常作業時の負荷、長時間常駐CPU、見た目・操作は未確認。

## 再現

リポジトリの根で実行する。元のアプリ依存へ追加せず、専用環境を使う。

```sh
python3 -m venv .local/static-japanese-v1/venv
.local/static-japanese-v1/venv/bin/python -m pip install --only-binary=:all: -r experiments/static-japanese-retrieval-v1/requirements-lock.txt
.local/static-japanese-v1/venv/bin/python experiments/static-japanese-retrieval-v1/prepare_model.py --local .local/static-japanese-v1
```

モデル取得は固定URLの公開データだけで、サイズと公式のLFS SHA / Git blob IDを照合する。既存の取得物が異なれば停止する。SafeTensorヘッダは64KiB以内、想定した単一tensor・形・dtype・offset・全payload長を確認してから安全なsafetensors readerで読む。元のデータと変換物のSHAを記録する。pickle、trust_remote_code、遠隔学習コードは使わない。

既存の評価原票を上書きしないため、`--output` に新しいファイル名を指定する。v2の評価には必ずv2の凍結ファイルを明示する。

```sh
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .local/static-japanese-v1/venv/bin/python experiments/static-japanese-retrieval-v1/retrieval_v2.py evaluate --fixture experiments/static-japanese-retrieval-v1/calibration.json --frozen experiments/static-japanese-retrieval-v1/frozen-candidate-v2.json --output .local/static-japanese-v1/calibration-replay.json
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .local/static-japanese-v1/venv/bin/python experiments/static-japanese-retrieval-v1/mmap_benchmark.py --variant 1024-float32 --output .local/static-japanese-v1/mmap-replay.json
```

外部に任意文を送る呼出しはない。再現時に独立評価文でcaptionや閾値を調整すると、その評価を新しい汎化テストと呼べなくなる。

## 次の判断

モデルの格納容量だけを理由に128次元へ絞らない。全1024次元のmmapと、128次元のfloat32 / float16を精度・保留・誤許可と合わせて比べる。安全な未知入力検証、native/runtime移植費用、初回モデル取得、アプリ全体の資源観測を満たしてから、既存の軽い分類器・明示語彙との役割を判断する。
