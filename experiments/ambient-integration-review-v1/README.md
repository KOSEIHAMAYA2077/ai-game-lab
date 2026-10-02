# 統合入力契約：独立review v1

2026-10-03 JST。合成receiver契約の独立検算。**R3の限定textarea接続候補は、この少数の合成範囲で進めてよい**。実アプリ完成・実日本語IME・OS認証・全アプリ本文取得・低負荷達成を確認したという意味ではない。

R3は独立behavioral11 probeと追加5 probeで期待値に一致した。ただし、R1/R2/追加harnessの結果を見て直した後の**回帰**で、新規の盲検accuracy評価ではない。作者のrunner結果・expected/passはimportせず、自前の本文・offset・時刻・assertionsで検算した。writer/shape bodyを複数作るadapterは採用しない。

| 凍結receiver | 独立11 probe | 追加境界probe | 区別すること |
|---|---|---|---|
| R1 | 初回10 PASS / 1 FAIL | 初回4 PASS。ただしgap pathを踏まないharness不足。修正後3 PASS / 2 FAIL | P11並列producerは既知問題としてfreeze前にrootから通知 |
| R2 | 同じ11で11 PASS | 修正harnessで3 PASS / 2 FAIL | R1 provenance修正の回帰。activity gap/S05は残存 |
| R3 | metadata assertionを別harness版へ更新後11 PASS | 同じ修正追加harnessで5 PASS | R3 sourceを読んだ後・R3結果前freeze。既知修正後回帰 |

原11 probeは [probe.mjs](probe.mjs) と [METHOD-FREEZE-R1.json](METHOD-FREEZE-R1.json)。P01の元assertはpending metadataをexact8 keysにしていた。R3がsource/session照合用のsessionを追加したため、specより狭いassertを [probe-r2.mjs](probe-r2.mjs) で **9-key whitelist内・payloadなし・event identity一致・encoded size bounded**へ直した。変更は [PROBE-METHOD-R2.json](PROBE-METHOD-R2.json) にR3初回実行前保存し、他10ケースのbehavioral期待値は変更していない。元11 probeのR1/R2結果は保持。

追加probeも、最初にkeys seq2を使うと別editor pending seq2との一致でgap検出が迂回されることを見落としていた。初回4 PASSの原票を残し、別 [supplementary-probe-r2.mjs](supplementary-probe-r2.mjs) と事前 [SUPPLEMENTARY-METHOD-R2.json](SUPPLEMENTARY-METHOD-R2.json) を固定し、seq3で実gapを踏むassertと、seq2のsource-domain誤認を検査するS05を設けた。harness不足をsourceの成功へ数えない。

R1/R2の不具合・制限・原票は [REPORT-R1-R2.md](REPORT-R1-R2.md) に残した。この文書のR2採否はその時点の判断で、現在のR3条件は以下。

## R3で確認した具体的修正

[source manifest](SOURCE-R3.json) のR3 receiver SHAは `d72e7931fb601104f70929d7ce0ceb60756b968fc540a59698f2c08dc1e9cb6d`。

- P11：別producerが待機textに割り込むと、待機ownerと割込みproducer両方のappend provenanceを失効する。普通baselineだけでは復旧しない。
- S01：activity-only registry sourceのkeys gapはgap counterだけに留める。別editorのpending slot・document・operation・windowを壊さず、凍結retry Xをwhole addしてACK。
- S05：別sourceのseq=2がeditor pending seq=2と同じでも自分の0→2 gapを正しく記録。retry例外はsource/session/seq/epochs/observedAt/kind/operationId/serialの一致へ限定。
- 既存P01–P10：whole-add-before-ACK、capacity all-zero、multi-edit原base atomics、surrogate boundary、duplicate no-read、gap/rebase/epoch、unknownIME非素材、undo/redo履歴保持、stale/expiry、off保存allowlist、secure routeを保持。

具体的結果は [behavioral11](results-r3-harness-r2-regression.json)、[追加5](supplementary-r2-frozen-r3-regression.json)。追加5のうちS02はproducer前提をわざと破るデモ、S04はunknown finalのvolatile preeditが残る観察であり、16件すべてを同種の安全性評価として合算しない。

## 限定adapterへ進む条件

1. `material.body` と `nextId` を唯一の身体・文字IDの正とする。旧sceneやschedulerへ別のID/bodyを配分せず、shapeは参照またはspecのみを見る。
2. producerはイベントを作った時点で配列・changes・dataを含めて再帰snapshot/freezeし、一つのretry payloadをACKまで保持する。同じseq/serialのpayload差替えをしない。receiverはmetadataだけ保持し原文の同一性を検証しないため、これをreceiver自身のlossless/認証保証とはしない。
3. source/session/capabilityとevidenceはadapter自身が成立させる契約。人工の`synthetic-commit`文字列、正確なdiff、静かな待ち時間を実IME確定証拠へ昇格させない。取れない状態は活動量/previewまで。
4. 保存offはallowlist exportだけを使い、inspect/private state/debug全文を保存しない。shape/time/count等のaggregateは意図的に残すが、raw文・ID順・色順・preedit・queryは保存しない。off restartは空bodyで、全履歴のdecoderではない。
5. unknown composition-finalのmirror処理と、final/blur/cancel時のpreview消去を別に設計する。今回はunknown finalがpreeditを残すことを観察したが、それを新しい素材や確定証拠へしない。
6. shape/model/deferred workはmaterial ACKを待たせない。hidden/pausedはshape parse/revealを止め、logical admissionはboundedに継続。再表示は4 unit / 100msと一回のbounded catchup。

R3でもdocument/commit/control/worker等のgapは保守的にresync/失効へ回る。全sourceのあらゆる損失から自動復旧する一般契約ではない。最初の限定textareaでinputType・IME/undo/paste順序・renderer接続を実操作するハーネスが次の作業。snapshot契約の検算だけでそれが完成したとしない。

## 再現

repo rootから相対commandで実行する。出力は新しい名前を指定し、原票の上書きは拒否する。Node v26.4.0で実行した。sourceはこのフォルダに固定したsnapshotのみをimportし、モデル・ネット・OS API・UI・実ユーザー本文へアクセスしない。Intl.SegmenterのUnicode規則はruntimeに依存する。

```sh
node experiments/ambient-integration-review-v1/probe.mjs frozen-r1 replay-r1-new.json
node experiments/ambient-integration-review-v1/probe.mjs frozen-r2 replay-r2-new.json
node experiments/ambient-integration-review-v1/probe-r2.mjs frozen-r3 replay-r3-new.json
node experiments/ambient-integration-review-v1/supplementary-probe-r2.mjs frozen-r3 replay-extra-r3-new.json
```

[STATUS](STATUS.md) と [最終manifest](MANIFEST-FINAL-R1.json) に所有返却とhashを残す。既存R1/R2・作者の原票・共有source・Git・UI・OSは変更しなかった。
