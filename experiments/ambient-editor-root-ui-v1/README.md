# 専用入力欄の実ブラウザ確認 R1

2026-10-03 05:44 JST。R2 neutral入口を独立localhostへ開き、合成ASCIIだけをUIから実入力した。作品の3D表示ではなく、DOMの入力契約を確認する小さな比較である。既存の公開作品・ユーザータブ・クリップボード・OS入力取得には触れない。

[事前方法](METHOD-R1.json)。R2 sourceと31file manifestは作者返却時のSHAで別に保持。

1. `box` を実キー入力し3 material IDを表示。
2. UIで全文選択・削除。入力欄は空、蓄積済み3 ID/青は残る。
3. `ring` を入力して新4 IDを追加、安定後に輪候補。
4. 色を緑に選び ` sphere` を追加。既存ID1–7/青を保ち、ID8–14だけ緑。最終body14/display14/known15/unknown0/球。
5. 明示reloadで入力欄・body・表示・counterは0。ページを閉じた。

原票: [box](01-box-dom.json)、[削除](02-deleted-dom.json)、[ring](03-ring-dom.json)、[新しい色](04-green-dom.json)、[reload](05-reload-dom.json)、[実画面](04-green.png)。DOMはread-onlyで取得し、IDの新規割当や状態の注入は行わない。

`window.ambientEditorView` はブラウザ読取りscopeからundefinedであったため、hookでのexportState確認には数えない。sourceに存在するhookの失敗とアプリ動作を同一視しない。色選択のexact labelはno_matches、DOMで観察済みの #ink locatorへ変更してUI選択。最初のDOM読みは存在しない #body を参照して失敗、既存原票は上書きせず #projectionのIDを読む方法へ修正した。

日本語IME・paste・undoの実ブラウザ動作、日常の執筆、他アプリ取得、快適さ、CPU/RAM、長時間、外部通信のネットワーク計測は未確認。512入力/256素材の実験上限であり、全日執筆の製品ではない。削除後も文字が残る規則は暫定案。
