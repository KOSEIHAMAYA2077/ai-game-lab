# 小モデルのCPU実測：文章から限定形状DSLを読む

2026-10-02 / Glyph Matter。**CPU推論は動作したが、この構成の意味精度は低く、作品への採用を見送る。** 今回は文章→部品データの段階だけを測定した。3D生成・面の接続・文字描画はこの実験に含まない。[研究と次の方針](../../research/16gb-text-to-3d-20261002.md)。

## 新しい比較と条件

- 以前のWebLLM版0.8B、MiniLM、4B自由座標とは別の評価。Qwen3.5-0.8B自体は以前から試しており、初導入ではない。
- 形を5種、ノードを最大4、部品総数を12以下、関係を10種に絞る。座標・Pythonコードは出さず、make/keep/unsupported・形・数・色・寸法方向・関係をJSONで出す。
- 日本語promptとschemaを先に固定し、別担当が人工24文を新作。make20、通常文keep2、制約外unsupported2。既存8 JSON資料・278文との正規化完全重複は0。これは担当者の人工評価で、外部の被験者実験や一般日本語能力の評価ではない。
- 最初のCPU比較をロックした後、同じ文・同じpromptでgrammarなし診断、Mac Metal診断を追加。これらは同じ問題の再使用であり、新しい未見精度として数えない。prompt、schema、期待値の調整・追加学習は行っていない。
- 実機は **Apple M5・32GB共有RAM**。16GB Intel/AMDノートの実測ではない。CPU比較はGPU層0、device none、演算・KV offloadなし、CPU4threads。別起動の診断ログでも0/25 GPU layersを確認。Metal診断は25/25。[backend確認](backend-verification.json)
- llama.cpp **b11342**の公式macOS ARM64バイナリ、context2,048、並列1、temperature0、seed17、thinkingなし、最大出力512token、prompt cache無効。出力長が異なるため速度はこの文章群の処理時間で、モデル単体の公平なtoken速度順位ではない。
- 0.8BはQ4_0、2BはQ4_K_Mと量子化方式も異なる。ここでは利用候補の比較であり、モデル規模だけの効果を分離していない。

## 最初のCPU評価

| 指標 | 0.8B / Q4_0 | 2B / Q4_K_M |
| --- | ---: | ---: |
| 独立した契約検証 | 24/24 | 23/24 |
| make/keep/unsupported一致 | 22/24 | 20/24 |
| 対象と個数 | 3/20 | 12/20 |
| 属性を含む対象と個数 | 1/20 | 5/20 |
| 指定された関係 | 1/15 | 0/15 |
| 全意味条件の一致 | **3/24** | **4/24** |
| makeの中の全意味一致 | **0/20** | **1/20** |
| 応答中央値 | 1.697秒 | 3.626秒 |
| 応答p95（nearest rank） | 1.965秒 | 4.540秒 |
| 新規プロセス→health | 0.821秒 | 1.227秒 |
| サーバーRSSの観測最大 | 1.353GiB | 2.686GiB |

[0.8B生出力](qwen08-cpu.json) / [2B生出力](qwen2-cpu.json) / [集計・失敗の一覧](summary.json)。成功の大半は形を作らない判定。2Bは単球の1文のみmakeの全意味条件を満たした。

RSSは250ms間隔のプロセス値で、短いピークを逃す可能性がある。OS・ブラウザ・GPU側の別割当・描画は含まない。初期化はファイル取得後・OSファイルcacheがある状態の新規プロセスであり、PCの完全な冷起動ではない。各文を1回ずつ測った結果で、長時間負荷や信頼区間は未測定。ファイル容量をRAMに置き換えたり、Windows16GBでの速度を保証したりしない。

## grammarとGPUの診断

| 同じ24文の再使用 | 契約 | 全意味条件 | 応答中央値 | p95 |
| --- | ---: | ---: | ---: | ---: |
| 0.8B CPU、grammarなし | 7/24 | 3/24 | 1.497秒 | 5.267秒 |
| 2B CPU、grammarなし | 19/24 | 4/24 | 3.132秒 | 4.417秒 |
| 2B Mac Metal、grammarあり | 24/24 | 4/24 | 1.076秒 | 1.636秒 |

形式制約を外しても意味条件の一致は改善しなかった。Metalではこの機械上の時間は短くなったが、意味条件の一致は4/24のまま。CPUとGPUでは数値計算経路が異なり、temperature0でも出力の一部が変わったため、完全な決定性や全て同一出力は保証しない。MetalのサーバーRSS1.487GiBをGPU共有メモリ込みの総必要量とは扱わない。

## 生出力で確認した失敗

- 「縦も横も同じ大きさの丸いかたまりを一つ」で、0.8Bは球を二つへ増やした。2Bは一つの球を正しく返した。
- ドーナツ状の穴のある形を、両モデルがunsupportedとした。torusは許可語彙にある。
- 横幅の広い角張った塊で、個数を増やし、伸長方向を落とした。
- 柱の周囲の六つの球を2Bは対象・数として保持しても、色を勝手に変え、aroundを出さなかった。
- 2B CPUの1例では関係が自身のIDを参照した。JSONとして成立しても独立した契約検証が拒否した。

モデルが動くこと、構文が成立すること、意図が形になることは別。メモリ量は小さくても、この結果から現行の根性版を汎用小LLMへ置き換える判断はしない。

## 採点と再現

[heldout.json](heldout.json)に入力・期待条件・禁止条件。[prompt.txt](prompt.txt)と[schema.json](schema.json)に固定契約。[run.py](run.py)はモデル推論をローカルで行い、[score.py](score.py)は出力を実行せず意味を照合する。

ノード名と順序、上下/左右の逆向き同義、対称関係の向きは許容。同属性で関係のない部品の個数を分割・集約しても等価にする。関係付きの個数群の分割・統合は推測しない。要求された関係を含み、矛盾・明示禁止関係がないことを見るため、完全なJSON文字列一致ではない。これは意味条件の照合であり、実際の形の可視性・接続・美しさは別。

採点器の自己検証7件で、ID再命名、向きの反転、余分な部品、個数分割、色と位置に同じ対応を使うこと、gapとtouchの排他、循環、不正型の拒否を確認した。

モデルと実行器は[manifest.json](manifest.json)の出所・revision・バイト数・SHA256を照合して取得。llama.cppは公式Release、0.8B GGUFはggml-org配布。2B GGUFはUnslothによる第三者変換で、Qwen公式BF16と区別する。コードはMIT、モデルはApache-2.0。これは出所と整合性の確認で、完全な無害性の証明ではない。モデル重み・実行器はローカルに置き、GitHubや試遊Webへ配布していない。remote Pythonやpickle、モデル由来のコードは実行しない。推論はlocalhostの人工入力のみで、クラウド推論・有料API・入力送信は使わない。

検証したバイナリとGGUFを別途用意した場合の再現例：

```sh
python3 run.py --server /path/to/llama-server --model /path/to/Qwen3.5-0.8B-Q4_0.gguf --label qwen08-cpu
python3 run.py --server /path/to/llama-server --model /path/to/Qwen3.5-2B-Q4_K_M.gguf --label qwen2-cpu
python3 score.py --self-test
python3 score.py qwen08-cpu.json qwen2-cpu.json
```

5実行を全て採点し直す場合：

```sh
python3 score.py qwen08-cpu.json qwen2-cpu.json qwen08-cpu-no-grammar.json qwen2-cpu-no-grammar.json qwen2-metal.json
```

`--no-grammar`で診断、`--backend metal`でMac GPU比較。スクリプトは取得・インストールをせず、指定された実行器だけを使う。RSSの採取はmacOSの`ps`を使うため、Windows版は別の計測経路が必要。

## 次の実験

同じ24文を調整データへ使って成績を上げない。これらは以降の回帰資料に移す。小さい意味encoderから形、属性、関係を別に学習するhead／専用decoderを比較し、文章と構造の学習データを自前生成する。未知の構成・否定・関係の新しい評価文は学習前に固定する。その後に配置ソルバーを接続して、既存の文字表面と同条件で画面を比較する。
