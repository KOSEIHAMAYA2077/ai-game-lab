# source対応表

位置は凍結したR1/R2ファイルを対象にしています。共有sourceの変更はありません。

| 項目 | 対応 | 独立で確認したこと / 残る境界 |
|---|---|---|
| 唯一body | mainのadapter一個、sceneへreadBody iterator | Scene/Matterの材料allocatorなし。R3 receiverを再実装しない |
| 表示ID | projection ids/tiles/inks/born | 新unitに元idを格納。tile番号は文字描画資源で、材料IDでない |
| 初期@ | indexのplaceholder span / instanceCount0 | P01でatlas追加0、material0。rendererを0bodyでも起動することはある |
| 既存色 | projection既存prefixのink一致guard、shader inkColor alpha1 | 色指定は各unitに保持。旧文字を最新select値で染め直さない |
| bodyの削除 | adapterのundo/deleteがdocだけ変更 | P08でID/ink/tile/birth保持。暫定append履歴仕様 |
| hidden/resume | main exposure / createFrameGate | stop before receiver controls、resume dt0、latest readBody。実DOM/UAイベント未実施 |
| shape | R3 inline / sceneSpec authored MAPPING | 3ラベルのみ。deferred stale結果は別模擬probe、実モデルなし |
| basis | composedPosition optional frameScratch / normalizeSurfaceFrame | 元解析接線+正規化を直接利用。GPU/画素/見た目の一致は評価外 |
| shader | 元scene.ts dynamicAtlas=true | 2文字列完全一致。元sceneの全camera/seed/animation状態同一とはしない |
| atlas | bounded Map<string,tile>とCanvasTexture | glyph cacheは活動中メモリに文字を持つ。行/本文cache・IDallocatorではない |
| atlas増大 | rowsを2倍、oldTexture.dispose、UV全更新 | source review。実GL texture寿命/RAM未測定 |
| 出力 | public inspect集計、exportOff10キー | raw保存/送信なしsource確認。console等をtest runnerだけと区別 |
| 容量 | material256/doc512UTF16/event256UTF16 | 小さな接続labの上限。元1536glyph native fixtureや長文writing appと同一でない |

R1→R2の実行挙動差はtimerの `1000/15` → `Math.ceil(1000/15)` です。main/surface-sceneはR2import名へ変更しただけです。build-r2とindex-r2は別成果物の出力/入口で、独立担当はbuildを実行していません。

潜在的な運用限界として、frame callbackの `scene.draw` に例外復旧経路はなく、GL context lossの復帰もこの監査で試していません。これは実際に入力材料が消えた発見ではありません。入力authorityはsceneから独立ですが、描画の再開や見た目の品質を保証するには別の実画面検証が必要です。
