# カメラの端切れを独立に比較した記録

2026-10-03。旧 Metal R5 は回転中のメビウスが窓の端を越える条件があった。独立 CPU 比較でもそれを再現し、別版 v2 R2 では、同じ文字材料・形・時刻・視点を使った **35,667 主条件＋96 極端縦長条件で、画面外・near/far 切断・非有限値が 0** だった。

これは定着した body の射影とカメラ境界の結果。実際の GPU、字形画素、通常表示 FPS・RAM・CPU、好みの改善はこのハーネスでは測っていない。入力直後の intake と手動 zoom<1 も範囲外。

## R1 の失敗を残して R2 を確認

| 条件群 | 条件数 | 旧版の画面外条件 | v2 R1 の far 切断条件 | v2 R2 の画面外／far 切断条件 |
| --- | ---: | ---: | ---: | ---: |
| 定着 body | 19,440 | 482 | 0 | 0 / 0 |
| 旧・新形の補間 | 15,552 | 489 | 0 | 0 / 0 |
| 相関を外した scalar stress | 675 | 5 | 12 | 0 / 0 |
| 極端縦長の診断 | 96 | 20 | 96 | 0 / 0 |

主条件の v2 R2 最小余白は **横 24.12450997px、縦 40.35702480px**。目標値は片側 横16px/縦40px。定着・補間・stress の三群の合計で、各版 72,756,684 個の quad corner を射影した。極端縦長はさらに各版 589,824 corners。

R1 の far=100 は、極端縦長の 96 条件で 399,429 corners を切断した。別の相関なし stress の 12 条件では 20,590 corners を切断した。stress が実際のアプリ状態に到達するかは確かめていない。R1 の定着・形補間の標準サイズ群に far 切断はなかった。

R2 は中心半径と quad 半径の上限から far も決める。R1/R2 の全 CSV 共通幾何列は一致し、変更した far 切断判定だけが異なる。主条件の far までの最小余裕は 3.41370026、極端縦長では 1.82764049。単位はワールド座標。

例: 1,536 文字・メビウス・seed=1・時刻0・初期視点・400×440 で、旧版の最小余白は **−29.7003px**。v2 は横52.6122px、縦132.8926pxとなる。カメラ距離は10.6633から15.8094へ変わる。形を小さく見せる交換なので、読みやすさや見た目の好みの判断は実 UI で行う。

極端縦長300×2160では距離99.3446に対し far105.1941、300×3000では距離137.8994に対し far143.7489。R1の far100 による失敗を修正した。通常の小窓の推奨サイズや実 UI の到達確認とは分ける。

## 条件と算術の範囲

- 保存文字数1/2/8/24/80/256/512/1536/32000。描画選択は frozen `MetalMatter.displayed()` の上限1,536を使う。32000条件は保存上限の異なる材料IDの標本であり、32,000文字同時描画ではない。
- 球の表示半径1.2、L12の箱、時刻で変形するメビウス。seed=1/37/UInt32.max。
- 時刻0/24/100/186/900/3600/18000/28800、初期視点を含む6つの回転角。
- 通常群のサイズ300×340/400×440/300×900/900×340/300×1200。形補間群は先頭4サイズ。極端縦長は300×2160/300×3000。
- 補間は6つの有向形変更、経過0/.05/.4/.8/1.2/1.6秒。stress は count と formation/seedFocus/scale を意図的に無相関に組み合わせる。
- CPU oracle の位置・文字平面・回転・射影は Double。実装の `metalMaterial` は Float32 の材料座標として使用する。production v2 のカメラ境界関数は保存したソースを変更せず Float32 でコンパイルする。
- 全文字に atlas セル全体の四隅を使う。Core Text の日本語・emoji の不透明画素を検査した結果ではない。

解析式と更新経路のレビューは [GEOMETRY-REVIEW.md](GEOMETRY-REVIEW.md)。shader は R5/R1/R2 で同一 SHA。`displayed.map` と buffer 作成は入力時の `rebuild()` にあり、v2 カメラ修正は毎文字の CPU 位置更新を加えていない。

## 原票と固定したソース

- [R1 ソース SHA](source-manifest-r1.json) / [R2 ソース SHA](source-manifest-r2.json)
- [R1 結果](run-r1/report.json) / [群別結果](run-r1/group-summary.json) / [全条件](run-r1/cases.csv)
- [R2 結果](run-r2/report.json) / [群別結果](run-r2/group-summary.json) / [全条件](run-r2/cases.csv)
- [R1/R2 共通列の比較](r1-r2-comparison.json) / [静的更新経路](static-review-r2.json)
- [R1 ハーネス・出力 SHA](evaluation-manifest-r1.json) / [R2 ハーネス・出力 SHA](evaluation-manifest-r2.json)
- [独立ハーネスの初回コンパイル失敗](harness-first-build-failure.json) / [失敗時のソース](harness-first-build-source.swift.txt)

初回の失敗は、この独立ハーネスで Swift の `.5` を使った8件の診断。`0.5`へ直してビルド成功した。production source のビルド失敗や画面失敗として扱わない。R1のソース・失敗・原票を差し替えず、R2を別名で保存した。

保存した app source は評価の再現用コピー。アプリや旧版を変更するためのものではない。CPU比較は frozen R5 の実時間2時間 offscreen soak と一部重なったため、双方の性能を独立な実機負荷測定とは扱わない。この比較では OS 入力監視、実ユーザー本文、clipboard、権限変更、アプリ起動・UI操作、Git公開は行っていない。

## 再現

macOS と Xcode Command Line Tools が必要。リポジトリからこのフォルダへ移動し、新しい絶対パスの結果フォルダを指定する。既存の結果やビルドを上書きせず、存在したら停止する。

```sh
python3 run.py r1 /absolute/new/framing-r1-result
python3 run.py r2 /absolute/new/framing-r2-result
```

この helper は保存したソースと保存した独立ハーネスをコンパイルする。Metal app は起動しない。結果は CSV/JSON。`run-r1/` と `run-r2/` は実際にこの端末で計算した原票で、helper の再実行結果を代入しない。
