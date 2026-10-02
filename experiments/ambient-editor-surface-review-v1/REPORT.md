# 独立監査結果

R2は、この専用editorから既存の面描写へつなぐ比較labとして次の実画面確認に進められます。独立source/CPU確認の範囲で材料の二重追加、ID/色の再割り当て、undoによる過去材料の欠落は見つかりませんでした。R1を採用する理由はありません。タイマーの初回失敗を残し、R2を既知不具合修正後の回帰として扱います。

| 評価 | R1 | R2 | 範囲 |
|---|---:|---:|---|
| 独立CPU probe | 12/12 | 12/12 | 事前13期待事項のうち実行可能12。R2は同じmethodによる回帰 |
| 上限/主張のsource review | P13を確認 | 同じ上限 | 実行probeの分母に追加しない |
| 既知タイマー感度、exact schedule | FAIL、16回 | PASS、15回 | `[0,1000)`、追加期待値を自分の実行前に固定 |
| 既知タイマー感度、整数floor schedule | FAIL、16回 | PASS、15回 | 実ブラウザのタイマー測定ではない |
| 元dynamicAtlas shader文字列 | vertex/fragment完全一致 | 同じshader参照 | CPUでの文字列比較。GPU描画一致ではない |
| source/dependencyの終了時SHA | 28/28一致 | 同左 | 統合した版の読み取りコピーと元参照 |

期待値の固定時点には、作者の予定APIとsource SHAを受領済みですが、candidate source/作者cases/resultsは未読でした。runnerはsource閲覧後、自分の初回実行前に固定しました。作者のタイマー失敗/R2の集計通知はrunner固定前に受けているため、タイマー感度を独立発見とは呼びません。自分のCPU12 probe実行後に作者runnerの冒頭を閲覧しましたが、作者の結果原票は読みませんでした。作者によるbuild結果・CPU結果は独立probeの分母に足していません。

## 材料と表示の対応

R2 adapter → R3 receiver → `readBody()` が唯一の材料ID権限です。面の表示は `Matter` を生成せず、`Matter.add` / `reset` / 独立した `nextId` を呼びません。表示側の256スロットは既存ID・色・atlas tile・初めて活動中に観測したvisual birthを保存します。このbirthは入力確定やACK時刻の証拠ではありません。

空のbodyは0描画instanceです。初期 `@` はDOMの仮表示で、材料数、ID、atlasを増やしません。日本語、結合文字、emojiを含む人工unitをそのままatlasに渡し、既存IDと色を維持しました。文字を消す/undoする暫定仕様では、editor文書だけが変わり、過去のappend材料と表示は残ります。no-ACK中は0材料、準備後のretryで全体が一度だけ追加され、その後のretry/再表示で重複しませんでした。

表示はR3の単調なpresented prefixを前提とします。`createProjection.sync` は減ったpresentedCountやID/色の変更を拒否し、別の材料権限として訂正しません。既存文字内容の不変性はR3の唯一bodyと凍結された読み取りunitに依存します。任意の外部bodyを敵対的に改変しても安全な汎用rendererを検証したわけではありません。

## 停止、非表示、遅い形の結果

人工timerを停止すると予約がキャンセルされ、10秒の停止中にcallback数とvisual timeは増えませんでした。再開最初のdtは0です。非表示・停止中に新しい人工入力を追加した場合、bodyは保持され、復帰後に `readBody()` の最新のprefixから新ID/色を反映できました。sourceでもgate停止→receiver pause/visibility→gate再開の順で、停止中にsceneを再生成/材料リセットする経路はありません。

異なる形のbox回答を保留してからundoした独立deferred probeでは、古い回答が拒否され、球表示のまま、過去の材料ID/色も保持されました。ただし実pageは `shapeMode: inline` であり、このdeferred probeはR3の模擬契約経路です。小型言語モデルや実workerをpageへ接続した証拠ではありません。

## 元の表面描写との関係

`composedPosition`、`surfaceFrame`、`normalizeSurfaceFrame` と元のgrowth/camera/formation関数を直接参照しています。密度が上がる場合、同じ点計算から得た解析接線をGram–Schmidt正規化し、面のQuaternionに変換しています。vertex/fragmentは元GlyphSceneのdynamicAtlas分岐と文字列が完全一致しました。

しかし、原版の描画全体を再現したという結果ではありません。容量256、初期camera、入力位置、view birth、IDのseed、通常回転、3形の対応はこのlab用です。sphere→condense、box→cube、ring→mobiusは事前に決めた比較用対応で、普通の輪とメビウス面の意味が同じという主張でも、曖昧な任意文章を理解したモデルでもありません。GPU画素、形変更の見た目、面の密度、カメラ収まりは親担当の実UI確認へ残します。

## 保存・負荷・未確認事項

pageは専用textareaのみを観測します。sourceの公開QAは集計/停止control/off exportのみで、本文、readBody、ID順序、inspectVolatileを公開していません。off exportは凍結された10個の集計キーを維持しました。対象のruntime sourceで本文log、local/session storage、IndexedDB、fetch/WebSocket等の送信経路は見つかりません。CSPはconnect-srcをnoneにしています。atlasは最大256種類の字形を端末内に保持する描画cacheで、原文を保存しない仕様でも描画に必要な文字は活動中のメモリに存在します。

この独立担当はGPU/browser/build/OS計測を実行していません。人工isTrusted=trueはUAの正規イベントではありません。実IME、貼付操作、実canvasの停止/非表示、context loss、`scene.draw` の例外からの復旧、BFCache、長文、低負荷、16GB laptop、実presentation FPS、人間の快適さ、OS全アプリとの連動は未確認です。rendererは各活動frameで最大256文字のCPU位置/面attributeを更新する比較版です。Metal nativeの低負荷実測値を、このWeb labに流用してはいけません。

次に必要なのは、親担当による実専用textareaの短い操作と画面確認です。GPU故障時の再生成や、256単位より長い文章の扱いは、この接続契約とは別の改善項目として新しい版へ分けるのが適切です。
