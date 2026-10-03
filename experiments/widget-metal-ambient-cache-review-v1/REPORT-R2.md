# Cache R2 既知回帰の独立最終報告

初回cache R1の独立wire W12不合格を受け、作者がR1を残したままhost clock guardを別R2へ追加した。R2を同じ事前固定12session / 14親wirecase（W11の宣言済み2条件で15attempt）で一度だけ確認し、**12session一致、15/15 wireattempt合格**だった。R1の14/15不合格原票は[初回報告](REPORT-R1.md)と[CANDIDATE-JSC-SWIFT-R2](CANDIDATE-JSC-SWIFT-R2.json)に保持している。ここでR2というファイル名はhelper revisionで、初回candidateはR1である。

今回の修正candidate R2は[CANDIDATE-PIN-R2](CANDIDATE-PIN-R2.json) / [source pin](CANDIDATE-SOURCE-PIN-R2.json)、実行helper R3は[初回R2call前記録](BEFORE-R2-CANDIDATE-CALLS-R3.json)へ固定した。fixture/METHOD/wire mapping/bitwise gateは不変。作者のfixture/個別結果は評価入力に使っていない。第三者source限定監査は[別記録](INDEPENDENT-SOURCE-REVIEW-R1.json)である。

## Clock修正と初回失敗の分離

R1は同session/bodyCount2/gen2/presented2/shapeを保ちaggregate.nowだけ110→109にした人工metadataをhostで受理した。glyph/本文は変わらないがBridge.lastMetadata.nowは後退した。実際のtrusted synchronous in-process producerが故障した観測ではなく、人工JSON応答境界の不足だった。

R2はBridgeとProjectionの両方に、aggregate.nowが非負safe整数の上限以内かつ前受理clock以上というguardを追加した。同時刻は許容し、明示newsession/newcore/newprojectionならclock0へresetできる。全packetの検証後にclockをcommitする。W12は本物Projection直接経路でinvalidProjection、本物Bridge＋人工wire-only JS provider経路でbridgeFailureとなり、clock110・lastMetadata・body/glyph/ID/ink/born/shapeを維持した。[CLOCK-TRACE-COMPARISON-R2](CLOCK-TRACE-COMPARISON-R2.json)で通常66stepのobservedAtも既存人工command.atと一致した。

materialGeneration=count=nextId−1はappend watermarkで、独立frame sequenceではない。同時刻の形metadata順序などすべての順序問題を解決したとは言わない。selected15attemptが通ったことを一般の攻撃耐性証明へ広げない。

## 保持された素材とCPU数学

[COMPARISON-R2](COMPARISON-R2.json)の12session/66非resetstepは、旧immutable Build R5とliteral UTF16、ID、ink、shape、presented born、intakeSeed/inputIndex、off exportが一致した。804instance recordsのFloat32 12,864 field / UInt32 3,216 fieldはbitwise差0。MemoryLayout stride80も確認した。規定fieldを比較し、任意padding付きrawmemoryを比較していない。

既存R3のoperation-local grapheme分割を保つ。単一commitの分解アクセントとemoji、別commitのcombining markは同じ素材単位となり、cache側でcross-commit再分割しない。undo様document観測で既存素材を削除しない。旧色を保ち後続commitだけ新色、material受領だけではbornを付けずpresented新prefixの観測時に付ける。pause/hiddenの時計はfixtureで明示固定しており実窓の停止観測ではない。

GeometryTypes/Renderer/Glyphs.metal/CreatureGeometry/CameraFraming/OwnEditorは旧immutable sourceとbyte一致。ambientInstances本体も一致し、R2の時計guardはinstance式を変えない。[静的数学比較](MATH-SOURCE-PARITY-R1.json)をGPU再実行へ読み替えない。

## 転送・内部走査・保存

| 固定batchのcomponent | 旧Build R5 | cache R1/R2 |
|---|---:|---:|
| JS応答UTF8byte | 57,684 | 36,972 |
| metadata / delta | fullview | 25,585 / 11,387 |
| bodyunit転送累積 | 1,091 | 273 |
| bodyUTF16転送累積 | 1,290 | 338 |
| 新bodyrange取得step | fullview各step | 13 |
| no-growthでbody転送0のstep | 比較対象 | 53 |

R2 JSbundleはR1とbyte一致のため、Nodeを再callせず初回R1 Node referenceを再利用した。R2本物Bridge/JSCの転送byteも同じだった。36,972Bはこの66stepのcomponent合計で約35.9%減少、resident memoryや全アプリCPUの結果ではない。host stagedViewsとglyphsのcopyは存在する。

bridgeはbodyCountが増えない時readBodyDeltaJSONを呼ばず本文を転送/再decodeしない。しかしcoreの既存shape-only.advance→boundはrecent.reduce/chunkTextでbounded本文区間を読む。delta取得はreadBodyで全bodyを走査し新IDrangeだけを転送する。bridge bodyCalls/decodedUnitsはcore内部走査を数えない。『idle内部本文enumeration0』や『新unitだけO(delta)走査』とは記載しない。

256unit×256UTF16×escape最大6B＋64B/unit＋8192B headerという静的予算は417,792Bで、delta guard524,288B以内。この計算はschema上の保守的見積りで、最大payload probe・RAM計測ではない。metadata4096B/command8192Bは別上限。

saving-off exportは旧版と一致しaggregate/inkcount/counterのみ、本文/ID/glyph列なし。診断は指定URLがある場合のみ、1秒intervalまたはpause/exposure等forceで数値を書くというsource条件を読んだ。実diskのタイミング・再起動・OS本文savingは試していない。人工原票に自作本文を保存することと製品retentionを分ける。

## Helper失敗・未確認・判断

helperR1はsummary printのnested interpolationでcompile失敗した。source/logを残し、helperR2でprint構文/出力名だけを直してから初回candidateR1評価を行った。helperR3はcandidateR2 pin/出力名/observedAt監査を追加し、case/gateは変えていない。[helper修正記録](HELPER-COMPILE-CORRECTION-R2.json)、[clock helper](HELPER-CLOCK-REGRESSION-R3.json)、[build記録](BUILD-RECORDS-R1.json)で区別する。

この独立小規模範囲ではR2のknown clock修正と旧素材/CPU instance保持を確認でき、作者へ返却可能。ただしnative UI、GPU、実IME、OS入力、実ユーザー文、全窓CPU/RAM/電力、快適性、60shapeや16表面の姿、模型の意味理解は本レビューで未確認。新modelcall・download・OS監視・clipboard・Git/sharedsource編集は0。既定版の採用判断はrootに返し、こちらから変更しない。
