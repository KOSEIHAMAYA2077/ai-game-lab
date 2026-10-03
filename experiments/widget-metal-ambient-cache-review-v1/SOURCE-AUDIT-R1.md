# Cache R1 sourceの境界確認

作者の結果やfixtureは参照せず、candidate manifestの固定sourceを読み取った。実行したのは独立人工caseのpureNode/JSC/Swift CPU helperだけ。

| 境界 | 読んだsource | 確認と限界 |
|---|---|---|
| material唯一owner | receiver-policy.mjs→既存receiver-r3.mjs、body-view.mjs | R3がgrapheme/容量/素材append/ID発行を行う。cache JSはそのstateからreadBodyするだけ。host stagedViewsはID由来のvolatile描画コピー |
| idle metadata-only | cache-transport.metadata、ReceiverBridge.decodeUpdate | metadataにはunitsなし、bodyCount既知ならbodydeltaを呼ばない。JSC/JSON decode/aggregate workは残る |
| delta | cache-transport.delta | current session/generation/afterIdを検査し、ID>afterIdの原文/inkだけ転送。取得時はreadBodyで全bodyを走査し、既存unit用のfrozen viewも生成する |
| immutableprefix | Projection.apply | 成長数とrange/連続ID/文字上限/許可inkを全件検査後にstagedViewsへappend。古いIDを受けるrouteは拒否。prefixの再分割/再着色/新ID発行はなし |
| born | Projection.apply、AppMain.consume、旧Renderer | stagedmaterial受領時ではなくpresented新prefixの観測時のprojection.time。existingborn/intakeSeed/inputIndexは保持。今回のclockは人工で、実窓frameは未実行 |
| shape-only/ink-only | AppMain.consume、JSpolicy | metadataでshapeを更新し、shapeuniform経路へ渡す。ink選択は後続commitだけに適用。literal3shape判定であり60shape/16面/モデル理解ではない |
| reset | bindSession、AppMain初期化 | sessionは一度だけbind。別sessionへ暗黙bindしない。明示新receiver/newprojectionで空cache/ID1。document-only/focusは素材resetと扱わない |
| generation/順序 | JSmetadata、Swiftmetadata/delta guards | materialGeneration=bodyCount=nextId−1はappendwatermark。presentation/countの巻戻りやrange欠損は拒否。R1にはaggregate.now単調検査がなくW12不合格。独立frame sequenceはない |
| JSON上限 | ReceiverBridge.send/decodeUpdate | command8192、metadata4096、delta524288B。payloadboundとwholeRAMを混ぜない。複数JSstring/Data/model/cacheの同時copyが存在する |
| saving-off | exportReceiver、storage-gate、AppMain.writeDiagnostics | exportはaggregateのみ、hosttext/IDsはvolatile。診断数値にrawunit列なし。1秒/force条件はsourceで確認、実disk保存は未実行 |
| 数学 | GeometryTypes/ambientInstances/Renderer/Glyphs.metal | GeometryTypes/Renderer/shaderは旧immutableR5とSHA一致。instance式は同じ、固定CPU804recordの80B field差0。GPU/字体/ウィンドウ画素は未確認 |

R3のsource capabilityやsynthetic-commit evidenceは、許可された人工producerの契約でありOS認証ではない。今回も専用editorだけの提案/実装範囲で、全OS入力監視へ接続しない。全入力がmaterialという用途を、全入力がshape命令という意味に広げない。unknown文書/preeditは0material、ambient形解釈は固定batch/windowの3字句候補に限る。

byte削減/検算回数の減少はcomponent結果。hostはstagedViewsとglyphsを保持し、body最大65536UTF16という有限上限でもprocessRAM削減の数値にはならない。15fps/pause/hideの旧sourceは同じだが、actualwindow/GPUは本レビューで再実行しない。

R1のW12は人工hostwire境界の不足として作者へ返した。修正candidateR2は新pin/appで同fixtureの既知回帰として確認し、R1の不合格を残す。
