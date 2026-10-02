# ローカル意味モデル

CPU上の多言語MiniLMで、6種類の作成可能な形と、限定した寸法・曲がり・ねじれを選ぶ。ブラウザが選ばれた仕様から表面を構築し、文字を配置する。任意の新規メッシュを出力する汎用3D生成モデルではない。

モデル推論、仕様の検証、ブラウザ側の形構築、文字配置、表示を合わせて生成時間として扱う。APIの `modelMs` はそのうち入力解釈の時間だけで、全工程の生成時間と混同しない。

## 起動

リポジトリのルートから、Python 3.12以上を推奨。

```sh
python3 -m venv .local/scaffold-venv
.local/scaffold-venv/bin/python -m pip install -r experiments/skeleton-surface-v1/server/requirements.txt
.local/scaffold-venv/bin/python experiments/skeleton-surface-v1/server/fetch_model.py
.local/scaffold-venv/bin/python experiments/skeleton-surface-v1/server/app.py
```

Windowsでは `.local/scaffold-venv/Scripts/python.exe` を使う。APIは `127.0.0.1:4213`、許可するブラウザは `127.0.0.1:4212` と `localhost:4212`。他のポートは `--port` / `--frontend-port` で指定できる。すでに同じ固定リビジョンを取得済みなら `--model-dir` でその場所を指定して読み取り専用で再利用できる。

```sh
python experiments/skeleton-surface-v1/server/test_contract.py
```

## モデルが決める部分と手で定めた部分

- MiniLMが入力と形説明の類似度を計算し、6種類のfamilyを選ぶ。花を飾るための器など、登録した名前と完全一致しない文章も比較する。
- 登録済み名詞があれば、作者の辞書で名詞を切り出してからモデルへ渡す。否定された名詞は取り除く。名詞の切り出しはルールであり、モデル性能として数えない。
- 寸法などの明確な修飾語は作者のルールで固定数値へ対応する。`evidence` 内の `explicit-attribute-rule` として明示する。
- 語彙に一致しない修飾語は学習済み埋め込みと対立する属性説明を比較する。`embedding-descriptor` として明示する。この部分も限定した属性の意味検索であり、任意形状の発見ではない。
- 類似度や候補差が足りない時は `spec:null`。未知の形を成功扱いにせず現在の形を保つ。返却する仕様は有限数のみ、寸法に上限・下限を設ける。

たとえば `すらっとした花入れ` はheightが上がる。`長くて細い剣` はheight/widthのルールを組み合わせる。これらは開発用の例で、独立評価文とは別。

## 出所・安全性・制限

固定リビジョン `e8f8c211226b894fcb81acc59f3b34ba3efd5f42` の [Sentence Transformers公式モデル](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/tree/e8f8c211226b894fcb81acc59f3b34ba3efd5f42) はApache-2.0。採用するONNX重みは118,412,398 bytes、関連データを含む取得量は127,499,457 bytes。各ファイルの公式URL・サイズ・SHA-256は `model-manifest.json` に固定。重みとtokenizerのSHA-256をAPI起動時にも検査する。Pickleやモデル配布元のPythonコードを読み込む処理は使わない。

取得処理だけがダウンロードを行い、起動後の解釈処理は外部へアクセスしない。入力本文は保存・ログ記録・返信へ転載しない。動作確認済みCPUはApple Silicon Mac。16GB Windows laptop/iGPUでの実測結果ではない。ARM向け量子化のONNXをCPUExecutionProviderで使用するため、x86 CPUでの互換性・速度は別途確認が必要。入力は最大4,000文字、推論は末尾128トークンまで。

## ブラウザだけで使う版

比較画面の「小型モデルを準備」では、同じ固定リビジョンのONNX重みとtokenizerデータ計127,494,442 bytesを公式配布元から取得・SHA-256検査し、ブラウザのCacheStorageへ保存する。準備後は入力文章を送信せず、このブラウザのWeb WorkerでCPU/WASM推論を行う。Pythonサーバーは不要。

ONNX Runtime Web 1.22.0（MIT）のWASMとモジュール、Transformers.js 3.8.1（Apache-2.0）のtokenizer実装はWeb版と一緒に配信する。GPUやSharedArrayBufferに依存せず、CPU 1スレッドを使用。推論に使う形説明・属性・制約は `export_browser_config.py` で同じPython設定から書き出す。

このMacのHeadless Chromeで、初回ダウンロードを含む準備は開発時2回に8.84秒と10.01秒。ネットワーク条件で変わる準備時間であり、PC一般で10秒以内と保証する値ではない。取得後の再準備は1.75秒。HTTPS通信をブロックした状態でも取得量0、外部リクエスト0で、花瓶の言い換え・高さ・メビウス・通常文の保留を確認した。これは開発用smokeであり、独立評価の正答率には加えない。記録は `browser-cache-smoke.json`。

入力解釈だけの時間は開発例で約6〜36ms。形生成と文字の吸収まで含む時間は比較画面の計測と別の実操作評価で確認する。初回取得・再準備・入力の全工程をそれぞれ分け、意味が間違ったまま速いことを成功としない。
