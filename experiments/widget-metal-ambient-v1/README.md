# Native ambient connection v1

**限定人工接続は通過、実native体験の採択は保留。** 現候補は Producer R2 / Bridge R2 / Build R5。人工AppKit取消と大きいbody応答のR1失敗を保存して修正した。既定60形／旧renderer／旧保存／Git／OS入力取得には接続しない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 実装前の人工manual12 | Node / JSC 各12/12、出力完全一致 | AI手書き期待値。人間/IME traceではない |
| 元R3の20ケース | Node / JSC 各20/20、旧JSC R1と同値 | 既知回帰。fresh母数へ足さない |
| actual read-body projection / builder | instance278、基底2304、失敗0 | 同じID・原文UTF-16・旧色、80B instance |
| native offscreen接続 | 10/10、GPU基底1545 finite | 元manual4＋後付け人工dense6。実窓なし |
| own-editor人工callback R1 | 5/6 | unmark再入で仮文字1素材化、保存 |
| own-editor人工callback R2 | 同じ6/6＋追加取消1/1 | 既知修正回帰。実IMEではない |
| 大きい合法body応答 | Bridge R1失敗→Bridge R2成功 | 別事前probe、256 cluster / 65,536 UTF-16、切断0 |
| actual native UI / IME / 常駐資源 | 未確認 | Mac locked、解除せず |

単一R3 body / ID → read-only表示view → actual80B instance builder → 原同bytes Metal shader の接続。nativeの3候補は球／箱／輪。輪→Mobiusは表示比較用mappingで、普通の輪との意味同等性はない。GPU画像は小さく疎な文字の接続証拠であり、読みやすさ・快適性の合格ではない。

[REPORT](REPORT.md)、[再現](REPRODUCE.md)、[現在appのmanifest](APP-PRODUCER-R2-BRIDGE-R2-BUILD-R5.json)、[GPU原票](evidence/gpu-r1/gpu-report-r1.json)、[R1取消失敗](CALLBACK-RESULTS-R1.json)、[R2取消回帰](CALLBACK-RESULTS-R2.json)。source/appの実操作・独立監査・公開はrootへ返す。

[球＋新青](evidence/gpu-r1/sphere-mixed.png) / [箱＋新青](evidence/gpu-r1/box-mixed.png) / [Mobius＋新青](evidence/gpu-r1/ring-mixed.png) / [empty GPU0](evidence/gpu-r1/A01.png)。画像は人工文のみ。
