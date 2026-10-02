# 実native比較 R1 の独立読み取り監査

2026-10-03 JST。測定終了後の原票監査であり、新しい実測・UI確認ではない。担当範囲はこの `review-real-r1/` だけ。既存原票・閾値・アプリ・source・Gitを変更していない。

7区間のCPU、同時点のプロセス群footprint/RSS、カウンタ差分を独立に再計算し、保存summaryとの不一致は0件だった。明示PID・開始識別値・coalitionも各区間の保存された帰属記録と一致した。ただし、**WK再測定calmの既存gateはFAILのまま**。診断の鮮度に原因候補があるが、測定の末尾に実際に描かれたフレーム数は原票から復元できない。

## 監査方法と再現

入力はrootが公開用にコピーした [real-r1/](../evaluation/real-r1/) の原票。独立helper [audit.py](audit.py) は元validatorをimportせず、保存済みサンプルのCPU累積値と単調時刻からCPUを再計算し、同時点のPID群byte値を合計する。保存gateの結果・閾値は変更しない。結果は [audit-r1.json](audit-r1.json)。

リポジトリrootから、出力を新しい名前にして再実行できる。既存出力の上書きは拒否する。

```sh
python3 -B experiments/widget-metal-native-evaluation-v2/review-real-r1/audit.py \
  --input experiments/widget-metal-native-evaluation-v2/evaluation/real-r1 \
  --output experiments/widget-metal-native-evaluation-v2/review-real-r1/audit-replay-new.json
```

監査前の24個の元JSONのSHAを [source-manifest-r1.json](source-manifest-r1.json) に凍結した。監査後も全24個は同じbyte列で、公開コピーも一致している。対応結果と測定済みWKアセットのcode証拠は [telemetry-provenance-r1.json](telemetry-provenance-r1.json)。ローカルbundleや未公開元ファイルがなくても、公開原票に対する独立再計算は上記コマンドで可能。

## 観測値

CPUは明示したPID群の累積user+system時間の差を区間秒数で割った、**1論理コアを100%とする値**。charged footprintは各サンプルで全帰属PIDを同時に足した値の最大。RSSも同じ合計方法だが、charged footprintとは別の尺度であり、両方ともシステム全体のunique RAMではない。MiBは2^20 byte。CPUとframe-counterの区間は同じwall秒数を使う。

| 区間 | wall秒 | CPU % | charged peak MiB | RSS peak MiB | counter差 / wall秒 | 保存gate |
|---|---:|---:|---:|---:|---:|---|
| WK first calm | 90.008791 | 8.857505 | 173.2533 | 207.3281 | 1332 / 14.798555 | PASS |
| WK paused | 30.007369 | 0.005233 | 128.5814 | 208.3594 | 0 / 0 | PASS |
| WK hidden・非pause | 30.009546 | 0.178508 | 128.7533 | 212.4063 | 0 / 0 | PASS |
| Metal calm | 90.004060 | 2.661117 | 68.2978 | 85.1875 | 1358 / 15.088208 | PASS |
| Metal paused | 30.005670 | 0.001357 | 24.1415 | 84.7813 | 0 / 0 | PASS |
| Metal hidden・非pause | 30.010050 | 0.001953 | 25.1571 | 87.7031 | 0 / 0 | PASS |
| WK repeat calm | 90.004209 | 7.681079 | 124.2532 | 230.6563 | 1258 / 13.977124 | **FAIL** |

calmは181サンプル、pause/hiddenは61サンプル。counterはアプリが報告した値であり、GPU完了時刻・ディスプレイ提示時刻・実表示FPSを直接測っていない。pause/hiddenで0増加、CPUが低いことは停止動作と整合するが、WKの状態通知は同じpacketを繰り返し読むため、この監査だけで全時刻のUI状態を独立に保証しない。

## WK再測定のカウンタ鮮度

保存validatorは `14..16 counter/s` を要求し、再測定は `1258 / 90.004209 = 13.977124` でFAILになった。この値・判定は維持する。

再測定では181サンプル中の新しいnative packetは18個。最後のpacketはsample 171（wall 85.507748秒）で現れ、その後は末尾まで10サンプル・4.496461秒にわたり同一だった。Web側 `uptimeSeconds` の始終差は85.545秒で、wallとの差は4.459209秒。`native.recordedAt` の始終差も85秒である。

| 診断 | WK first | WK repeat |
|---|---:|---:|
| wall秒 | 90.008791 | 90.004209 |
| Web uptime差 秒 | 90.577 | 85.545 |
| counter差 | 1332 | 1258 |
| counter差 / Web uptime差 | 14.705720 | 14.705710 |
| distinct packet | 19 | 18 |
| 末尾同一packetのwall秒 | 2.503649 | 4.496461 |
| packet間Web uptime差 秒 | 5.030〜5.034 | 5.030〜5.034 |

Web uptimeを後から分母にすると2区間はほぼ同じ値になる。これは**後付けの診断であり、gateの再定義やFAILのPASS訂正ではない**。最後の約4.5秒は直接の描画counter観測が欠けており、推定で補完しない。`recordedAt` は秒精度なので、ファイルmtimeとの差約5.69秒を正確なpacketの経過時間とみなすこともできない。

測定済みWKのBuildInfoはsourceCommit `c0166616c9000c03caa03ffd4bc6cfe90e0287f5` を記録している。実bundleの `assets/widget-C5NFoNhz.js` はBuildInfoのSHA `5e58d15b797e3a6fd1f8ec5a24f55b8e3d402b30352c5de14f7bc198e9fefbda` と一致し、周期報告条件は `e-z>5e3`、packetには `uptimeSeconds:performance.now()/1e3` が入る。現TSと凍結sourceコピーのhashも一致した。元のnative sourceは2ファイルともBuildInfoと一致した。native側の1秒保存抑制は、Web側の新しいcounterが1秒ごとに届く保証を意味しない。

次回は新しい版・原票で、区間の両端を同じ種類のfresh packetの時刻で揃えるか、別のrender/presentation診断を設ける案がある。今回の原票・判定は残し、方法を変えた再測定と区別する。

## 帰属・方法の差

[事前root条件](../evaluation/real-r1/METHOD-ROOT.json) はWK→Metal→必要ならWK再測定の順、人工本文、球体1537 stored / 1536 drawn、要求viewport400×440、15fps、60秒以上warmup、90/30/30秒、worker0としている。この監査は実行中に同席しておらず、quiet、warmup、UIの見た目はrootの実施記録に依存する。PLAN-R2は計測開始後の補足で、計測前の計画であったとは扱わない。

| trial | 明示PID | 保存したcoalition resource / jetsam | 留意点 |
|---|---|---|---|
| WK first | 90619 / 90631 / 90633 / 90634 | 61262 / 61263 | 起動前snapshotが欠け、`before_snapshot_missing=true` |
| Metal | 91567 | 61298 / 61299 | 単一main PID |
| WK repeat | 92146 / 92147 / 92148 / 92149 | 61314 / 61315 | main / GPU / Networking / WebContentを明示 |

保存された各サンプルのPID、プロセス開始識別値、coalitionは期待値と一致する。ただしfirst WKは独立した起動前後の全群差分ではない。rootが新規アプリとして帰属させた明示PIDとcoalitionを検算した範囲である。

終了記録ではfirst WKは計測後にrootが所有mainへSIGTERMを送り、`native_quit_verified=false`。MetalとWK repeatはrootが実Cmd-Qを行った記録。rootの保存終了結果は全帰属PIDの消滅を示すが、本監査者が改めて現プロセスを調べたものではない。通常終了の操作確認としてfirst WKを数えない。

期待値sidecarの `comparison_observations` はカメラ・フォント・WK内部byteの記入待ち文字列のままで、WK native telemetryからそれらを検算できない。MetalはcameraDistance8.887207、framingMinimum8.434593、zoom1、far100、atlas22kind・524288byte、instances122880byte、uniform176byteを報告した。**これらのcomponent byteをアプリwhole RAMとは扱わない**。WK側に同じcomponent値がないため、同じカメラ・字形やpixel等価の検証結果とはしない。

## 性能主張の範囲

Apple M5・32GBのこの保存されたwarm区間では、MetalのCPUとcharged footprintはWKより小さい観測値だった。Metalのcalm単区間は候補値CPU5% / charged200MiBを下回るが、**widget全体の目標達成判定ではない**。WK first/repeatもCPU・footprint・RSSが異なり、単回比較に信頼区間はない。

比較アプリは機能が同じではない。WKには根性版60形と6 primitiveによるProgramの経路がある一方、Metal比較版は球・箱・メビウスの3形のみ。6 primitiveはsphere・box・tube・blade・ring・vaseであり、Programの全組み合わせが6個という意味ではない。今回は両者の白い球体・no-modelを測った。Metal22kind / WK24kind、ID・seed・batch、カメラ軌跡、フォント・rasterizer・色管理の差がある。バックエンドだけを隔離した因果比較、全60形の性能、任意本文、モデル起動中、入力直後、冷コンパイル、長時間連続表示は測っていない。

Metalの `shaderCompileMS=1.211083` はこのアプリが測ったlibrary/pipeline準備のwall時間であり、OSの冷cache保証やプロセス全体の起動peakではない。submit p95等もCPUのcommand提出wallで、GPU実行時間・消費電力とは区別する。一般的な16GB laptop・iGPU、Windows、電池寿命への達成値として転用できない。

独立監査の結論は「保存帰属と計算に不一致なし、既存1 FAILを保持、診断鮮度と比較条件に上記制限あり」である。アプリ品質・生き物表現・全機能の合格判定ではない。
