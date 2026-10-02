# 凍結Metal rendererの2時間offscreen継続試験

2026-10-03。Macロック中でも、GPUの表面写像・文字保持・atlas更新を実時間で継続確認する独立ハーネス。既存R5アプリ、shader、源コード、以前の原票を変更しない。

**これは窓アプリの通常表示・RAM・FPS試験ではない。** 400×440のoffscreen textureへ15fpsを目標に描くrenderer／CPU状態の継続試験。Macの小窓が通常CPU5%・200MiBに収まった結果として使わない。実UI、入力IME、drawable/presentation、WindowServer、GPU使用率、電力、Windows・16GB laptop実機は範囲外。

## 比較を固定するもの

- 凍結R5のMSL SHA-256 `e3416ddc373018f7dfb7359efe4f55779949ce4f5185b7862a000ef0cdebde9a`。build時にR5各source SHAも照合する。[凍結source一覧](evaluation/frozen-r5-source-manifest.json)。
- R5の`MetalMatter`、grapheme分割、Core Text atlas、GPUのpipelineを読み取り専用の参照として使う。Mainの窓・保存を実行しない。
- 原文も保存履歴も読まない。人工fixtureの1,536文字から始め、常に1,536の描画サンプル、80B instance、176B uniform、1 render draw/frame。
- 10分ごとに球→箱→メビウスを切り替え、人工CJK48文字＋かな＋family emojiを8回ずつ加える。400文字ずつ増え、青／黄を新batchだけへ指定する。元のID・本文・ink・intake seed、以前のatlas tile IDを照合する。
- 入力時だけinstance bufferとatlasを作り直す。古いtextureのSwift objectを弱参照で追い、commandの完了後に残る数を記録する。弱参照0はdriverの全てのRAMが解放された証拠ではない。
- materialの時刻は実時間。視点と形はR5の同じ数式。ハーネスは定常値のカメラを使い、native UIのeasing、15/30fps切替、窓の閉じる／再表示は試さない。

## 試験と指標

通常のsubmit壁時計はuniform計算からcommand commitまで。GPU in-flight待ち、画素readback、finite kernel、PNG、入力時atlas再作成は別の段階。全段階の遅れは実frame数・skipped deadlineへ現れる。submit p95は0.01ms刻みhistogramの上側binで、20ms以上はoverflow binの件数も確認する。

3分ごとに、実GPUから画素を読んで非空・色別sum・SHAを記録し、3形×5地点の位置／解析接線がfiniteかを別compute kernelで確認。各形の最初の検査時にPNGを保存する。通常の描画commandのMTL error、in-flight timeout、実FPS、原文／色保持、atlas行数、texture作成数、以前のobjectの残数を残す。固定seedで数値は再現できても、時刻とCPU/GPU schedulingの完全再現は要求しない。

資源は、このハーネスの**明示PID1つだけ**を5秒毎に計測する。既存の校正済み`native_metrics.c`を同じsourceから新しいhelperへcompileし、Mach timebaseを適用したuser/system counterから1コア換算CPUを計算する。charged footprintとRSSを別欄へ記録する。起動時library/pipeline準備はCPU区間の前に済ませる。process lifetime peakは初期準備を含むことがある。

他のCPU・モデル実験が並行する場合がある。app以外のdriverやcompiler serviceのPIDを加算せず、システムのunique RAMやGPU/powerを測ったとはしない。特にこの過程のcharged footprintを、窓表示も含むnativeアプリの値へ置き換えない。

## 先に確認した30秒

| 検査 | 結果 |
| --- | --- |
| 通常15fps preflight | 30.014秒、450frame、**14.993fps**、MTL error/timeout/skip 0 |
| submit | p95上側bin 0.23ms、最大1.877ms。全工程CPU時間ではない |
| preflight資源 | 有効15.04秒の1PID区間でCPU0.775%、peak charged footprint約59.5MiB、RSS約42.5MiB。終了後のmissing sampleが1つ |
| 加速した境界preflight | 30.009秒、450frame、3形、2回×400文字の追加、atlas1→4row、旧ID／ink／tile ID維持、旧texture object残数0 |
| 加速したGPU検査 | 6画素検査、90 finite地点、MTL error/timeout/skip 0 |

[通常preflight原票](evaluation/preflight/result.json) / [資源](evaluation/preflight/resource-summary.json) / [加速境界](evaluation/accelerated-preflight/result.json) / [境界イベント](evaluation/accelerated-preflight/boundaries.json)。加速版の10秒ごとの変更は、2時間本走行の10分ごとの変更と別条件である。

**最初の2時間予定走行は約30分の記録で中断、finalなし。** [原票と観測](evaluation/interrupted-2h-r1/ROOT-OBSERVATION.json)を保持する。別の終了コード付きsupervisorで新しいr2を開始した。現在地・PID・期限は[STATUS](STATUS.md)／[回復手順](../widget-metal-soak-recovery-v1/REPORT.md)。完了前の成功報告はしない。

## 再現と監視

リポジトリのルートで、既存ではないhelper出力とrun名を指定する。新しいハーネスだけを作る。

```sh
experiments/widget-metal-soak-v1/build.sh "$PWD/.local/metal-soak-helpers-new"
"$PWD/.local/metal-soak-helpers-new/soak" \
  "$PWD/.local/metal-soak-run-new" \
  "$PWD/desktop/glyph-metal-lab-v1/Sources/Glyphs.metal" 7200
```

別の端末／exec sessionで、同じ明示runのPIDを確認してから資源を記録する。

```sh
python3 experiments/widget-metal-soak-v1/sample.py \
  --helper "$PWD/.local/metal-soak-helpers-new/native-metrics" \
  --run "$PWD/.local/metal-soak-run-new" --interval 5
```

短いcadence確認はdurationを30、入力／atlasの加速確認は追加引数`--accelerated-preflight`。本走行にはこの引数を付けない。7200秒を超える実行は拒否し、同じ出力名も拒否する。窓やOS設定の変更、caffeinateの新規追加、他のプロセスの終了は行わない。

`run.json`がPID・開始・期限・初期準備の範囲、`progress.json`が最後の継続点、`result.json`が終了時の結果。`boundaries.json`、`pixel-finite-checks.json`、形ごとのPNGを残す。`resource-samples.ndjson`は途中まででも保ち、`resource-summary.json`と終了時の`resource-cpu-intervals.json`を突合する。

`completed`は要求した時間に達した意味で、無条件の合格ではない。frame数・MTL error・timeout・finite／pixel・旧文字／色・資源の傾向を確認してから採否を決める。中断やプロセス消失では、その地点までの記録を保持する。実UI確認後の小窓測定と、この長期エンジン試験を別の根拠として研究へつなげる。
