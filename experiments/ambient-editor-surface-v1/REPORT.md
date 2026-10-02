# 作者の非UI確認

surface R2は **実ブラウザQAへ進める限定候補**。今回のauthoringではブラウザ/GPU起動0、実DOM/IME/OS取得0、人間評価0。旧widgetや既定60形への採用は含まない。

## 事前固定と結果

METHOD SHA `609dab8c4998a956a1b5f226bcdc324f42676d971dd54f3b447b825c3401b559`、CASES SHA `ed17617a0f86ea554614c3b1a919ebdae81fcbd25592ff0a95f430b2a129c32f` を実装前に固定。手書きexpected12個は人工の期待であり、人間annotationや実IME traceではない。

| 段階 | 結果 | 原票 /意味 |
|---|---:|---|
| 初回build R1 | exit1、意味試験0 | `BUILD-FAILURE-R1.json`。installed Threeのpackage.json subpathが非export。source不変でbuild entryのみ別R2。 |
| surface R1 / build修正R2 | 11/12 | `results-r1-build-r2.json`。S09だけFAIL。小数1000/15msの累積により人工[0,1000)に16callback。実timeout切捨も避ける必要。 |
| surface R2 | 12/12（既知修正回帰） | `results-r2.json`。intervalだけ67ms、entry/import/outputは新名、adapter・receiver・body・形式・shaderは不変。期待値変更なし。 |
| geometry算術 | 2304 samples | 3形×3時刻×ID1..256。sphere radius1.2、cube L12 norm1、finite/直交/右手basis。max位置条件error 1.67e-15、maxbasiserror 1.72e-15。WebGL/raster検証ではない。 |
| 元shaderとの比較 | vertex/fragment一致 | `SHADER-EQUIVALENCE-R2.json`。dynamicAtlas=trueの枝代入後のみ。GPUcompile未確認。 |
| sourcepin | 13/13一致 | adapter R2 /receiver R3 /関係original sourcesを結果後照合。詳細runtime graphに記録。 |
| production build | exit0、3files | JS645074B、CSS1514B、HTML2438B。JSが500kBを超えるVite warningは保持。実メモリ/CPU時間の代用にしない。 |

意味試験はempty0、色ごとのID保持、preedit0とfinal一回、削除/undo/redo履歴保持、initialbaseline非素材、emoji一単位、同字別操作のID2個とtile1個、容量whole hold、frame停止/復帰、geometry不変量、strict off export、未回答shapeと追加の分離。CPU時間は同一process内の人工観測値であり、実app資源値ではない。

## 1 authority と有限表示

`createProjection` はidを作らない。各unitのreceiver IDをUint32 metadataに写し、そのIDをsurface seedに使う。配列indexはGPU instance slotであり材料IDではない。本文はreadBodyの一時readonly iteratorのみ。volatile atlas Mapは受理済み文字→texture tileという描画cacheを有限256種類保持し、bodyの代替や文字列の再segmentationには使わない。増えたatlas行は元のtile番号を保ち、全UVだけ補正する。

unit inkは明示alpha1の元COLORSとしてGPUへ送る。色select変更は将来operation用だけで、旧unitを更新しない。view birthは最初のactive表示観測時刻。原commit時刻・入力確定証拠・材料IDではない。表示はreceiver presentedCountに従い、隠れ中のbodyを一括全表示せず元receiverの4/100msに従う。容量は256でsampling/evictionなし。全eventの容量holdはreceiverの扱いのまま。

## 時間と停止

R2人工15fps gateは[0,1000)15callback、inactive queue0、復帰初回dt0。0.25sより遅れたactive frameはvisual dtをclampし、実時間との一致は要求しない。pointerで表示姿勢を変えられるがpause/hiddenでGPU renderは呼ばない。resize observerはdirtyflagだけ、次activeframeでresizeする。初期hiddenならWebGLRendererもactiveまで構築しない。control切替の一回のreceiver advanceやlocalinputcallbackは定期描画ループの停止とは別であり、ゼロCPUとは言わない。

## 残る確認と限界

production browserのshadercompile、CSP下のThree canvas生成、実描画の色・Unicode・atlas growth・低密度自由回転/高密度面alignment、pause/visibility/page lifecycleはroot実UIで確認が必要。CPU試験のfake isTrusted=trueは人工producer宣言。実Japanese IMEの順序が条件を満たすか、入力取りこぼしの頻度、whole-page保存やbrowser memory、実resource budget、快適性・仕事への影響は証明していない。

三候補の判定は有限字句であり、引用や否定も形候補にできる。輪→Mobiusは表示用対応でsemantic正解ではない。append削除履歴方針は本人の希望が固まるまで暫定。body256 / doc512という限定であり長文仕事への無損失入力を主張しない。ブラウザのread-only/capacity保留やadapter unsupportedを、隠れた再baselineで素材化復旧しない。

既存研究・統合・editor reviewの作者だった点を開示する。今回CPUの12expectedを結果前に書いたが、独立reviewとは別である。独立reviewは別担当・別folderの原票を参照し、ここで自動合格へ混ぜない。
