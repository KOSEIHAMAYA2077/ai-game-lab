# 13形native候補・実測値の独立監査 R1

2026-10-03 JST。**6区間の保存帰属・SHA・CPU / メモリ / 提出counter計算に不一致は0件**。元の数値gateは6区間ともPASSで、原票や判定を変更していない。[独立結果](audit-r1.json) / [root原票](../evaluation/real-r1/)。

これは測定終了後の保存値監査で、新しいUI操作やOS計測ではない。編集範囲はこのfolderだけ。rootの四形をこのApple M5・32GiB・macOS26.5.1 / build25F80で測ったwarm区間に限る。

## 値と分母

CPUは明示main PIDのuser+system累積差を、helperが記録した`CLOCK_MONOTONIC`の始終差で割る。100%は1論理コア。user / systemはhelperのMach timebase125/3からnsへ変換済みであり、start_abstimeとwall timestampを同じ時計軸として引き算しない。MiBは1,048,576byte。charged footprintとRSSを別に計算する。

| 区間 | wall秒 | CPU・1コア基準 | charged peak MiB | RSS peak MiB | 提出差 / wall秒 | 保存gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| sphere-calm | 90.004423 | 2.012647% | 69.8291 | 83.7500 | 1354 / 15.043705 | PASS |
| jellyfish-calm | 90.003464 | 1.591053% | 71.9228 | 87.6875 | 1359 / 15.099419 | PASS |
| butterfly-calm | 90.004745 | 1.596719% | 71.9385 | 87.7031 | 1355 / 15.054762 | PASS |
| saturn-calm | 90.005169 | 1.903167% | 72.2354 | 91.8750 | 1348 / 14.976918 | PASS |
| saturn-paused | 30.005750 | 0.000918% | 27.5479 | 91.4219 | 0 / 0.000000 | PASS |
| saturn-hidden | 30.003337 | 0.001593% | 28.1260 | 92.0938 | 0 / 0.000000 | PASS |

calm各181標本、pause / hidden各61標本。固定0.5秒間隔、calm90秒 / 停止30秒、元の14..16counter/sまたは停止0というgateを同じwall分母で確認した。四形のcalm観測値は候補CPU5% / charged peak200MiBを下回る。実窓の全13形、初期コンパイル、入力直後、長文、model起動、16GBノートPCや8時間連続使用の目標達成ではない。

保存された対象は全区間でPID1289、start_abstime10345184075329、resource / jetsam coalition62228 / 62229の単一main。全標本でPID・開始識別値・coalition・整数counterが一致し、user / system / lifetime footprintはそれぞれ減少しなかった。独立helperは原validatorをimportせず整数累積値から再計算し、各同時標本のfootprint / RSSのfirst・median・peak・lastを保存summaryと照合した。

公開用27fileのbyte / SHAはroot公開manifestと一致。BuildInfo・候補FREEZE・期待値のsource hash chainも一致し、candidate sourceが13形 / 10 authored形 / version0.3.0であることを記録した。実binaryの署名、privateな実行イメージの帰属、起動・操作そのものはrootの証拠に依存する。独立担当は改めてcodesign、process discovery、起動や終了を行っていない。

## 診断の時計と停止

frames / drawCallsは`command.commit()`直後に各1増える提出counterであり、全標本で両者は一致した。GPU完了数、presentation FPS、ディスプレイ提示時刻の直接計測ではない。`metalErrorCount=0`も保存された報告値であり、非同期の全GPU完了を本監査が観測したわけではない。

calmのunique packetはsphere88 / jellyfish88 / butterfly88 / saturn87。末尾の同じpacketの長さは順に0.498371 / 0 / 0.499882 / 0秒。scene時間の始終差は90.265124 / 90.600037 / 90.332616 / 89.865954秒で、wallとは一致しない。1秒以上ごとに書くnative診断の取得時点差として記録するが、scene時間を後付けの分母へ替えてgateを再定義しない。

停止 / 非表示では61標本を通じて同じpacketで、scene時間と提出数の差は0、scheduled=false。非表示はpaused=false。これはrootの停止 / Hide操作の記録と整合する。停止中の同一packetだけで、全時刻の視認性や新しい診断更新を独立保証しない。

Atlas22種類 / rows1 / bitmap524,288byte、instance122,880byte、uniform336byteが全標本で一致。Atlasの値はCPU bitmapのbyte数であり、textureやdrawable / driver等を含むwhole RAMではない。cameraDistance / framingMinimum / far / zoomも有限で、既定zoom1の下限を満たした。sphere8.887207、jellyfish15.348512、butterfly15.019279前後、saturn10.541693という異なるcamera距離も観測条件である。

`shaderCompileMS=1.555208`はアプリが計ったlibrary / pipeline準備のCPU wall時間で、OS cold cache保証や全起動peakではない。submit p95は最大1800回の直近提出history、maximumはprocess-lifetime最大で、warmupや前形を跨ぐ。個々の形のGPU実行時間や消費電力へ読み替えない。

## 方法の範囲と再現

[独立METHOD](METHOD-INDEPENDENT-R1.json)は原票・summaryを読む前に固定したが、root測定がすでに始まった後の文書。root自身の[事前METHOD](../METHOD-R1.json)とは分ける。[初期固定](METHOD-FREEZE-R1.json) / [原票27file固定](INPUT-FREEZE-R1.json)。監査codeはrootのtopline通知とrawの構造を読んだ後に作り、独立計算の実行前に[hash固定](AUDITOR-FREEZE-R1.json)した。数値監査を新しい盲検実験とは扱わない。

sourceからbody1537 stored / 1536draw、22種類の白い人工fixture、15fps、history保存をしないfixture経路を確認した。ただし実UI、warmupが60秒以上 / 後形10秒以上だったこと、quiet、実際の白色や起動時fixture指定はrootの条件sidecarに依存する。sample区間間には65.938841 / 42.425627 / 85.543595 / 56.767553 / 36.800883秒の間隔がある。計測window自体は90 / 30秒を保ち、この間隔を独立したwarmup証明や性能値へ使わない。

frozen R5 offscreen soakのPID93048 / 93049 / 93050は並行中で、候補PIDへ加算しなかった。root / agentの重いbuild / testは休止した記録だが、PC全体が無負荷だったとは言わない。別のoffscreen長時間試験をこのv3実窓の8時間信頼性へ合算しない。

root終了記録は同じ土星の窓をexplicit reopenしてactual Cmd-Q後にPID1289の消失を確認したもの。最初のrelative openは失敗しabsolute app pathへ直したと記録されている。本監査担当が実操作を繰り返したわけではない。旧v2との比較はsource、時刻、session、fixture条件が違うため、原因を隔離した改善率や13形対3形の効果にしない。旧v2監査のWK repeat gate FAILも、この新結果でPASSへ直さない。

リポジトリrootから、新しい結果名を指定する。既存出力は上書きしない。原票や独立計画は変更しない。

```sh
python3 -B experiments/widget-metal-native-evaluation-v3/review-real-r1/audit.py \
  --input experiments/widget-metal-native-evaluation-v3/evaluation/real-r1 \
  --output experiments/widget-metal-native-evaluation-v3/review-real-r1/audit-replay-new.json
```

今回確認したのは保存帰属と算術の一致、条件付きの四形の観測値まで。全機能・全形の品質、semantic model、入力連動、快適性、GPU利用率、電力、system unique RAM、Windowsを実証したものではない。
