# 専用 textarea module の R1 / R2 記録

2026-10-03 JST。R2 は限定専用欄の実DOM比較へ渡す **module候補として採択**。作者の範囲は人工 fake DOM / 手書き期待値であり、実IME、OS連動、利用者の快適性、資源予算達成への採択ではない。実UIは親担当の別記録を参照する。

R1 [METHOD.json](METHOD.json) SHA `44b3ca2cbf1b6c367d976a4db5b63898f3be6fa9f33e765e755b3d49a7485bde` と [CASES.json](CASES.json) SHA `8bea9ef42e785d0d7225947925f9702292fee9db5d300cabe0c8078bdd8b816b` を実装・結果前に固定。R1 adapter SHA `32485a02209b85158e536afecc03edf0b7be79f03908e28453ff386c1994066a` は評価前固定したまま不変。作者初回30/30・diff4/4の原票は [results-r1-first](results-r1-first/summary.json)。

独立担当は作者ケース・結果を見ず17抽象ケースを固定し、source/API読後・実行前に probe を固定した。初回 **15/17**。no-ACK→blur で pending が残ること、同 element 二重createで2 receiver / listener を作ることが失敗した。さらにソース・初回結果閲覧後の別追加 destroy/retry **0/1**で、破棄した旧 body へXを追加できた。別所有の [REPORT-R1.md](../ambient-editor-adapter-review-v1/REPORT-R1.md) に原票を保持。作者初回30件はこれらの境界を十分に覆っていなかった。

root が blur の slot失効と単一 authority を明示要求した後、[R2-METHOD.json](R2-METHOD.json) SHA `8290ad3a0763189fd4634054a0a44040dcf03c7aa91c23241f896c55ce83967b` と [追加4期待値](R2-LIFECYCLE-CASES.json) SHA `2b7312085b4daf948c9e38044f65f2ae1b3924e889ff3c2d871ada64df53a0d3` を R2実装・結果前に固定。R2 adapter SHA **`4687bf833752b138a5db4a39803dcdde58359fbb10a7540658f80282d4cb9540`**をテスト前に root / 独立担当へ通知し、その後変更していない。

R2 は same-module WeakMap の同element予約を destroy 後も保持して二重createを拒否。blur pending を receiver の保守的 seq gap で失効し、append unsupported を保持。destroy は pending / preedit / before token を消し、receiver pause、listener解除。後の retry / readiness / visibility / pause / advance / shape callback は clock や stale payload も読まない。snapshot / body読取り / 集計exportだけを残す。普通の baseline による hidden recovery は行わない。

| 原票 | 分母と結果 | 性質 |
| --- | --- | --- |
| [R2 original30](results-r2-original30-regression/summary.json) | 30/30、diff4/4、840 assertions、91 handle calls | R1手書き期待値を一字も変更しない回帰 |
| [R2 lifecycle4](results-r2-lifecycle-first/summary.json) | 4/4、37 assertions | 既知R1失敗後、R2実装前に固定した追加期待値 |
| [R1 negative control](results-r1-lifecycle-negative-control/summary.json) | 0/4、終了コード1 | 新R2方針を既知旧R1へ適用した後付け感度確認 |
| [独立 R2](../ambient-editor-adapter-review-v1/results-r2.json) | 17/17 | 独立元17の既知修正回帰、lifecycle mappingを結果前固定 |
| [独立追加 R2](../ambient-editor-adapter-review-v1/lifecycle-results-r2.json) | 1/1 | 元destroy/retry失敗の既知回帰 |

作者 negative control は4件を拒否できたが「独立に4つの旧バグを発見」と数えない。L04 は新たに明確化した terminal 方針も含み、L02以降は旧 callback の clock read による例外も検出する。旧期待値の成功を後から書き換えず、既知失敗を検出する検査として残した。独立担当の追加 no-read / stale-shape 検査は別所有・別原票であり、元17の分母へ合算しない。

検査は初期baseline0、keydown/shortcutの本文読取なし、unknownIME0、既知IME2順序の一回だけ追加、取消・欠落・失効、paste禁止getter未読、undo/redo/deleteのID保持、同値の新操作とecho、再送slot凍結・色固定、whole-event容量hold、原UTF16差分・surrogate境界・emoji / 結合文字、never-resolving形返答が文字追加を阻害しないこと、off export recursive allowlist を扱った。人工fixtureとraw tracesだけを保存しており、実利用本文を収集していない。

環境は Node v26.4.0、ICU78.3、Darwin arm64。R2 original30約5.61ms、lifecycle4約2.59msはこの小さい人工 runner の経過時間だけ。アプリCPU/RSS/電力や実入力の遅延、人間の快適性には変換しない。通常イベント・形変化頻度の実環境性能測定を追加していない。

保存 off は [storage-gate.mjs](../ambient-integration-contract-v1/storage-gate.mjs) の厳格な集計schemaで、本文・ID列・色順・window/query/fingerprintを除外。実文は専用欄 / bounded状態 / readonly projectionにvolatileで残る。inspectVolatileは試験用途、pageの公開 inspection は本文なし。本文ログ・永続ストレージ・networkコードなし。ブラウザやOSの履歴、安全消去、敵対的scriptを防ぐ認証は未検証。

limitsは文書512UTF16、1挿入256UTF16、preview64UTF16、body256grapheme unitを分離。追加イベント間の Unicode grapheme を結合し直さず、文字原文と色とIDを保つ。容量がいっぱいでも文書観測は残るが素材追加は全体0。unknown / cancelled / timeout / blur noACK / 非協調入力は取りこぼすことを許容する保守的候補で、無損失と表現しない。

表示は有限文字一覧の renderer 契約参考。作品の3D表現ではなく、黒い空間・既定60形・隠れるterminalを置き換えない。球 / 箱 / 輪の字句規則は一般意味理解・自由文の命令分類精度ではない。OS / clipboard監視・他アプリ本文・実native操作を追加していない。

R1 source / HTML / page / 初回結果、R2 source / original HTML / 回帰結果を別名で保持。親からの素朴な文言指示により neutral HTML だけを別候補として追加し、adapter API / source / harness は変更していない。共有source / 既存受信contract / scheduler / widget / Gitは変更していない。所有返却後の実UI / 公開結論は親担当が別記録に残す。
