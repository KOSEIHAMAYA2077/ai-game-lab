# Metal v2 / WK v3 の数値評価helper

2026-10-03。**準備に続き、rootの実小窓比較を保存した。** [実測・失敗・採否](REPORT.md)を参照。以下はhelper準備の範囲と制限。 rootがアプリ起動・UI・帰属・計測を所有する。この担当は保存した数字の検証だけを行い、主アプリ・OS設定・実PIDへアクセスしない。

[原PLAN](PLAN.md)は03:54:38 JSTにSHA固定。[fixture補足](PLAN-R2.md)はrootの測定前METHODを測定開始後に公開文書へ対応づけたもの。helperの完成と人工テストも測定開始後・実測値閲覧前。これらをすべて事前登録済みとは扱わない。

保存1,537/描画1,536、白い球、モデルなし、通常90秒・pause30秒・pause解除後Hide30秒、0.5秒間隔。Metal22kind/WK24kindで、seed/batches/camera/font/rasterizerは完全一致しない。MKの新カメラとWKのカメラの差、atlas/bufferのbytesとアプリ全体footprintの差を分けて残す。

## 使い方

校正済みの既存 `sample_native.py` と `native_metrics.c` をそのまま使う。新helperはサンプルを採らず、保存JSONを読む。attributionはrootが明示した `processes` または `usage.processes` のJSON。rootのMETHODも別に保存する。以下の出力名は例で、既存なら停止する。

```sh
python3 experiments/widget-metal-native-evaluation-v2/make_expectation.py --renderer wk --main-pid 90619 \
  --attribution experiments/widget-metal-native-evaluation-v2/evaluation/real-r1/wk-r1-attribution.json \
  --method experiments/widget-metal-native-evaluation-v2/evaluation/real-r1/METHOD-ROOT.json \
  --root-confirmed --output .local/new-wk-expectation.json
python3 experiments/widget-metal-native-evaluation-v2/validate.py \
  experiments/widget-metal-native-evaluation-v2/evaluation/real-r1/wk-r1-calm.json \
  --expectation .local/new-wk-expectation.json --phase calm --output .local/new-wk-calm-summary.json
```

`--root-confirmed`はrootが実UI・quiet・定着状態を別に確認した場合だけ指定する。helperがOS/UIを確認したという意味ではない。Metalは`--renderer metal`とその実主PID、phaseは`calm/paused/hidden`。WK appVersionは0.14.2、Metal rendererはmetal-lab-v2を検査する。

rootはexpectationの`comparison_observations`へ実viewport/scene camera/scale/formation/glyphSize/manualRotation/atlas.kinds/rows/pixelBytesと画面根拠を加え、freezeしてから対応する数値を検証する。WKのshape/viewport/camera/bytesはnative診断にないため、検証結果にもその制限を残す。Metalは各sampleのcamera/framing/zoom/far/atlas/instance/uniform/compile/submit値を別欄へ集計する。

CPUは明示PIDのcounterから再計算。欠測・PID再利用・coalition不一致・負値・counter逆転・描画状態不一致を拒否し、0として合算しない。同時刻のcharged footprint/RSS合計と、PID別生涯peakを分ける。candidate budgetの値が小さくても、phase=calmとvalidation合格が揃わなければ通常表示の根拠にはしない。

## 検証したもの

[人工テスト原票](synthetic-tests-r1.json): 正常6条件と欠測/再利用/coalition/重複PID/CPU counter逆転/viewport/worker/遮蔽/停止中描画など21異常条件、**27/27**。メモリ上のJSONだけで、GPU・アプリ・実プロセスを動かしていない。helper実行は短いCPU処理だけ。実quiet測定中のbuild/GPU/長いtestは行わない。

実測値・小窓の資源予算・UI品質・16GB laptop・GPU/電力について、このフォルダの準備時点で合格とは言わない。rootが後から新原票・版情報・UI根拠を保存して評価する。
