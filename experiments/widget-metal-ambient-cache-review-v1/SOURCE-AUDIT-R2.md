# Source確認の最終範囲

[初回source audit](SOURCE-AUDIT-R1.md)を残し、R2 clock差分と第三者source-only指摘を追記する。case/METHODは候補source未読で固定。候補manifestのTestsを含むartifactはSHA照合のみ行い、作者fixture/結果を意味的に読んで期待や判定を調整していない。

| 契約 | 読んだsource | 結論と限界 |
|---|---|---|
| 素材body/ID唯一owner | [receiver-r3](../ambient-integration-contract-v1/receiver-r3.mjs)、[body-view](../ambient-integration-contract-v1/body-view.mjs) | admitのbody.push/nextId++だけが素材を作る。readBodyはvolatile投影。hostはallocatorを持たない |
| idle転送 | [Bridge R2](../../desktop/glyph-metal-ambient-cache-v1/Sources/ReceiverBridge-r2.swift)、[cache transport](../../desktop/glyph-metal-ambient-cache-v1/Sources/cache-transport.mjs) | growthだけbodydeltaを呼ぶ。metadata-onlyでもJSON/JSC/aggregate処理は残る |
| idle内部本文処理 | [shape-only](../ambient-integration-contract-v1/shape-only.mjs) | advanceのbound/recent.reduce/chunkTextはbounded本文区間を読む。bridge counterはこの走査を測らない |
| growth取得 | [cache transport](../../desktop/glyph-metal-ambient-cache-v1/Sources/cache-transport.mjs)、[body-view](../ambient-integration-contract-v1/body-view.mjs) | 全bodyを走査しafterIdより新しいviewだけを転送。newrange payloadとO(delta)時間は別 |
| prefix/presentationborn | [Projection R2](../../desktop/glyph-metal-ambient-cache-v1/Sources/Projection-r2.swift) | full update検査後append、literal/ID/ink不変、presented新prefix初観測時born。cacheはvolatile |
| clock | 同Bridge/Projection | safe非負Int上限＋nondecreasing、equal可、成功後commit。明示newsession/resetは別。独立frame seq無し |
| source信頼 | [receiver policy](../../desktop/glyph-metal-ambient-cache-v1/Sources/receiver-policy.mjs)、既存R3 | synthetic capability/evidenceは契約上の意味でOS認証ではない。専用editorのcommit、全OS取得ではない |
| off export / saving | [AppMain R2](../../desktop/glyph-metal-ambient-cache-v1/Sources/AppMain-r2.swift)、既存storage/export | aggregateのみ、hosttext/ID/glyphはvolatile。diagnostics1秒/forceのsource条件のみ、実disk未観測 |
| CPU instance / GPU source | [数学SHA比較](MATH-SOURCE-PARITY-R1.json)、本物ambientInstances | 804record field bitwise一致。source同byteだがGPU/font/UI実行ではない |

第三者監査は[INDEPENDENT-SOURCE-REVIEW-R1](INDEPENDENT-SOURCE-REVIEW-R1.json)。監査担当はfixture/原票未読で、追加実行/編集0。監査のidle scope補足を最終報告へ反映した。新候補sourceをこちらで修正していない。

本文蓄積と形判定は分かれる。全入力素材というユーザー用途を全入力命令という契約へ拡大しない。現literal判定3shapeと既定60shape/native16surfaceは母数別で、全本文から任意3D理解を達成したとはしない。
