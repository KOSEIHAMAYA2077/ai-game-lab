# 無料小モデルを実際に動かす比較

2026-10-03、2時間の許可を受けて、**23種類の重みを実行した。新規取得21種類、既存対照2種類**。Bonsai、Qwen、LFM、SmolLM、Granite、Phi、BitNetと、低ビットの別形式を含む。新規重みは合計19.114GBで、固定revision・配布元bytes/SHA256を照合した。モデルの重みはローカルに残し、GitHubには測定・人工文・原返信・再現手順を公開する。

形・色・個数・動きをまとめて提案する24文では、Bonsai 4B Q1とPhi-4-mini Q4が最多の17/24全一致。形だけを選ぶ別の36文では、Bonsai 4B Q1が28/36だった。**この比較では、軽い常駐モデルとしての既定採用を決めない。** 誤解釈が残り、server単独でも約0.6〜5.3GiBの最大RSSを観測した。既存の根性版・小窓・保存・公開URLを維持する。

ここでいうモデルの仕事は、用意した12形の選択である。任意の3Dメッシュを自由生成した結果ではない。日本語の文から形を連想する用途に使えるか、日常文章で楽しめるか、仕事の邪魔にならないかは別に確かめる必要がある。

## どこを読むか

| 知りたいこと | 記録 |
| --- | --- |
| 全候補の得点・返信時間・server RAM | [全26実行の表](TABLE-R1.md)、[機械可読台帳](RUNS-R1.json) |
| 24文の独立採点・形式の失敗・再試行 | [独立REPORT-R2](../small-model-sweep-evaluation-v1/REPORT-R2.md)、[人工原返信](../small-model-sweep-evaluation-v1/raw-public-r2/) |
| 形だけの未見36文 | [独立比較](../small-model-sweep-shape-only-evaluation-v1/results-r1/README.md) |
| 計算領域を減らす比較・10分待機 | [独立資源診断](../small-model-sweep-resource-evaluation-v1/README.md) |
| 配布元・固定SHA・ライセンス | [初回候補](../../research/small-model-sweep-public-catalog-v1/README.md)、[追加候補](../../research/small-model-sweep-extra-20261003/README.md)、[取得台帳](../../research/small-model-sweep-ledger-20261003/PUBLIC-README-R2.md) |
| CPU運用と一般PCで残る確認 | [移植・採用条件](../small-model-sweep-portability-v1/README.md) |
| 今回の承認範囲と現在地 | [BRIEF](BRIEF.md)、[STATUS](STATUS.md) |

## 実際に分かったこと

### Bonsaiの低ビットは取得量を抑えるが、常駐RAMとは異なる

確認した公式Bonsaiは[1.7B](https://huggingface.co/prism-ml/Bonsai-1.7B-gguf)、[4B](https://huggingface.co/prism-ml/Bonsai-4B-gguf)、[8B](https://huggingface.co/prism-ml/Bonsai-8B-gguf)。今回、公式の0.8Bは見つからなかった。0.8Bそのものの代わりにはQwen3.5の重みも試した。名称のBはパラメーター数、GBはファイル量である。

| 重み | 取得量 MiB | 24文全5属性一致 | 返信p95秒 | server最大RSS MiB |
| --- | ---: | ---: | ---: | ---: |
| Bonsai 1.7B Q1 | 236.8 | 3/24 | 1.481 | 819.8 |
| Bonsai 4B Q1 | 545.8 | 17/24 | 3.432 | 1497.7 |
| Bonsai 8B Q1 | 1105.0 | 6/24 | 6.197 | 2501.8 |
| Granite 4 1B Q4 | 976.2 | 14/24 | 2.404 | 2246.0 |
| Phi-4-mini Q4 | 2376.4 | 17/24 | 3.972 | 5152.0 |

表は一つの固定条件での観測。Phi-4-miniは初回20候補を見た後に追加した別群であり、同じ候補選定計画の一員だったとは扱わない。runtime・GPU利用・量子化・promptを最適化しきった製品比較でもない。4Bより大きい8Bの得点が低かった例は、小さな日本語契約でサイズだけから採用を決められないことを示す。

### 色などの規則と形の解釈を分担する候補

小さなモデルが指定のない色や動きを補ってしまう例が多かった。そのため初回契約を変更せず、`action`と`shape`だけを返す別promptを作り、独立担当が別の未見36文を固定した。Bonsai 4Bは28/36、8BとGranite 4は26/36。Bonsai 4Bでも保留12文のうち4文に誤提案した。

24文と36文は契約も問題集合も異なる。「3/24から16/36へ改善」のような直接比較はしない。また、保留の契約は命令解釈の安定性を見るためのもの。**日常の文章中に現れた単語から連想すること自体を禁止する製品仕様ではない。** 文章への連想では、望ましい驚き・無関係な変化・邪魔さを別に評価する。[既存の連想方針](../../research/ambient-association-policy-v1/README.md)を残す。

### 互換性の失敗も試したまま残した

- Ternary BonsaiのPQ2_0は共通runtimeでロード不可。公式Prismの別runtimeでは24返信、全一致4/24。別runtime群として記録した。
- Phi-3.5-miniの初回はロードしたが24要求がHTTP400のgrammar初期化失敗。`--no-jinja`の別実行では24返信、全一致12/24。元の失敗は保存した。再試行は同じ文を見た互換診断である。
- BitNet I2_Sは共通runtimeでロード不可。固定公式sourceをMacでビルドし、共有link失敗・静的build失敗を保存。元sourceを残す別copyに一式だけ修正してbuildしたが、24文のうち最初の1要求が30秒を超え、残り23文は未試行。旧重みのpre-tokenizer警告もあり、モデル一般の品質や全BitNet実装の性能を断定できない。修正した数値kernelの正しさは検証していない。

26実行は23重みに再試行3件を加えたもの。22重みが各24本文返信を返し、528本文。24件のHTTP400・1件のtimeout・71未試行を別に数える。実行driverの`completed`は、意味やHTTP成功の証明ではない。

その後の[BitNet単独micro診断](../small-model-sweep-bitnet-diagnostic-v1/README.md)では、短い1要求に5.075秒でHTTP返信したが、指定した `sphere` に対し `@@@@@@@@` を返した。固定24文の成功へは加算しない。このCPU build・重みの組み合わせでの結果であり、BitNet一般の性能を断定しない。

### 計算領域を減らした後の待機

形だけの試験を終えてから、Bonsai 1.7B/4Bでcontext1024・batch64・ubatch32・出力上限128を試した。同じ36文を再使用する開発診断であり、新しい未見精度の改善とは扱わない。4条件をまとめて変更しており、RAM差を一つの設定の効果へ分解できない。

| 候補 | 形だけの初回一致 | 縮小条件の一致 | server最大RSS MiB・初回→縮小 | 返信中央値秒・初回→縮小 |
| --- | ---: | ---: | ---: | ---: |
| Bonsai 1.7B Q1 | 16/36 | 16/36 | 819.3 → 697.8 | 1.005 → 1.070 |
| Bonsai 4B Q1 | 28/36 | 29/36 | 1496.4 → 1336.1 | 2.450 → 2.640 |

4Bの追加の1正解は、元の契約違反が有効な形提案になった1文。保留文への誤提案4/12は残る。4Bは返信後600.074秒待機し、server CPU累積時間の増分0.75秒（1コア100%基準で約0.125%）、RSSは1313.19MiBだった。待機時の計算は少なくてもメモリは保持していた。

待機のCPUはserver単独で、監視・描画・OS・小窓全体を含まない。4Bのpeakは10分待機を含む長い測定窓なので、[独立診断](../small-model-sweep-resource-evaluation-v1/README.md)では要求処理中のpeakとも分ける。常駐の小ささを達成した結果として読まない。

## 次に作る構成

次の接続候補は、**根性版の面・文字の流れを維持し、Bonsai 4Bを必要なときだけ呼ぶ実験版**。まだ実装・採用したとは扱わない。

1. 確定した文字はモデルを待たずに身体へ追加する。色や個数など明示規則は既存の処理を使う。
2. 短い文がまとまった時点で、形の候補だけをローカルモデルへ問い合わせる。毎打鍵・毎フレームに推論しない。
3. 有限のshape IDを検査し、未対応・失敗時は現在の形を保持する。モデルが描画コードを生成・実行する経路にはしない。
4. 問い合わせを一つにまとめ、古い候補を捨て、しばらく入力がなければモデルprocessを終了する。待機中の描画は既存の低負荷処理が続ける。

候補の優先理由は、この固定比較ではPhiと同じ17/24でserver RSSが小さかったこと、形だけの別比較でも28/36だったこと。総合性能のランキングではない。外見を述べる文ではGraniteも残すが、server RSSや保留誤提案を別に判断する。

次の研究課題は、明示命令と文章の連想の切替、否定・引用・未知対象の扱い、生成を待たせる演出、モデル停止を含む小窓全体の資源、作者定義の形の範囲を広げる方法である。モデルに骨格や有限programを出させる段階は、この形選択での失敗を解消した後に別契約で比較する。

## 測定と未確認の境界

Apple M5 / 32GiB、CPU4threads、GPU/offloadなし。一度に一つのモデル、context2048・batch256・ubatch128・出力上限256、temperature0、seed17、prompt cache off。serverのreasoning offとtemplate kwargsを共通指定し、SmolLM3固有の `/no_think` など個別の文言は加えていない。モデルごとの推論modeが同等とは未確認。各要求のHTTP全体30秒。詳細は[METHOD](METHOD.md)、[固定driver](../small-model-sweep-runtime-v1/run_r2.py)。モデルの取得・コンパイルを推論測定と同時に行っていない。

返信時間は起動・取得・描画を含まない。モデルfileを起動前にhashするためcold-cache起動試験ではない。server RSSは250ms間隔の標本で、UI・driver・OSを含まない。一般16GBのIntel/AMD＋iGPU、常駐小窓全体、電力、実利用の意味精度、入力から画面完成までの30秒を達成した実証ではない。

無料で取得できることと、自由な商用再配布は異なる。特にLFMは独自licenseである。モデル提供のremote Python・pickle・install scriptは実行していない。重みの配布元とSHA照合は完全な無害性証明ではない。人工文だけをローカルloopbackで使い、個人本文は外部に送っていない。

## 再現する

1. [候補一覧の固定revision付きdownload URL](../../research/small-model-sweep-20261003/CANDIDATES-R2.json)から選んだGGUFを別local folderへ取得し、bytes/SHAを照合する。追加3件は[別一覧](../../research/small-model-sweep-extra-20261003/CANDIDATES-EXTRA-R1.json)。重みは本Git treeに含まない。
2. [runtime pin](../../research/small-model-sweep-20261003/ROOT-RUNTIME-SOURCE-R1.json)のCPU実行環境を準備する。PQ2とBitNetは[別runtime資料](../../research/small-model-sweep-special-runtime-20261003/README.md)とrootのbuild/patch記録を使い、同じ群に混ぜない。
3. 下の例で人工fixtureを実行する。既存labelを再利用するとdriverは拒否する。起動ポートは空いているloopbackを指定する。

```sh
python3 experiments/small-model-sweep-runtime-v1/run_r2.py \
  --server /your/local/llama-server --model /your/local/model.gguf \
  --label comparison-new-r1 --prompt experiments/small-model-sweep-v1/prompt-r1.json \
  --fixture experiments/small-model-sweep-evaluation-v1/cases-r1.json \
  --port 4220 --public-dir experiments/local-repeat/results \
  --private-dir .local/local-repeat
```

4. [固定scorerの引数](../small-model-sweep-evaluation-v1/README.md)に従い、`.local`の`responses.jsonl`を採点する。形式修復や期待値の変更をしない。shape-onlyは[別prompt](../small-model-sweep-shape-only-v1/prompt-r2.json)と[別scorer](../small-model-sweep-shape-only-evaluation-v1/README.md)を使う。

[公開前の独立照合](../small-model-sweep-publication-review-v1/REPORT-R1.md)で数値・原返信・公開用の参照を確認した。

今回の所有モデルは終了し、期限付き継続と専用スリープ防止を停止した。[終了確認](SESSION-CLOSE-R1.json)。

以前の資料・失敗した実行・旧model・アプリは保持している。今回の比較を、以前の8時間改善や人間の試遊結果へ合算しない。
