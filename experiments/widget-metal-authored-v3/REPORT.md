# Metal作者定義文字表面 v3 — 実装と評価

2026-10-03。v2を別namespace/versionへ複製し、Webの作者定義10形を追加した。旧3形と合わせた13形の比較版であり、既定60形・6 Program・ambient入力取得の置換ではない。入力はこの版のterminalだけ。未知語理解、text-to-mesh、一般PC資源予算の達成は主張しない。

編集範囲は`desktop/glyph-metal-lab-v3/`と本folderのみ。旧版・既存保存・Git・共有研究map・UI/OS取得は変更していない。実UIの確認と通常窓の資源計測はrootが別所有する。元のWebコードは読み取り専用で参照した。

## 実装

| 形 code | 元の構造 | 新camera radius |
|---|---|---:|
| sword 3 | blade7patch、guard2patch、handle1patch | 1.65 |
| vase 4 | Gaussianの胴/口と3周期waveの回転面 | 1.75 |
| jellyfish 5 | bell24patch、pulse/bob、lag付き8arm tube | 2.25 |
| flower 6 | 5petalのradial/cup面 | 1.55 |
| butterfly 7 | body2patch、左右wing18patch | 2.20 |
| tree 8 | 3層cone9patch＋trunk | 1.80 |
| star 9 | 5point polygonのinflated面 | 1.23 |
| helix 10 | 2.2turnのtube | 1.75 |
| hourglass 11 | waistを持つ回転面 | 1.65 |
| saturn 12 | sphere6patch＋tilted ring4patch | 1.52 |

sphere/cube/mobiusの元の式とR2半径1.2/1.59/2.32、framingの式は保つ。新半径は各成分の上界から保守的に定め、sampleの最大値だけへfitしない。独立担当による読み取りレビューでも成分上界、蝶の解析微分、Web fallbackとの整合に阻害問題は見つからなかった。u=.5は全timeで退化するわけではなく、undulation位相が消える場合に限るという記述修正を反映した。

面の位置と接線は同じpatchから計算する。GPUは安定IDを基にpatch/materialを維持し、各文字のposition/planeを更新。CPUは固定サイズの周期位相をdrawごとに縮約し、glyph全数の位置を更新しない。1body draw、最大1,536instance、instance80B、uniform336B。これらは構造体とGPU component payloadでありprocess RAMではない。

形popupは1つ、入力と停止の操作を維持。未知の語だけなら現在形を保つが、認識は部分文字列の作者ruleであり、命令意図・否定・引用・未知物体の推論ではない。手動terminal入力と将来のambient文章処理は別契約である。

## fixtureと採否

元`prototypes/glyph-creature/src/word-surfaces.ts`をNodeのnative type strippingで直接importした。別に似た式を教師として作っていない。SHA256は`1ca4d1e06fc83d672076325914525563c0f6cee4fff96169efcc08bdded3ee6f`。取得元はrepo内の作者実装で、追加モデル・ライブラリdownloadなし。

人工ID/seed/time、各branchのpatch、u seam、vの内部境界を、数値結果を見る前に生成・保持した。Stage Aは3,552 material＋3,400 patch、Stage Bは11,840 material＋8,000 patch。timeは0…28,800秒、seedは1/42/123456/UInt32.max。generatorとSHA/Node版は`REFERENCE.json`と`REFERENCE-B.json`。

| candidate | 判断 | 保持した根拠 |
|---|---|---|
| A fd1 | 不採用 | CPU一致、GPU position範囲内だが長いFloat timeの微小差分でjellyfish normal最大1.153rad |
| A phase-fd1 | 不採用 | 周期縮約で改善、細い腕のu方向0.03949radが事前0.03を超過 |
| A phase-fd2 | Stage A geometry採用 | u=1e-4、v=min(1e-4,v,1-v)。位置/方向の閾値不変、GPU590 assertions、6形offscreen |
| B phase-fd2 | 不採用 | 全10形position範囲内、蝶の差分normal2.61rad／退化方向40検出 |
| B butterfly-analytic | 単独では未採用 | 蝶の位置式を保持した解析微分でmaterial normal0.002611radへ改善。一意normalを持たない20patchの旧検査は失敗 |
| B singular-policy | Stage B geometry採用 | 正則閾値不変、reference undefinedとfallbackを別母数、13形offscreen通過 |
| C reopen | UI修正候補 | Dock/open callback→既存showWindow。Stage Aの隠す後復帰不能をrootが確認、A結果は保持 |
| C camera-floor test | test訂正採用 | 最初のtestがminimumDistance単独を使いunformed seedのnear違反3380。実Rendererの既存base距離とのmaxへ合わせ、production camera変更なし、違反0 |
| D light45 | 既定への採用見送り | geometryとpalette不変の深度明度floorだけ比較。人工offscreenと同状態実窓を別に保持 |
| E paused30/45 | 通常fix＋旧floor30を最終採用 | 任意の--pausedで同時刻の1描画。停止中reopenも1回描いて予約停止を維持。light45は別候補で保持 |

各source manifestと各結果folderは別名で保持し、不採用sourceやreportを上書きしない。`work/`はignoredのbuild/source snapshot用。Stage A/Bのimmutable appを後続の編集で変更していない。

## 数値と描画の結果

| 確認 | 結果 | 限界 |
|---|---|---|
| Double CPU対実TS、11,840＋8,000case | position最大成分差1.333e-15、du4.997e-11、dv2.221e-11、finite/radius違反0 | CPU固定差分h=1e-5 |
| 旧3形GPU504frame | position L2最大0.0008844、du0.002127、dv0.003878 | Float GPUとDouble referenceの差 |
| 新10形GPU material＋patch | position L2最大5.153e-6、finite0、正則normal最大0.010081rad | raw derivative成分の完全一致ではない |
| 正則方向の基準 | position≤0.002、du/dv≤0.03rad、normal≤0.06rad | Stage A前の線を保持 |
| reference退化点 | du undefined0、dv20、normal20。fallback20 | 一意normalがない点を正則の母数へ混ぜない |
| normalized basis、8,000patch | Web Gram–Schmidt/fallbackを含め通過 | singular法線を復元したという主張ではない |
| 13形GPU/offscreen | GPU605 assertions、各1536、1draw、全形有色pixel>1000、400×440黒枠内 | t24の固定条件。window/全time/視認性試験ではない |
| framing bounds | 13×13transition・4sizes・counts・formation、40,560組合せ、bound/depth違反0 | 既定zoom、settled、元のbase距離含む |
| TS点の射影 | 11,840frame×4sizes×4rotations×4corners＝757,760頂点、違反0 | intake経路・手動近接zoomは対象外 |
| 本文/ID/色/状態 | 全形変更で保持、独立state roundtrip、unknown hold、CoreText cluster描画通過 | paste検証はIME確定の保証ではない |

最終CPU reportは4,953 assertions。初期のreportの4,573はWordCPU追加assertionsを行う前にcounterをsnapshotしていたため、最終の出力時にcounterを記録するmetadataへ訂正した。case・閾値を増減して数字を合わせたものではない。

GPUの蝶は同じ位置式の解析微分。その他9形はFloatに合わせたcentral differenceを使う。境界付近raw dv差は蝶97.824、剣0.3882、星0.3640などを含む。これはCPU固定h差分とGPU解析微分/可変差分がsqrt/poleで異なることを示すため、そのまま報告している。接線の大きさまで元と一致したとは扱わない。glyph planeは正規化後の方向を使用する。

退化の分類は参照方向長さ≤1e-12。実renderはWebと同じ、投影後v長さ<1e-10で安定した垂直軸を選ぶ。MSLのlength_squared<1e-20と対応する。蝶のu=.5でFloat sin(pi)残差だけが架空の法線を作らないよう、解析微分の対称値を厳密0にした。位置式と元の羽の動きは変更していない。

## 青の明るさを分けた比較

青RGB[.25,.48,1]、旧色保持、閉面のnear-side coatingを維持し、深度明度だけ`.30+.70*d`から`.45+.55*d`へ替える候補を作った。6形×all-blue/old-white+new-blue×2floor＝24画像。同じ人工文字・ID・atlas・t24・camera・1536instanceで比較した。旧white/新blueは人工glyphの色ラベルで、実ユーザー本文ではない。

union signal pixelに対する8bit code-value mean lumaは混色で球約+3.5%、メビウス+12.2%、クラゲ+8.4%。これはdisplayの輝度・contrast・読みやすさ・快適性を測ったものではない。画像差は小さく、emojiの小四角や密度/サイズ由来の視認性を解決したとは言えない。

rootがEの同一人工blue261/mobius/t24を通常400×440窓で比較した。time/shape/stored/kinds/camera/viewport/pausedが同値、bundled shader SHAが各BuildInfoに一致したとの報告。rootのbody-region union code-lumaは4.898→5.522（約+12.7%）だったが、見た目は小差で、どちらも暗い青260文字。人工offscreenのforeground unionとは領域・母数が異なるため値を併合しない。視認性・快適性改善の証拠とは扱わず、**floor30を既定維持、floor45は別候補で保持**と決定した。paletteを同時に変更しない。

## 実UI・資源と未確認

rootから、Stage Aで剣/花瓶/クラゲ選択と文字追加・過去白＋新青が見えたとの報告を受けた。一方Aのcustom hide後に復帰不能となり、rootは通常終了成功に数えずその証拠を保持した。Stage Bで花/蝶/螺旋、青の土星、未知入力後の土星保持、visible終了を確認。Cではcustom hideでcounter/time停止、同PIDのopen再表示と描画再開、pausedの同PID/形/容量/時刻保持・scheduled=false、visible終了を報告された。Eの固定時刻対比較も上記の通り。これはrootの観察に帰属し、独立担当がUI操作したとは記さない。詳細原票はroot所有の`experiments/widget-metal-authored-v3-root-ui/`で、本folderにユーザー本文や端末pathを転載しない。

最終版の通常窓資源測定はrootが別に行う予定で、本担当の返却時は結果待ち。通常窓のCPU/RSS/電力、Windows laptop CPU/iGPU、IME実確定、全入力取得、長時間快適性・愛着・生産性、既定アプリへの採用は未確認。旧R5 offscreen soak等と短いbuild/GPUが並走し得たため、この区間の資源を単独負荷と報告しない。

ソースとfixtureの再現は[手順](REPRODUCE.md)、現在の起動と保存仕様は[表示版README](../../desktop/glyph-metal-lab-v3/README.md)。
