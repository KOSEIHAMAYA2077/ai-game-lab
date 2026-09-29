# 小型AIによることば解釈の実験記録

2026-09-30 / v0.3.0に向けた技術評価

**端末内での無料のモデル実行は確認できたが、今回試した2モデルとプロンプトでは意味の誤りが残った。v0.3.0にはAIの自動解釈、モデル本体、読み込みUIを採用しない。** 対応することばを組み合わせる通常機能を残し、入力文は外部へ送信しない。

この結論は、小型モデル全般の不可能性を示すものではない。「モデルが起動した」「JSONを返した」と「意図した形になった」を分け、現状の体験に適した品質かを判断した記録である。失敗例も、次の候補やプロンプトを同じ条件で比べるために残す。

## 実際に確認した条件

- macOS、Chrome 152.0.7977.65、headless実行。WebGPUはApple Metalの実アダプターで、`shader-f16`が利用できた。
- `@mlc-ai/web-llm@0.2.85`を固定。Web Worker内で推論し、公開モデルファイルだけを取得した。クラウド推論API・APIキーは使用していない。
- 0.5Bは試作の入力UIから操作した。0.8Bは公開アプリを変更せず、同じ翻訳処理のモデルIDだけを差し替えた試験ページで比較した。
- 日本語文字列を直接入力した試験であり、OSの日本語IMEによる変換操作を検証したものではない。Windows、Safari、別GPUでのモデル実行は未確認。
- 時間は各1回の観測値。速度の保証や統計的なベンチマークではない。

| モデルID | 初回ロード | キャッシュ後の再起動 | 最初の推論 | 以後の推論 |
| --- | ---: | ---: | ---: | ---: |
| `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | 12.38秒 | 0.645秒 | 1.65秒 | 0.34〜0.46秒 |
| `Qwen3.5-0.8B-q4f16_1-MLC` | 21.44秒 | 未測定 | 2.27秒 | 0.62〜0.64秒 |

0.5Bの配布ファイル一覧から計算した重み容量は約278MB、トークナイザー等を含め約290MB。0.8Bは重み約424MB、周辺ファイル込み約447MB。別途WASM・ライブラリが必要で、通信量の実測値ではない。WebLLMの固定版には両モデルが登録されている。[WebLLM公式](https://github.com/mlc-ai/web-llm)、[0.5B配布ファイル](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/tree/main)、[0.8B配布ファイル](https://huggingface.co/mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC/tree/main)

## 意味を確かめた結果

| 入力 | 0.5Bの出力 | 0.8Bの出力 | 判断 |
| --- | --- | --- | --- |
| 箱の外側をレモン色に | 赤い円環、flow、1個、swarm | 黄色の円環、surface、1個 | どちらも箱を誤認。0.5Bは色も誤り |
| ドーナツをいくつも浮かべる | 黄色の円環、1個 | 色指定なしの円環、1個 | 複数を反映しない。0.5Bは色も勝手に指定 |
| サイコロをひとつ漂わせて | 黄色の四角形 | 色指定なしの十字 | 立方体として扱えていない |
| 今日はちょっと眠い | 黄色の四角形 | 色指定なしの凝縮 | 通常文に形の操作を割り当てた |
| 表面 黄色 立方体 | AIとしては未測定 | 黄色の立方体、surface、1個 | 0.8Bはこの明示的な入力に成功 |

0.5BはUIの状態を引き継ぎ、最初の2例を連続入力した。再起動後に後半2例を連続入力した。0.8Bは5例とも同じ初期設定を渡した。この差があるため、表をモデル全体の優劣や正答率と解釈しない。少なくとも未知の言い換えと通常文を自動処理する品質には、今回のどちらの構成も達していない。

全例で処理は完了し、ブラウザーエラーは発生しなかった。**構文・動作の成功と意味の成功が分かれたことが、今回得られた重要な結果である。**

## 再試験のための条件

WebLLMの`CreateWebWorkerMLCEngine`で上記モデルを読み込み、`context_window_size: 2048`とする。入力文と現在の設定を渡し、`temperature: 0`、`max_tokens: 160`、`stream: false`で1回ずつ生成した。未指定の生成パラメーターは配布モデルの既定値。20秒で中断する上限を設けたが、今回の入力では到達しなかった。

初期設定：

```json
{"shape":"condense","mode":"surface","count":1,"arrangement":"single","deformation":"gentle"}
```

出力は`response_format: { type: "json_object", schema: JSON.stringify(schema) }`で制約した。オブジェクトの全項目を必須とし、追加項目は認めない。

| 項目 | 許可した値 |
| --- | --- |
| shape | condense, vortex, orbit, mobius, ring, cube, cuboid, cross, triangle, square, none |
| mode | flow, surface |
| count | 1〜16の整数 |
| arrangement | single, swarm, chain |
| deformation | gentle, omega, double |
| color | white, red, yellow, blue, cyan, green, purple, pink, unspecified |

システム指示は以下。`<CURRENT_JSON>`を現在の設定JSONへ置換し、別のuserメッセージへ試験入力を渡した。実装では入力の先頭1,000文字までを使用した。

```text
Translate Japanese input into a bounded 3D glyph scene JSON. Output data only. Colors apply only to the newly typed characters. No color mentioned = unspecified. Unknown object or ordinary prose = shape none; never pretend an unknown shape exists. One shape only. Circle/ring=ring, box=cube, rectangular box=cuboid, triangle=triangle, square=square, cross=cross, Möbius=mobius, atom=orbit, spiral=vortex, ball=condense. Flow=flow, surface=surface. Count 1 uses single; multiple uses swarm. Chain must be ring. double means 2 separate unequal rings. Defaults: <CURRENT_JSON>. Examples: 輪っかを八つ浮かべて => {"shape":"ring","mode":"flow","count":8,"arrangement":"swarm","deformation":"gentle","color":"unspecified"}. 黄色い箱の表面 => {"shape":"cube","mode":"surface","count":1,"arrangement":"single","deformation":"gentle","color":"yellow"}.
```

応答が正常終了した場合だけJSONを読み、`none`は形の変更なし、`unspecified`は色の指定なしとして扱った。描画前にも列挙値・個数と、鎖は円環、singleは1個、doubleは大小2個の円環という整合性を検証した。任意のコードは実行していない。それでも意味の誤りは検出できなかった。

再試験では同じ入力・初期設定・プロンプトを固定し、通常文を誤操作としないこと、色を捏造しないこと、個数と形を守ることを評価する。今回の未完成コードやモデルは公開アプリへ同梱しない。[固定版Worker API](https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/web_worker.d.ts)、[固定版の応答形式](https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/openai_api_protocols/chat_completion.d.ts)

## 通信と既知語による操作

ブラウザーのリクエスト観測では、初回ロード時の外部通信は0.5Bが23件、0.8Bが29件で、すべてGETだった。宛先は`huggingface.co`、`raw.githubusercontent.com`、`us.aws.cdn.hf.co`。POSTデータ付き通信は0件で、**各入力の推論中に外部リクエストは発生しなかった**。これはこの試験の観測結果であり、任意の将来構成についての保証ではない。v0.3.0ではAI依存と読み込みUIも外す。

公開版のことば操作は、対応語から「形・配置・流れ・個数・追加文字の色」を取り出す処理である。学習モデルや一般的な文章理解を実装したものではない。普通の文章は文字の材料として受け入れられる。

試験時には「輪っかを八つ浮かべて」の「輪」だけが認識され、AIを通らず1個になった。一部分が既知という理由だけで文全体を理解済みにしないことも、将来のモデル併用に向けた課題である。v0.3.0では「八つ」も辞書側で個数として扱うよう修正した。語彙追加とモデルの性能改善は区別して記録する。

## 将来の形生成への接続

モデルを再検討する場合も、自然文から限定された設定データを得る処理と、実際に形・文字・流路を生成する処理を分ける。Qwen2.5とQwen3.5の公式カードにある多言語・試作用途の説明は候補選定の根拠になるが、この作品の日本語解釈を保証するものではない。[Qwen2.5-0.5B公式](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)、[Qwen3.5-0.8B公式](https://huggingface.co/Qwen/Qwen3.5-0.8B)

**ネット検索→形の把握→任意の3D形状や流路の生成は未実装。** 先に既知の球・円環・箱を組み合わせる方式、その次に既存メッシュを取り込む方式を比較できる。Three.jsの`MeshSurfaceSampler`はメッシュ表面の点・法線・UVを取得でき、文字を表面へ配置する候補になる。ただし、自然に循環する経路や面のつながりまで自動で得られるわけではない。[Three.js公式](https://threejs.org/docs/pages/MeshSurfaceSampler.html)

画像→3Dの例としてTRELLIS.2を調べた。公式実装はLinux、NVIDIA GPU 24GB以上を前提としており、今回の軽いブラウザー試作へそのまま組み込める構成ではない。生成したメッシュが意図した連結やねじれを持つか、文字をどう循環させるかの確認も別に必要になる。[TRELLIS.2公式](https://github.com/microsoft/TRELLIS.2)
