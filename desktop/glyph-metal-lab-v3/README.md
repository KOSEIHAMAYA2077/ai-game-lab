# Glyph Matter — 作者定義の文字表面比較 v3

黒い400×440の窓で、入力した文字が立体の面に沿って動く独立比較版。UIの名前は **Glyph Matter**、bundle IDは org.glyphmatter.metallab.v3、versionは0.3.0。旧v1/v2、WKWebView版、既定Web版と保存は変更しない。

球・箱・メビウスに、Webの作者定義10形を追加した **13形の表示比較** である。既定60形や6 Programの代替、自由文から新しいメッシュを生成する機能ではない。OSや他アプリからの入力取得、ambient入力contract/schedulerとの接続、モデル推論は実装していない。

## 操作

- Enter、または「入力」で欄を開き、Enterで文字を追加する。
- 1つの形popupから13形を選ぶ。「止める」で停止、「動かす」で再開する。
- ドラッグで回転、スクロールで距離を変える。検査したのは既定距離の収まりで、意図的な近接zoomや吸収途中の飛行経路は保証外。
- メニューの「隠す」、Cmd+H、閉じるボタンは窓を隠し、描画予約を止める。「表示」、Dock/openの再表示は同じ窓と停止状態を戻す。停止中の再表示はdrawableを1回だけ描き直す。
- 形・色の明示語は素朴な部分文字列ルールである。未収録語だけの入力は現在形を保つ。否定・引用・意図・任意の未知物体を理解したとは扱わない。

## 面の範囲

| code | 形 | 元の位置式 | 面の扱い |
|---:|---|---|---|
| 0–2 | 球・箱・メビウス | 旧v2の式を維持 | 球/箱は閉面coating、メビウスは両面 |
| 3–5 | 剣・花瓶・クラゲ | word-surfaces.ts | 剣/花瓶は閉面、クラゲは傘＋遅れる8腕の両面 |
| 6–9 | 花・蝶・木・星 | 同上 | 花/蝶は両面、木/星は閉面 |
| 10–12 | 螺旋・砂時計・土星 | 同上 | 螺旋/砂時計は閉面、土星は球＋両面の環 |

各文字の位置と接線は同じ面・patch・IDから求める。文字ID、順序、過去に指定した色、元の入力batchを保つ。1つのbody drawに最大1,536 instance、1文字6頂点の平面で、位置更新はGPU側。周期位相の縮約だけをdrawごとの固定サイズCPU uniformで行う。

クラゲの傘の7.2秒pulse、上下動、8本の腕の遅れる曲げを元の式から移植した。蝶はFloat中央差分がほぼ平行な接線を失うため、位置式を変えず解析接線を使う。u=.5かつ羽のundulation位相が消える点には一意な法線がない。Webと同じGram–Schmidtと代替垂直軸で安定させ、正則法線の一致と別に評価した。描画用vは1e-5…1-1e-5へ制限する。

静穏時15fps、吸収直後30fps。pause/hideはMTKView.isPausedで予約を止め、hideはdrawableを解放する。隠した間の定期入力監視などは存在しない。

## 保存と比較用起動

通常モードはv3専用のApplication Support内 org.glyphmatter.metallab.v3/snapshots-v1 へ追記保存する。本文を含むraw snapshotであり、将来案の persistText:false ではない。以前のsnapshotは削除・置換しない。旧版のsnapshotを自動移行しない。

最大保存glyph32,000／表示1,536／文字種1,024／1入力UTF-16 16,384／元本文UTF-8合計1MiB。JSON snapshot読込み/保存の上限は2MiB。これらは容量の上限であり、アプリ全体RAMの値ではない。

研究用の起動オプションはUIに出さない。

| option | 用途 |
|---|---|
| --fixture 1536 --shape 5 --fixture-time 24 | 人工文字・指定形/時刻。snapshotへ保存しない |
| --state-file <人工snapshot> | 人工の同じ状態から比較。snapshotへ保存しない |
| --paused | 固定時刻で1回描き、連続描画を予約しない |
| --state-directory <別directory> | 通常モードの独立保存先 |
| --metrics-file <別file> | 本文を含まないcounter/容量/カメラなど。CPU/RAMそのものではない |

macOS13以上を対象に、既存のApple SDK、Swift、Metal、CoreTextだけでbuildする。追加ライブラリやモデルの取得は不要。出力は必ず未作成のappを指定する。

    bash desktop/glyph-metal-lab-v3/build.sh --output "$PWD/experiments/widget-metal-authored-v3/work/Glyph Matter 0.3.0.app"
    bash desktop/glyph-metal-lab-v3/test.sh "$PWD/experiments/widget-metal-authored-v3/work/cpu-new-run"
    bash desktop/glyph-metal-lab-v3/gpu-test.sh "$PWD/experiments/widget-metal-authored-v3/work/gpu-new-run"

ad-hoc署名と署名検証までで、notarizationや配布先Mac/Windowsでの動作確認は未実施。

## 検証の範囲

2026-10-03、Apple M5のローカル検査。元TS関数を直接読み、人工fixtureを結果を見る前に生成した。CPUは11,840 material frame＋8,000 patch、GPUは同じfixtureと8,000 normalized basisを比較。位置最大成分差CPU1.34e-15、GPU位置L2最大5.16e-6。正則接線/法線の事前閾値を維持し、参照dv/normalが定まらない20点ずつを別母数で記録した。

13形・各1,536のoffscreen画像は黒い余白に収まり、CoreTextの日本語/結合文字/emojiと過去色保持を検査した。新半径で40,560のframing組合せと757,760のTS由来頂点を既定zoomで射影し、違反0。これは数式と人工条件の検査で、実窓全時刻・読みやすさ・楽しさ・一般PC性能の証明ではない。

実窓操作・通常窓の資源測定はroot担当の別評価。offscreenの1draw、instance80B、uniform336B、atlas payloadをprocess RSSやウィジェット全体RAMへ読み替えない。buildでは従来のfastMathEnabled非推奨warningがあるが、compile/sign/GPU checkは通過した。

Stage A/B/C、数値的不採用候補、明るさ候補と未確認事項は[実験報告](../../experiments/widget-metal-authored-v3/REPORT.md)に記録する。青paletteは旧値[.25,.48,1]を保つ。深度明度floor .30と.45の比較はgeometryと分け、同じ人工sceneの実窓観察で採否を判断する。
