# Native ambient connection report

2026-10-03。新 `desktop/glyph-metal-ambient-v1/` と本folderだけを所有した。元 R3 / adapter R2 / Geometry R3 immutable source / 旧bundleを読み取り参照し、旧source・manifest・結果・Git・共有docs・UIを変更しない。OS監視、権限変更、clipboard自動取得、model、外部送信、実本文の収集は0。

## 現候補と根拠

Producer R2 / Bridge R2 / Build R5 は、人工callback・有限body projection・実offscreen接続を満たす**専用入力欄の比較候補**。実窓操作／実IME／常駐資源／8時間体験／人間参加評価は未実行なので、一般入力収集や製品体験の達成とは扱わない。rootからMac lockedの通知を受け、解除・実GUI起動を行わなかった。実UI採否と独立source監査はroot所有。

METHOD、manual12、CPU-COMPARISONを実装前にSHA固定した。AI手書きの人工producer宣言と期待値であり、人間注釈や本物IME確定の証拠ではない。Node / native JavaScriptCore が同じ新IIFEを実行し、人工manual12は各12/12かつ完全一致。元R3の20ケースは既知回帰として各20/20、旧JSC R1結果も完全一致。二つの母数を合算してfresh32とは書かない。

CPUはactual `AmbientProjection` と共有 `ambientInstances` を検査し、提示済みprefixのID／literal UTF-16／ink／alpha1／material座標／phaseを確認した。instance278件、元3面×3時刻×256 IDの基底2304件がfinite・非退化。stride80B。この数はassertion数や人間評価nではない。

GPUはCPU結果を見た後、別METHOD-GPU-R1と期待値を実行前固定した。元manual A01/A03/A09/A12 の4回帰状態に、球／箱／輪×白／旧白224＋新青32の6人工接続条件を追加。actual Swift `AmbientReceiverBridge` → 同じR3 → actual projection/rebuild/atlas/instancebuilder → **Geometry R3と同bytesのMSL** を実行した。400×440、settled time24、正面のみ。10/10、コマンド完了、host payload/uniform finite、元 `validateSurface` が同ID/materialで出すGPU基底1545件finite。全raster/fragment中間のfiniteを直接計測したわけではない。

emptyはbody0／atlas0／drawn instance0／lit pixel0。80Bのminimum GPU bufferはbinding用で、glyphではない。dense256のwhiteはsphere1803、box1347、Mobius2364 lit pixels。mixedのblue234／194／292 pixels。古い白と新しい青の両方を保った。buffer20,480B／uniform336Bはcomponent payloadであり、アプリRAM・GPU利用率の測定ではない。offscreen壁時計0.610秒もprocess CPU%、電力、fpsへ換算しない。

PNGを閲覧し、黒空間に疎な小文字が描かれたことを確認した。pixel presenceは読みやすさ、視認性、集中維持、作業価値、快適性を証明しない。256上限では旧1536文字の密度とも異なる。

## 失敗を保持した版分け

| 保存版 | 観測 | 次版 |
| --- | --- | --- |
| App Build R1 | Swiftのleading-dot小数が不正、exit1 | 別main-r2の数値表記だけ訂正 |
| App Build R2 | main-r2ファイルではtop-level entryが認められずexit1 | AppMain-r3の`@main`入口。意味ロジック不変 |
| App Build R3 / Producer R1 | build/sign成功、後の人工callback N03で不合格 | immutable app/source/rawを保存 |
| Producer R2 / Build R4 | 取消scope追加、build/sign成功 | 後のresponse guard境界は不合格、保存 |
| Producer R2 / Bridge R2 / Build R5 | 応答上限の計算とguard訂正、build/sign成功 | 現候補、実窓採択未確認 |

人工callbackの事前METHOD-CALLBACK-R1で、専用 `NSTextView` をunattachedに作り、本人入力やIMEエンジンを使わずメソッドを呼んだ。R1は5/6。`unmarkText()` の `super` が再入 `insertText("仮")` を起こし、unknown/unmark0の本adapter契約に反して1素材化した。Appleの一般unmarkは通常挿入として扱い得るため、OSが誤ったという主張ではない。本比較の明示取消と曖昧traceを0にする境界が不足していた。

R2は別 `OwnEditor-r2.swift`。取消scope中の `setMarkedText` / `insertText` / `didChangeText` がcontrolを更新しても確定宣言を出さない。正常final insertText中の内部unmarkは区別する。一般unmarkもこのadapterでは保守的にdocument-only0とし、実IME経路を取りこぼす可能性を明記する。元6ケースは同期待値で6/6。別の事前N07で `cancelLocalComposition` にも確認宣言0を要求して1/1。fixtureやR3閾値を結果に合わせて変えていない。

## 所有と時間の境界

元R3が本文変化の正規化、body、grapheme分割、ID、whole-event容量判断を唯一所有する。nativeの `AmbientProjection` はreadBodyの提示済みprefixからimmutable display metadataを派生する。生まれ時刻は「表示viewが初めて観測したvisual time」であり、OS確定時刻ではない。render material/phaseは同じID/seedの元式を使う。Swiftのcanonical-equivalenceで文字を同一視せず、旧prefixはUTF-16要素を比較する。

body256／document512 UTF-16／event text256 UTF-16／preedit64／window128／pending1を維持する。初期baselineは素材化しない。色は次追加だけ、composition開始色を保持。削除・undo・redoはdocument-only、bodyを消さない暫定政策。shapeは固定3群の字句ルールで、球→sphere／箱→cube／輪→Mobius。一般意味モデル・16形・60形・普通ringとMobiusの同等性を主張しない。unknown語は現在形を保つ。

shapeの解析・待機はbody追加を阻害しない。材料はwhole-event受理後ACK。永久 `body-capacity` / `event-text-limit` は追加0、旧ID不変、canonical文書を更新して消費ACKを返すheldであり、no-ACKと混同しない。native公開APIはadmission常時readyのsubsetでtemporary retryを持たない。元R3の協調no-ACKはoriginal20だけの回帰。万一native bridgeでtemporary no-ACKが生じるとunsupportedとなるが、協調回復を実装・認証したわけではない。

raw key/OS取得なし。本文確定の条件はこの専用fieldのpost-super `insertText` traceに対するlocalproducer宣言。`isTrusted`の偽装はない。未知callback、取消、unmark、confirmed insertを経ないpaste/undo/redoは0材料でdocument-only。実AppKit全sequenceを網羅したわけではない。

15fps設定、pause/hiddenでMTKView予約とreceiver shape/reveal停止。復帰後bounded提示。GPU接続harnessは停止したunattached viewでoffscreenを明示送信しており、実窓の予約・presentfps・hide/reopenを測定していない。非表示中のresizeはdrawable sizeを一回更新し得るため、全GPU操作が0という強い主張をしない。

`NSTextView` のreported replacementとknown insert入口は512 UTF-16を事前制限するが、AppKit全変更経路でfieldのraw storage上限を認証したわけではない。JS canonicalは512以下。ネイティブ入口はrange範囲を確認し、R3 gateはsurrogate境界・wellformed本文を確認する。人工的な不正rangeでのcontrol自身の更新まで保証しない。実IME／複数callback順／自動補完／選択置換の幅広い検査は今後のgate。

## 合法cluster bodyの応答上限

R4/source freeze後、R3のbody256 graphemeとnative JSON131072B guardが異なる単位だったことを別METHOD-JSON-BOUNDARY-R1で事前固定して検証した。人工的に `A`＋255個のU+20D0 combining markを一つの操作で追加し、document-only削除を挟んで256回蓄積する。各単発256 UTF-16、canonical document256以下、body256 graphemeでも、累積bodyは65,536 UTF-16となる。R3の範囲内である。

Bridge R1は187回のsend失敗。R3には全256 IDが追加され、current()で得たnative decoded viewの再encodeは204,985Bだった。JSONEncoderの計測はJS JSONのbyte完全一致やoptional shapeTokenまで含む値ではない。これは読み戻しpipelineの失敗を隠さず保存した別の既知境界であり、通常12ケースの合格へ混ぜない。

新ReceiverBridge-r2 / Build R5はsend/currentの共通decodeに524,288B guardを置く。保守的最大は256 units×(256 UTF-16×JSON worst6B＋固定unit metadata64B)＋aggregate/token8192B＝417,792B。idは最大256、inkは4固定名最大6文字、unitはid/text/inkのみ。実shapeTokenはrequestId/focusEpoch/policyEpoch/generation/windowRevision/shapeで、query本文を返さない。8192Bは固定aggregateとsafeInteger数値（最大16桁）にも十分な余裕を取ったschema予算。METHODのquery128予約は過大な保守予算であり、query fieldを追加した意味ではない。

同じprobeが全256 ID／65,536 UTF-16／切断0／send失敗0で合格。元callback6＋追加取消1の7回帰も合格。GPU、形式、R3、閾値、IDを変更せずGPUを重複実行しない。raw結果のversionは同じR1 harness名のまま、新nativebridgeによる実行はRESPONSE-REGRESSION-METADATA-R2で区別する。元app/source/rawは不変。

524,288Bは一つのJSON応答payload制限。JS文字列、UTF8 Data、decoded model、atlas/viewが複数存在するので、この値をprocess RAMへ換算しない。通常15fpsでbody全文prefixをserialize/decode/再検算する現実装は、軽量常駐を証明していない。材料変更と形tickを分離する次案はFUTURE-CACHE-NOTESに分析だけ残し、現候補へ未実装。hidden単独経路のcancelや実IME順序は実UI未確認のまま。

## 保存と公開

normal saving-offは本文・glyph・ID列・色順・window/query/fingerprintをvolatileに保つ。新bundleは同じR3純sourceを使用するが、新session API＋既知fixture evaluatorを追加した56,465Bの別IIFEで、旧JSC R1 42,915Bとはbyte同一でない。WebView、fetch/fs/OS/native入力hookをJSへ与えない。appは固定bundleコードのみを評価し、本文はJSON dataとして渡す。

通常のraw/metricsファイルなし。rootが明示する `--diagnostics-file` だけがcount、shape、status/reason、frame、finite、pid等の非文字集計を書く。AXラベルもcount/statusのみ。本文・ID列・ordered inkは出さない。この候補自身の保存offであり、OSや一般clipboardの保存政策全体を認証していない。

BUILD-R4/R5のstdout/stderrは `work/private/` に元bytes保持しSHAを記録。公開copyはrepositoryの絶対prefixだけ`<repo>`へ伏せ、status/errorを変えない。初期R1/R2のfull stderrはファイル保存されなかったので、元summary/source/partial appを保持した上で**別の失敗logging replay**を作った。後のreplay rawを初回のrawと呼ばない。private rawとworkは公開除外。公開fixture/results/PNGは人工文字だけで、現時点の公開JSONに`/Users/`はない。

現appとcompiled source listを別manifestに固定した。BuildInfoの全Sources inventoryには歴史entryも含まれるが、current appが全てをcompileしたという意味ではない。R1/R2 oldentry・failed raw・R3 appはそのまま残す。rootへ所有返却後、本人の実操作と独立監査を別母数に記録する。
