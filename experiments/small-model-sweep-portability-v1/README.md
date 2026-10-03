# 小モデル20 artifact比較を、小窓の採用へどう結び付けるか

2026-10-03。rootが比較を開始した後に、担当が新しい品質・性能結果を見ずに作った読み取り調査と判断案。実験開始前の事前登録ではない。評価文の本文・正解は未読、モデル起動・取得・buildは0件。20はcallerが予定したartifact数で、20個の独立したarchitectureを意味しない。

今回の比較は、文章から**用意した12形と少数属性を提案するCPU処理**の検査である。任意物体の新しいmeshを生成したり、3D表示までを測った結果ではない。意味の採点は固定した独立scorerを使い、driverの`contract_ok`と分ける。duplicate JSON keyを厳密scorerが拒否する一方でdriverが受け付ける差もあるため、形式成功数をscorerの意味成功数へ流用しない。

## いまの比較の位置

[固定driver R2](../small-model-sweep-runtime-v1/run_r2.py)はCPU thread4、context2,048、parallel1、最大256出力、temperature0、seed17、非stream、cache off。GPUを使わず各artifactを順次試す。b11342と別forkが必要なartifactはruntime別の行にし、同じruntimeで測った順位に混ぜない。

これは端末内CPUで実行できるかという一段階であり、一般16GB laptopで作業を邪魔しないことの実証ではない。CPU4 threadは4 threadまで使う設定で、CPU使用率4%という意味ではない。CPU backendというlabelも、CPU使用率を測った値ではない。R2はwall timeとserver RSSを取るが、CPU時間・GPU負荷・電力・thermal・他アプリの遅延を採っていない。

事前のfile hashは起動計時から外すが、file cacheを温め得る。初回取得量、取得時間、model file bytes、起動時間、query wall、RAMは別の項目。250ms RSS標本の最大はsampled peakであり、真の瞬間peakや全小窓の使用量へ置き換えない。[計測の範囲](../small-model-sweep-runtime-v1/README.md)。

## 常駐する役割を小さくする

| 役割 | 寿命の案 | 比較すること |
| --- | --- | --- |
| 文字・色・材料IDと表面描画 | 小窓の表示中に保持 | 既存表現の面の被覆、通常15fps、停止/非表示で描画停止 |
| 作者の語彙・形状library・静的特徴 | 小さい処理なら保持候補 | rendererと合わせた全体RAM/CPU、意味の別評価 |
| 0.8B等の生成model | まずオンデマンドで起動、提案後に終了 | 取得量ではなく全体peak、起動込みの30秒、終了後の回復 |
| 短い形・色・動きの提案 | 解釈後に保持 | staleな提案の排除、文字材料が上書きされないこと |

「16GBに入る」から常駐採用へ飛ばさない。既存の[小窓予算案](../../research/widget-first-20261002.md)は通常全体200MiB程度・解釈中512MiB以内であり、今回のモデル名や結果を理由に予算を緩めない。超えるartifactも比較資料として残し、任意の手動実験や教師候補と、小窓標準機能の採用を分ける。

オンデマンドは終了後のRAMを減らす案であって、起動中の大きいpeakを消す方法ではない。CPU4 threadとGPUなしは互換性比較の基準で、常用時の理想設定ではない。後で同じ固定artifactを1/2/4 threadで別比較し、他の作業の応答と発熱まで確認する。

## 入力頻度と推論頻度

材料は確定差分ごとに追加し、意味の解析は毎キー・毎frameでは行わない。最初の設計案は、5〜10秒の入力休止とdirty状態で要求し、最短60秒間隔にする。無入力時に周期的にLLMへ同じ文を送り続けない。新しい文が来たら待機要求は最大1件へまとめ、処理中の古い返答は接続世代・材料revision・request IDが合う場合だけ提案候補にする。

形の自動周期は軽い作者定義処理のまま残せる。明確な語は既存処理を先に使い、曖昧な入力の限られた窓だけをモデルへ渡す。現promptは明示的な提案要求と保留を評価しているため、日常の文章から自由に連想する用途の採否を同じ命令精度だけで決めない。5〜10秒と60秒はAI提案で、快適性を人が実証した周期ではない。

無入力の繰り返しpollよりイベント・完了通知を使い、不要なtimerを止める方針はAppleの[Energy Efficiency Guide](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/MinimizeTimerUse.html)と整合する。今回の測定用RSS samplerは一時的な検証器で、製品の常駐監視へそのまま組み込まない。

## 採否を分ける

[結果閲覧前の判断案](ADOPTION-PRIOR-R1.json)を固定した。人工24文だけを通っても一般的な日本語理解とは呼ばず、候補を絞るpilotとする。精度・性能がどちらか不足したartifactも、未対応runtime・timeout・形式違反・意味誤答へ分類して残す。失敗を除いて速さの中央値を作る場合は、除外数と理由を同じ表へ添える。

標準採用には、モデルを接続した実小窓で全体予算を確認し、一般16GB機で起動から形成までを測り、執筆・開発を続けられるかを本人が確認する必要がある。CPU llama-serverだけの軽さで、現在の公開Web版を置き換えない。

- [待機の測定手順案](IDLE-PROTOCOL-R1.md)
- [Prism CPU buildの読み取り提案](BUILD-PROPOSAL-R1.md)
- [現環境のtoolchain確認](TOOLCHAIN-R1.json)
- [一次sourceと読取範囲](SOURCE-NOTES-R1.json)
