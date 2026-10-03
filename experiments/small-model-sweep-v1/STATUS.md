# Small model sweep v1 状態

開始2026-10-03 13:52 JST、終了15:52 JST。15:42に新しい実験を止め、結果を締める。既存版は変更しない。

**現在: 実測・照合を終了。15:25 JSTに今回の継続自動実行をPAUSEDにし、所有するスリープ防止を開始時刻とcommandで照合して終了した。所有モデルprocess0、測定portのlistener0。** [終了確認](SESSION-CLOSE-R1.json)。原票・比較・採否を公開用manifestへ固定する。GitHubへの反映はこの版のコミットとPR履歴から追跡する。以下の時刻別記録は当時の状態を保持する。

## 初期snapshot

- 別branch: `experiment/small-model-sweep-v1`。比較prompt/schemaと独立24人工文を初回推論前に凍結。
- 公式Bonsai 1.7B/4B/8BのQ1_0重み3件を取得、bytes/SHA照合済み。実推論はまだ0。
- CANDIDATES-R2の残り15件を取得予定。PQ2_0とBitNetは別runtimeが必要な候補として区別する。
- runtime: llama.cpp build11342 commit `f1cee9941`。CPU4threads/GPUoff。起動60秒、各返信30秒、max256 tokens。
- 対象機M5/32GiBの結果。16GB Intel/AMD機の実証とはしない。モデル単体RSSとアプリ全体RAMを区別する。
- スリープ防止は今回だけ15:52まで。独立サーバー以外のプロセスは停止しない。

次: driverの凍結を待ち、Bonsaiの起動互換を確認してから順番に評価する。

## 14:24 JST — 共通runtime試験終了

新GGUF18個・12.313GBを固定publisher SHA/bytesで全件確認。既存baseline2個と合わせ20artifactを順次試し、18個が24文を完走（432返信）。PQ2_0/BitNet I2_Sの2個は共有runtimeのload失敗・試行文0で、意味精度0のモデルと混同しない。公式Prism runtimeとBitNet専用CPU buildを次に試す。

R1の5属性契約は出力を見て変更しない。別shape-only実験ではaction/shapeのみを出力するpromptをfresh fixture本文を見る前に固定し、既存R1の失敗を直ったと数えない。

## 15:10 JST — 比較と資源診断

新規21重み19,113,671,616Bと既存2対照を確認。26実行は23weight SHAと再試行3件、22重みが各24本文返信（528本文）。独立fixture/prompt/scorer不変。形だけの別6候補×36文は216返信、全候補で保留文への誤提案が残った。計算領域を減らすBonsai1.7/4の2候補は同じseen36による回帰診断で、4Bの10分待機を測定中。

共通runtimeでロード不可のPQ2は公式Prismで返信、Phi3.5は別no-jinjaで返信。BitNetは元sourceの2build失敗を保存、別copyの最小修正後に起動したが大きなpromptが30秒timeout。大きなpromptと短い要求の違いを単独micro診断で調べる予定。新メッシュ生成・既存widget接続・OS入力監視は実装していない。

## 15:25 JST — 実測を終了

23種類の重みを保持。固定24文群26実行528本文、別shape-only216本文、seen36資源診断72本文、BitNetmicro1本文を保存した。互いに異なる契約なので正解率を合算しない。4Bの600秒待機はserver単独CPU約0.125%・RSS1313.19MiB。縮小条件29/36は同じseen文の診断、初回28/36を上書きしない。BitNetmicroはHTTP返信しても@@@@@@@@でliteral不一致・lengthに達した。

原票の独立採点、39人工harness/scorer/counterのroot再確認、取得SHA・公開用curationを完了。既存アプリ・形・保存・URL・モデル・OS設定を変更しない。公開前の独立照合は完了。公開manifest/privacy/リンクも最終確認し、この版をGitHubへ反映する。
