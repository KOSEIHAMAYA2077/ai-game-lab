# Cache R1 独立初回レビュー

候補未読で固定した **12 session / 14 wire 親case** を評価した。wireのW11を宣言済みのemptytext/redinkへ展開したため **15 attempt**。通常の12sessionは旧immutable Build R5と一致したが、wireは **14/15 attempt合格、1不合格（W12）**。R1を全境界合格とはしない。

candidateは [CANDIDATE-PIN-R1](CANDIDATE-PIN-R1.json)、独立caseは [CASES-R1](CASES-R1.json) / [FREEZE-R1](FREEZE-R1.json)。作者fixture/結果を読む前にfreezeし、caseと判定を候補結果後に変更していない。旧referenceは [OLD-NODE-R1](OLD-NODE-R1.json) と [OLD-JSC-SWIFT-R1](OLD-JSC-SWIFT-R1.json)。新sourceに先行して読んだのは旧R5のsource/契約と公開APIだけ。

## 通常sessionと80B数学

Node手書き期待12/12、旧Node/JSC差0。candidateのNodeとJSC本物Bridge/Projectionの12sessionも旧版と一致。明示sessionresetのstepを除き66step、body原文UTF16/連続ID/ink/shape/presentationborn/off exportに差0だった。

804instance recordで **Float32 field12864個、UInt32 field3216個** を旧本物CPU builderとbitwise比較し、差0。5×SIMD4×4Bの規定80B field payloadで、paddingを含む任意rawmemory比較ではない。擬似atlas、seed1、distance4、scale0.9、height440、明示projection時計というCPU条件。実atlasの字体・GPU位置・shader・見た目・実IMEの一致は検証していない。

停止/hidden中は手動projection時計を固定し、追加materialをpresentedへ入れる時にbornを付けた。単一commitの分解アクセントとemoji、別commitのcombining mark、旧blue＋新green、5unitの4＋1presentation、held/bodycapacity、初期/未知/undo様のdocument-only観測、shape-only、preeditcancel、明示reset、64UTF16の単一graphemeを含む。cross-commit再分割を新cacheに足していない。

## Wire初回不合格

W12はbaselineでreceiverSession=`reviewwire`、bodyCount2、materialGeneration2、nextId3、presented2、sphere、aggregate.now110を受けた後、**aggregate.nowだけ109へ戻す**metadata。deltaなし。期待はrejectかholdと全状態維持。

本物Projection.apply直接経路と、人工wire-only JS providerを本物ReceiverBridge.sendへ読ませる経路の両方が受理した。glyph/ID/ink/born/素材cacheは変わらないが、Bridge.lastMetadata.nowは109へ戻った。sourceのJSproducer command.at単調guardとは別のhost応答境界である。**実際のtrusted synchronous in-process運用の故障を観測した結果ではない。**

残る14attemptは、不正newID重複/欠損/順序、古いprefixのNFC文字置換/再着色、generation低下、別session、range欠損、body/presented減少、emptytext/redink、exactreply replay、declaredunit欠損を拒否または許可済みno-opで処理した。W13exactreplayはBridgeのmetadata再観測を許容し、bodydelta再取得や素材/glyph変化はない。diagnosticの試行byte/call数はmaterial stateとは分ける。

[CANDIDATE-JSC-SWIFT-R2](CANDIDATE-JSC-SWIFT-R2.json) が初回原票。**R2はreview helper revision**で、candidateはR1のまま。helperR1はsummary printのnested interpolationでcompile失敗し、source/logを残してR2でprint構文と出力名だけを直した。fixture/mapping/gate/candidateは変更していない。

作者へW12を通知し、rootが別candidateR2による同fixtureの既知回帰監査を依頼した。R1source/app/不合格原票は保存する。修正後を未見の初回結果に差し替えない。

## 転送量と保存の範囲

固定66stepでは53のno-growth stepでbodyCalls0/bodyBytes0、13growth stepだけdelta。Node/JSCのmetadata/body UTF8byteも一致した。

| この固定batchのcomponent | 旧R5 | cache R1 |
|---|---:|---:|
| JS応答UTF8byte合計 | 57684 | 36972＝metadata25585＋delta11387 |
| bodyunit転送合計 | 1091 | 273 |
| bodyUTF16転送合計 | 1290 | 338 |

このbatchのbyte減少は約35.9%。idleだけの大規模反復や全窓CPU/RAM/電力/快適性の成績ではない。metadata JSONとJSC呼出しは残る。source上でdelta取得時はR3全bodyを走査してafterIdでfilterするため、**新rangeだけ転送**と**新unitだけ走査**を区別する。

raw body最大256unit×256UTF16、JSONescape最大6B/UTF16から393216B、unitmetadata予算64B×256を足して409600B、8192Bのheader予算を足して417792B。524288B bodyresponse guardには余裕があるという静的schema計算で、processRAMの計測ではない。metadata4096B/command8192Bは別上限。今回のfixtureは最大UTF16総量probeを実行していない。

saving-offのexportはaggregate/inkcounts/countersだけで旧版と一致し、text/ID/glyph/bodyを含まない。sourceの診断は指定URLがある場合、1秒間隔（force exposure/pauseは別）でaggregateやrenderer/transfer数値だけを書き、unit literal/ID列を保存しない。これはsource確認と人工export確認で、実OSファイル保存timingを観測したものではない。

[COMPARISON-R1](COMPARISON-R1.json) に全step/field/転送母数、[MAPPER-R1](MAPPER-R1.md) にhost境界の人工wire対応を保存した。GPU/UI/実IME/OS監視/clipboard/modelcall/新download/全アプリresource測定は0。
