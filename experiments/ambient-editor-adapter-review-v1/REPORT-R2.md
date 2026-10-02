# 修正後候補 R2 の独立回帰

2026-10-03 JST。初回候補 R1 は17件中15一致、追加 lifecycle は0/1だった。その source・code・原票を保持したまま、作者の新候補 `adapter-r2.mjs` を固定して比較した。

**既知修正後の人工回帰は17/17、元の追加 destroy 回帰は1/1。** R2のsource SHA-256 は `4687bf833752b138a5db4a39803dcdde58359fbb10a7540658f80282d4cb9540`。[結果](results-r2.json) / [元の追加回帰](lifecycle-results-r2.json) / [sourceと依存の固定](SOURCE-FREEZE-R2.json)。受信R3、body iterator、storage gate、shape schedulerの依存は初回snapshotとbyte-identicalだった。

修正の対象は同じ要素の所有権と終了境界。module内WeakMapで二重createを拒否し、閉じた同じ要素も再createしない。新elementまたはreloadは別接続となる。blur中のno-ACKは1slotを明示失効し、append provenanceをunsupportedへ移す。通常baselineで自動復帰しない。destroyはpending / preeditを破棄、readonlyを復旧、pauseを通知し、listenerを解除する。破棄後のcontrol / retry / answer callbackは無作用になる。

P15のコード対応だけは、作者が新方針を知らせた後・R2source/resultsを読む前に別固定した。「閉じた同じ要素を明示拒否、その後新要素で二重createを拒否」に対応する。[実行前mapping](PROBE-FREEZE-R2-LIFECYCLE-MAPPING.json)。初回のP15・期待値・失敗は不変。P12と他のassertionは不変であり、P15を結果を見てから通る条件へ変更したものではない。新方針自体は初回の失敗からの修正なので、盲検の新規評価とは扱わない。

さらに、R2source/resultsを読んだ後に補足2種を実行前固定した。最初の17件と別に記録する。

| 補足 | 結果 | 確認と限界 |
| --- | --- | --- |
| 終了後callback | 10/10 | 旧handle / advance / ink / readiness / retry / visible / paused / shapeRequest / answer / destroyが、投げるclock / value / payload getterを読まず、旧材料A・ID・色・counterを変えない。単一module内の人工モデル |
| 取り消し後の古いshape回答 | 1/1 | `立方体`のbox回答tokenをundoで失効させ、sphereを保持しstaleAnswersを1増やす。旧材料・ID列は保持 |

[callback原票](retired-callbacks-results-r2.json) / [実行前固定](RETIRED-CALLBACKS-FREEZE-R1.json) / [shape原票](stale-shape-results-r2.json) / [実行前固定](STALE-SHAPE-FREEZE-R1.json)。元P09はcandidate / currentともsphereで、shapeが変わらないことだけでは古い回答の採用を見逃し得た。元原票を保ち、異なる候補boxとstale counterの補足で強めた。実装不具合と評価側の弱い観測を区別する。

この結果から、**R2はrootの専用編集欄・実DOM比較の候補として進められる**。全アプリ監視、実IMEの確実な取り込み、ブラウザ間の互換性、快適性、低CPU / RAMを達成したとは言わない。保存offの検算はmodule exportのallowlistであり、ページやアプリ全体の永続化を別に見なければならない。

有限の対応inputTypeとIME順序以外は文書観測へ落とし、材料0を維持する。5秒のtoken失効、512 UTF-16の文書観測、256 UTF-16の単発追加、最大256 grapheme bodyという実験上の制限がある。通常の長文執筆や長い変換を十分に扱う完成アプリではない。

所有権guardは同じmodule instanceの同じelementに対するもの。旧R1と新R2、または別URLの複数moduleを同じ欄へ同時接続することを、このWeakMapや人工検算が普遍的に阻止するわけではない。rootの実ページでは候補を1個に固定し、timer / listenerの終了を確認する。

再現はリポジトリルートで、既存結果と異なる新名を指定する。

```sh
node experiments/ambient-editor-adapter-review-v1/probes-r2.mjs \
  experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs \
  experiments/ambient-editor-adapter-review-v1/replay-r2-new.json
node experiments/ambient-editor-adapter-review-v1/lifecycle-probe-r1.mjs \
  experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs \
  experiments/ambient-editor-adapter-review-v1/lifecycle-replay-r2-new.json
node experiments/ambient-editor-adapter-review-v1/retired-callbacks-probe-r1.mjs \
  experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs \
  experiments/ambient-editor-adapter-review-v1/callback-replay-r2-new.json
node experiments/ambient-editor-adapter-review-v1/stale-shape-probe-r1.mjs \
  experiments/ambient-editor-adapter-review-v1/snapshots/r2/experiments/ambient-editor-adapter-v1/adapter-r2.mjs \
  experiments/ambient-editor-adapter-review-v1/stale-shape-replay-r2-new.json
```

原版 / 新候補source、共有描画、Git、OS設定、OS全体入力、clipboard、実UIを独立reviewerは変更・操作していない。rootが所有する実DOM / 実IME確認は別原票へ残す。
