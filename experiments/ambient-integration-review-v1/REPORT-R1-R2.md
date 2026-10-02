# 統合入力契約の独立review — R1 / R2

2026-10-03 JST。**合成のreceiver・material・shape契約の検算**で、OS認証、実日本語IME、アプリ入力、ネット・model・描画性能の検証ではない。対象sourceは読み取りのみ。このフォルダにsnapshot・自前probe・結果を追加した。共有source・作者原票・Git・UI・OSを変更していない。

独立probeは最初に仕様とcodeを読んで期待値を固定した。作者のrunnerや結果ファイル・expected/passを取り込んでいない。CASESの冒頭は文法理解に読んだが、自前probeは別の人工本文・編集位置で構成した。P11の並列producer問題だけは、freeze前にrootから既知不具合の連絡を受けたので、独立した盲検発見とは扱わない。

## 現在の結果と採否

| 記録 | receiver | probeの性質 | 結果 | 保持する制限 |
|---|---|---|---|---|
| [初回独立11](results-r1-first.json) | frozen R1 | P01–P10は独立期待、P11は既知問題の確認 | 10 PASS / 1 FAIL | P11の2 assertionsが失敗 |
| [同じ11の回帰](results-r2-regression.json) | frozen R2 | 既知修正後、同じexpectations | 11 PASS | R1の失敗を差替えない |
| 追加probeの初回 | R1 / R2 | 結果前freeze、後付け追加 | 各4 PASS | S01が実際のgap pathを踏まなかったharness不足 |
| [追加harness R2・receiver R1](supplementary-r2-frozen-r1-regression.json) | frozen R1 | 上記不足修正後の回帰 | 3 PASS / 2 FAIL | S01 / S05 |
| [追加harness R2・receiver R2](supplementary-r2-frozen-r2-regression.json) | frozen R2 | 上記不足修正後の回帰 | 3 PASS / 2 FAIL | S01 / S05 |

R1の並列producer provenance問題はR2で改善を確認した。ただしR2を汎用の複数source receiverとしてそのまま採用する判断は保留する。本文なしのactivity source gapが別producerの待機slotを消すS01、および別sourceの同じseq値がgap検出を省略するS05について、下記の契約修正または適用範囲の明示が必要。限定した単一producerのtextarea実験を進める場合も、その限定をアプリ完成・全アプリ入力取得の証拠へ広げない。

## source・期待値の固定

- [SOURCE-R1.json](SOURCE-R1.json)：R1 receiver、shape、依存scheduler定数のsourceとMETHOD/GRAMMAR/CASESを6ファイルsnapshot化。R1 receiver SHAはこのmanifest内に記録。
- [SOURCE-R2.json](SOURCE-R2.json)：別receiver-r2を同じ名前のsnapshotへ写し、R2 SHA `96550b3131ad8275d61d5463d11f5e9f0684a8959897f6a45d8452c472df2e57` を確認。
- [METHOD-INDEPENDENT-R1.json](METHOD-INDEPENDENT-R1.json)、[METHOD-FREEZE-R1.json](METHOD-FREEZE-R1.json)：初回実行前に期待値とprobe SHAを保存。
- [SUPPLEMENTARY-METHOD-R1.json](SUPPLEMENTARY-METHOD-R1.json)：追加初回期待値。
- [SUPPLEMENTARY-METHOD-R2.json](SUPPLEMENTARY-METHOD-R2.json)：追加harness修正前freeze。初回4 PASSは削除・修正しない。

実行runtimeは結果に `Node v26.4.0` を記録。graphemeはruntimeのIntl.Segmenterに依存する。以下はrepo rootからのrelative commandで、出力は新しい名前を使う（既存原票は上書き拒否）。source snapshotだけをimportし、作者の結果やlive sourceをimportしない。

```sh
node experiments/ambient-integration-review-v1/probe.mjs frozen-r1 replay-r1-new.json
node experiments/ambient-integration-review-v1/probe.mjs frozen-r2 replay-r2-new.json
node experiments/ambient-integration-review-v1/supplementary-probe-r2.mjs frozen-r2 replay-extra-r2-new.json
```

## P01–P10で検算できたこと

| probe | 確認した契約 |
|---|---|
| P01 | no-ACKはdoc/version/source seq/operation serial/ID/normalized seqを保持。正しい凍結retryはZWJ emojiと箱の2 graphemeを全部追加してからACK。activityは独立に進める |
| P02 | 一つのoriginal UTF-16 baseに対する逆順で指定した2箇所replace。docは降順適用、materialは昇順offsetの挿入部分だけ。surrogate途中offsetは全体拒否 |
| P03 | body容量超過はall-zero materialのACK-hold。mirrorだけ進められ、source/serialは消費。同じ操作の再送で無限holdにならない |
| P04 | 同じ文を新serialで2回入れると2回残る。transport/operation duplicateはpayload getterを読まない。IDとinkを保持 |
| P05 | source gapは推測追加しない。普通baselineはprovenanceを復旧せず、primary synthetic-rebaseだけ復旧。stale epochのpayloadを読まない。focus後も既存ID保持 |
| P06 | incapable sourceのknown claim、unknown composition final、静かな待ち時間でも確定証拠へ昇格しない。doc/previewのみでmaterial/queryなし |
| P07 | undo/redoでmirrorが変わり、historical body/ID/inkは残る。window/candidate/pending shapeを無効化。redoでも二重追加なし |
| P08 | 新しい入力後の古いshape tokenを拒否。現在tokenだけ受理し、元evidence TTLを厳守。cached sampleでexpiryを延長しない |
| P09 | 保存offは厳密allowlistの10 top-level項目、raw文/ID/order/doc/preedit/queryなし。再起動body空。saving onは明示synthetic opt-in必須、admitted bodyだけ |
| P10 | secure/capture-disabled/activity-only/unknown sourceでは本文getterより先にrouteを止める。keys活動量だけではbodyを増やさない |

この表は少数の合成fixtureに対する観測で、全ての状態・payload・Unicode・実editorを形式証明したものではない。

## P11：修正前の並列producer問題

editorのno-ACK中にsenderが同じ新serialで割り込む。R1はsenderだけunsupportedにしてeditorの待機metadataを消し、editor.appendSupportedを維持した。後で普通baselineを送るとeditorの新commit Xがmaterialへ入る。R1では「両producer provenance失効」と「普通baselineだけでは失効を直せない」の2 assertionsがFAIL。

R2は待機metadataを消すときにそのownerもappendSupported=falseにする。同じP11では両producerがunsupportedになり、普通baseline後もXはmaterialにならず、両assertionsがPASS。別版の修正後回帰として採用する。

## S01 / S05：残るsource gap境界

S01はkeysだけのsource seqを0→3へ飛ばし、editorのno-ACKが待機する間に活動量を一つ記録する。gap自体は検出されるが、receiverの共通markGapがeditor待機slotまで消す。R2ではeditorのappend provenanceも失効する。正しい凍結retryはdocument-gapでACK拒否となり、Xは加わらない。

これはMETHODの「independent activity/control may proceed」を、**独立activityの欠落は無関係なtext producerを失効させない**と解釈した追加境界検査である。rootが意図的なglobal resync policyを採用するなら、その仕様を明記して期待値を次の版で見直せるが、今回のFAILを後からPASSへ書き換えない。低価値activityの欠落で本文の再同期が必要になる振る舞いは、widget入力adapterには不便である。

S05はkeysの0→2 gapが、別sourceのeditor pending seq=2と偶然一致する状況。R1/R2の条件は

```js
if (e.seq > source.seq + 1 && !(s.pending && e.seq === s.pending.seq)) markGap(...)
```

で、pendingのsourceを比較していない。結果はgaps=0となる。seqはsourceごとのdomainなので、**別sourceの同じ整数を同じretryと解釈しない**修正が必要。

追加初回S01はちょうどseq=2を使い、gap検出自体をassertしなかったため、このgap bypassを踏んで4 PASSになった。原票を残し、harness R2はseq=3とgaps=1のassertを加え、S05を別に設けた。harnessの不足をsourceの成功として数えない。

推奨は、retry例外を少なくとも `pending.source===e.source && pending.seq===e.seq` に限定すること。その上でactivity/shape-answerのtransport gap診断と、document/material/controlのprovenance失効を区別すること。keys gapの活動量診断は記録し、無関係な待機text slot・doc・shape windowへ副作用を与えない方針が、独立sourceという仕様に合う。実装は所有者が別R3へ行い、このsnapshotを書き換えない。

## 追加で確認した前提と制限

S02は協調producerの前提をわざと破り、同じmetadataでpayload XをYへ差替えた。receiverはYを受理した。receiverが保持するのはbounded metadataだけであり、原文や指紋で同一payloadを照合していない。これは認証欠陥の新発見ではなく、**producerが一つのpayloadをsnapshot/freezeしてACK前に差替えない**という契約に依存する事実。自前probeでevent/dataをfreezeすると差替えは例外となり、Xのretryになる。実adapterには再帰的なsnapshot/freezeと一つのretry所有者が必要。

S03はhidden中に20 unitのlogical materialを即時受理し、query/revealが0であることを確認。再表示直後はreveal0、100ms後4 unit、各tick最大4、500msで20、2000ms後のstale-window catchupは1 queryだけ。旧hidden wordsの全再生・CPU/RAMや体感の検証ではない。

S04ではunknown composition-finalはmirrorだけを変え、preeditは明示cancel等まで残った。本文の確定証拠としては扱われない。実textarea adapterでは確定qualityとcomposition lifecycleの終了を分け、final/blur/cancelでvolatile previewを消す方針を決める必要がある。今回この状態を新しいconfirmationに昇格させない。

読み取り上、material.bodyとnextIdが唯一の身体/ID allocator。shape-onlyはその範囲への参照を持ち、古いschedulerのcreate/accept/body allocatorを呼ばない。inspect/exportが作る一時コピーは永続の二つ目のmaterial stateではない。保存offはshape・time等の限定aggregateを意図的に出すので、shapeから意味の一部が分かる可能性まで無情報とは主張しない。restartは空bodyで、全旧時間・カウンタを復元するdecoderではない。

結論：R1問題のR2修正は独立に確認できたが、上記S01/S05とproducer前提を明確にした次の版または限定adapterの設計確認が必要。snapshot契約の検算を、完成アプリ・全アプリ本文取得・実OS権限・IME確定認証・低負荷達成の証拠として扱わない。
