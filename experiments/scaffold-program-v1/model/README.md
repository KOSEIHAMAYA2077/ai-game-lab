# 文章から小さな構造プログラムを作る

固定済みの小型多言語エンコーダーと、新たに学習した関係分類 head を組み合わせる比較実験。文章を、最大 2 部位と 1 関係の JSON に変換し、別の幾何コンパイラーが表面を構築する。既存の文字の流れ・吸収・表面描画は描画側が担当する。

たとえば人工例文 `棒の先に球` は tube と sphere を `end` で接続する。単一の形を選ぶ 0.12 版から、既知部品の組み合わせへ一段進めた版である。無制限の物体、メッシュの頂点、骨格の任意座標を生成するモデルではない。

## モデルと人手で作った処理の境界

| 段階 | 実装 | 学習の有無 |
| --- | --- | --- |
| 部位の句と親子の順番 | 日本語・英語の句境界規則、否定された既知名詞の除外 | 人手の規則 |
| 部位の種類 | MiniLM の文埋め込みと 6 種の説明文・同義語との類似度 | 事前学習済みエンコーダー。説明文は人手 |
| 部位の寸法・曲がり・ねじれ | 意味記述との比較と、明示された形容詞の数値指定 | 意味比較＋人手の数値規則 |
| 2 部位の関係 | 名詞・寸法語をマスクした文章を、384 次元埋め込み→4 クラス線形 softmax head へ入力 | この実験で人工文から head を学習 |
| 実際の配置と表面 | `scaffold-program.ts` の制約付きコンパイラー | 人手の幾何実装 |

規則は関係のラベルを返さない。関係分類 head が `end` / `above` / `through` / `none` の確率を返し、確信が足りない場合は形を保持する。規則が親子の順番を決めているため、関係理解全体をモデルのみの成果とは扱わない。応答の `evidence` も、規則・意味比較・学習 head を別の項目にする。

## 有限の出力

```json
{
  "version": 1,
  "parts": [
    {"id":"0","primitive":"tube","height":1.4,"width":0.4,"depth":0.4,"bend":0,"twist":0},
    {"id":"1","primitive":"sphere","height":1,"width":1,"depth":1,"bend":0,"twist":0}
  ],
  "relation": {"kind":"end","parent":"0","child":"1"}
}
```

- 部品は sphere / box / tube / blade / ring / vase。単部位または 2 部位で、同じ種類を 2 つ使用できる。
- 2 部位の場合、親を `0`、子を `1` とし、関係は必須。英語の `sphere above box` は語順と逆に box が親になる。
- height / width / depth は各部品の寸法倍率で、0.4〜1.8。bend / twist は -1〜1。NaN、無限値、コード、未知のキーは受理しない。
- end は親の上端へ子を接続、above は親の上へ子を配置、through は子が親を貫く。コンパイラーが扱う through の子は ring / tube / blade に限定する。
- 部位数の超過、未対応の語、曖昧な関係、未対応の貫通組み合わせは保留する。テキストをコードとして実行しない。
- モデルの受理条件は部品スコア 0.5・差 0.035、関係確率 0.62・差 0.15。これは校正された正答確率ではなく、この実験の保留閾値である。

## 学習と比較

人工訓練文 1,103 件、テンプレートを分けた人工検証文 288 件。訓練・検証の完全一致文は 0 件。名詞・寸法のマスク後は訓練が 57 種、検証が 12 種の入力になり、マスク後の訓練/検証完全一致も 0 件だった。独立評価担当も既存の初回 30 文、同種部品 6 文、追加 8 文のマスク後完全一致がいずれも 0 件と確認した。ただし部品の多様性が消えるので、実質的には少数テンプレートの分類であり、意味として独立している証明にはならない。日本語・英語の部品対を繰り返し使い、未知の物体を学ぶ訓練ではない。人工検証の高い精度だけで自由な文章への一般化を主張しない。

固定した 384 次元埋め込みの各次元を訓練データの平均・標準偏差で標準化し、NumPy で 4 クラス線形 head を学習する。学習率 0.06、L2 係数 0.007、最大 1,200 epoch。重み・bias の学習対象は 1,540 数値、JSON は 49,855 bytes。エンコーダー本体は更新しない。

選択 epoch は 89。訓練受理率と検証受理率の最低値が最も高い epoch を選ぶ。訓練の受理条件は正解・確率 0.75 以上・差 0.25 以上、検証の受理条件は正解・確率 0.62 以上・差 0.15 以上。独立評価の本文を head 学習やこの選択に使っていない。

保存済み head の `selectedUsing: "validation only"` は厳密な説明になっていない。実際の選択条件は上記のとおり訓練と検証の両方であり、独立評価だけを見ていない。重みを固定した状態の証跡を保つため、この初回 artifact のラベルは上書きしていない。次回生成する artifact では正しい説明を記す。

最初は全文の埋め込みから関係を学習し、人工検証でも約 67% に留まった。この失敗の head とレポートは `initial-full-sentence/` に残している。部品名・寸法語を一般名詞へ置換し、関係の実際の表現は残した後、人工訓練・検証の分類はともに 100% になった。

その後に初めて独立評価を実行すると、初回 30 文は 21/30、同種部品の追加 6 文は 5/6 だった。人工検証との差を記録する。句の切り出し、名詞の否定、無関係な後半節の否定が主な失敗だった。同じ独立文を見た後の一般修正は回帰確認とし、head・類似度の説明文・閾値の再調整には使っていない。結果の正本は隣の `../evaluation/` に置く。

後の修正では句の直後の読点を、親部位を落とさずに扱うようにした。freeze 2 の回帰は CPU が 29/30、同種部品 6/6、追加 8 文 5/8。実際のブラウザー UI は 28/30、6/6、4/8 だった。CPU/WASM の確率が受理閾値をまたぐ例、geometry がまだ受け付けない貫通組み合わせが残る。

CPU の最適化設定、ブラウザーでの batch8/batch1 による埋め込みの差も確認した。実運用の WASM batch1 に合わせた別 head の学習を [wasm-head-v1](wasm-head-v1/README.md) に残す。追加の独立 8 文で元/new head はともに 8/8 で、この追加実験の精度優位は示せていない。本番版の元 head は上書きしていない。

実操作では `白い細い棒の先に大きな球` も保留した。部品・寸法・句切りは正しいが、関係入力へ色語が残り、none の確率が高くなる。CPU は none 約 0.895、WASM は約 0.890。色語なしの `細い棒の先に大きな球` は受理した。色と構造の関係を分離し切れていない現在版の限界として `development-color-reason.json` に残す。色のある自由文章まで安定して解釈できるとは主張しない。

`training-report.json` の初回 `embeddingMs` は計時位置に誤りがあり、head の学習時間も含む。エンコーダーだけの時間として引用しない。`totalMs` はモデル初期化を含む学習スクリプト全体である。修正済み `train.py` での次回実行では、埋め込みと head の学習を別に計測する。

## CPU とブラウザー

Python は CPUExecutionProvider、ブラウザーは Web Worker 内の ONNX Runtime WASM、1 thread で動く。GPU を必須としない。ブラウザーへ Python サーバーを起動する必要はない。

両実装で attention mask を使った mean pooling と L2 正規化を行う。最大 128 token、先頭の特殊 token を残して末尾側を使う。ONNX の出力は 384 次元。ブラウザーでは tokenizer の自動切り詰めに依存せず、同じ末尾側の方針を実装する。Python/ブラウザーの結果差は独立評価で比較する。

開発用 7 文の初回ブラウザー確認では、公式資産のダウンロード・チェックサム確認・初期化を含む準備が約 8.86 秒、その後の解釈が 8.6〜38.9 ms だった。これは開発確認であり、独立評価ではない。モデルを読み込む初回準備と、毎回のモデル→構造→文字描画・吸収の全工程を別々に記録する。

実測環境は Apple Silicon Mac。普通の 16GB Windows / CPU / iGPU 端末を想定しているが、その実機での 10 秒保証は未検証。入力を送信して有料 API を使う方式は採らない。初回はネット接続と約 127MB のダウンロードが必要で、速度は接続に依存する。

## 出所・取得・安全確認

エンコーダーは [sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/tree/e8f8c211226b894fcb81acc59f3b34ba3efd5f42)、固定 revision `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`。公式モデルカードのライセンス表示は Apache-2.0。以前の取得 manifest は `../../skeleton-surface-v1/server/model-manifest.json` に残す。モデルのライセンスと、このリポジトリ自身の配布条件は別である。このリポジトリの学習データや自作 head に、存在しない MIT ライセンスを推定しない。

ブラウザーは公式の固定 URL から以下の 3 ファイルだけを取得し、byte 数と SHA-256 を確認して CacheStorage へ保存する。ONNX / JSON はデータとして読み、ダウンロードした Python コードなどを実行しない。入力本文を URL・送信 body・外部ログへ含めない。キャッシュが使える場合、毎入力でモデルをダウンロードしない。

| ファイル | bytes | SHA-256 |
| --- | ---: | --- |
| onnx/model_qint8_arm64.onnx | 118,412,398 | `783fea82d71a58179b830a4dbd2d58447e640609e98eedf9ffa12622d375a672` |
| tokenizer.json | 9,081,518 | `2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8` |
| tokenizer_config.json | 526 | `5036ea374ffedd706e3bef33e2e0d6953cb868ef8a490e76e32ba0faa37a6b9b` |

合計 127,494,442 bytes。modelLoadMs の downloadedBytes は、実際にネットワークから読み込んだ byte 数を報告する。JSON は公開するが、エンコーダーの 118MB の重みは Git 履歴に追加しない。

固定した自作 head の SHA-256 は `2b5e212a7b8fec5cbf9683620ba7883c77e74140ccb65a1e91bc5ca1f5618a87`。訓練文・検証文の hash と epoch は head に含む。人工例文だけを公開し、本人の執筆本文・参考本・画像・端末固有の情報を含めない。

## 再現

リポジトリ root を基準に、Python の環境に NumPy / onnxruntime / tokenizers が必要。固定モデルの取得には、既存の `experiments/skeleton-surface-v1/server/fetch_model.py` を指定した保存先へ使う。共有環境を勝手に置き換える必要はない。

```sh
python experiments/scaffold-program-v1/model/predict.py --model-dir /path/to/verified-model --text '棒の先に球'
python experiments/scaffold-program-v1/model/test_contract.py
```

再学習するときは人工データ・head・ブラウザー JSON の新しい hash を取り、独立評価の初回結果を保存してから比較する。初回結果を新しい結果で上書きしない。

```sh
python experiments/scaffold-program-v1/model/data.py
python experiments/scaffold-program-v1/model/train.py --model-dir /path/to/verified-model
python experiments/scaffold-program-v1/model/export_browser.py
```

ブラウザー入口は `prototypes/glyph-creature/program.html`。root の公開導線と版管理は別の担当が管理する。`source: semantic-model` はモデル経由の有限プログラムを返したことを意味し、任意の物体の生成ができたという意味ではない。
