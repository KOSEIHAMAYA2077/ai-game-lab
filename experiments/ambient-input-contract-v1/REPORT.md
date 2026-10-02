# 人工入力契約の独立検証

**採択は「既知の確定文字だけを追加する」実験候補まで。初期接続時の全文自動素材化は未採用。** raw keyは活動量、確定品質が不明な文書差分・IME候補は可逆previewとして分離できた。文書同期は比較として実装したが、既存本文の取込範囲と削除・修正文字の選好が未決なので保留する。ユーザー回答が親taskから届いていない時点の暫定append方針であり、製品決定ではない。

2026-10-03 03:22:57 JSTの最終原票: **人工28 fixture / 51 mode runs、10独立probe、7 targeted mutationを検出、通常失敗0**。fixtureから実際にreducerへ送った呼出は406回。20,000活動eventは別probe。4,750というassertion実行数には反復bounds検査と意図的に誤ったmutationを拒否する検査が含まれ、独立な利用者・例の数ではない。

これはAIが手動で作った人工期待値の検査であり、人間のannotation/利用者検証ではない。新folder内のpure JavaScript reducerを使用し、既存widgetのAPI・実装をimport/呼出/複写していない。OS、clipboard、実文書、権限、実IME、native UIを扱っていない。

## 検証した境界

| 要求 | 人工結果 | 採否・限界 |
|---|---|---|
| raw keyと文字材料の分離 | key/shortcut replayは重複計上せず、bodyを増やさない | 活動経路の候補。複数sourceの観測event総数は物理的な操作回数ではない |
| composition更新と一回の確定 | `k→か→漢`、文書APIのpreedit差分、確定`漢字`、同じseq/serialのechoを試験。bodyは最終`漢字`のみ | capable sourceの明示commitと共有version/serialが前提。実IME未確認 |
| 貼付・補完・置換・削除・undo/redo | 明示known時のみ採用。`猫→猫です→犬です→犬で→undo→redo`はappend=`猫です犬`、sync=`犬で` | appendは古い文字を残し、undo/redoを再追加しない暫定案 |
| app切替・重複seq | 古いepochの`BAD`を拒否。accepted queueはappendで旧doc由来の`X`を保ち、新docの`Y`を追加。syncは旧docを取り消し`Y`のみ | sourceは固定した有限registry、IDは本文やapp名を含まないopaque token |
| unknown/secure本文なし | 4つの読み出すと失敗する人工payloadで、活動のみ/secure/unknown/未登録sourceの本文read=0。markerがstateに残らない | source/exposure宣言を信頼する人工契約。OSがsecure fieldを正しく示すことは検証していない |
| burst・有限buffer | queue12文字・2jobで3件目をno-ACK。seq/version/serialを進めず、1slotの同じeventをretryし15文字を一度ずつ採用。raw keyは別sourceで継続 | producerが同一eventのretryを守る必要。非協調producerでは欠落を回復できない |
| 本文を保存しない | activity-onlyはmirror/draft/body/queueを持たない。persistText=falseは本文をserializeしない。trueもcommitted bodyだけ | 人工serializerの境界。OS入力取得前のprivacyや実アプリstorageは未実装 |

既存document APIを想定したsourceは `documentDiff:true, committedText:false`。差分が正確でも日本語の確定flagを持たないため、`reason:'typing'/'paste'/'completion'`や自称`quality:'known'`から昇格しない。`n→に→日本`は両modeともpreviewに留まる。knownな挿入部分だけを受け取っても、syncでは全文がstableという証拠がなければ不明な別部分をbodyへ取り込まない。

## 文書同期を保留する具体例

| 人工例 | append | document-sync |
|---|---|---|
| baseline `既存本文` にknownの `新` を追加 | body/保存対象は`新` | 全文stable確認後は`既存本文新`。接続時baselineだけではbody0だが、その後の全文採用はより広い範囲 |
| 青`ABC`から先頭A→緑X、末尾C→紫Yをdrain前にまとめる | 追加文字を履歴として保持 | `XBY`の中央Bも新ID/紫になる。prefix/suffix照合では中央の完全な同一性を保てない |
| `e`の後、別commitでcombining acute | 原sequence `é`、履歴unit2個、青/緑 | 原sequenceは同じ。全文分節でunit1個となり新ID/緑 |

新baseline、unknown差分、composition開始、serial/version gap、capacity holdで古い未表示sync snapshotを取消し、drain時もepoch/version/needsResyncを再検査する。既に表示した最後のknown bodyはunknown差分後に残せるが、`synchronized:false`を返し、現在の文書との一致を主張しない。syncのpacing countはlogicalな値で、最後のreconcileは有限全文を一度に扱うため、厳密な1tick CPU上限ではない。

## backpressureと回復の条件

pending上限によるno-ACKは、reducerが拒否eventの本文を保存しない設計。人工producerが最大1件を保持して同じseq/version/serialで再送する。最大bodyや単一job容量超過は、ACK付きの明示holdであり、部分成功やsilent truncationにはしない。doc mirror/previewが先へ進む場合はbody不一致を表示する。

非協調producer probeでは、no-ACKの`B`を保持したまま新しい同sourceのunknown `C`を送るとhigh-water markが進み、後の`B`のretryは`duplicate-sequence`で拒否された。bodyは`A`のまま。このprobeは想定した限界を検出しており、全OS入力に対する無損失backpressureが成立した結果ではない。採択には、協調ACK/replayまたは明示送信を持つadapterが必要。

確定serial欠落は文書snapshotから推定して埋めない。committedText能力のあるsourceが、明示knownな`commitSerialBaseline`とauthoritative baselineを供給する場合だけwatermarkを回復する。そのsnapshot本文は素材にしない。普通のdocument-only snapshotは回復できない。

## テストは何を検出したか

既存widgetのassertionは流用せず、fixtureの期待body/文書/色/identity、独立payload getter、producerの1slot、boundsを確認した。次の意図的な誤実装7件は、それぞれ異なるfixtureで拒否された。

1. source能力を無視して自称knownを採用
2. transport seq replayを無視
3. pending上限を無視
4. 保存対象にpreviewを混入
5. whole-revision確認を無視
6. document version gapを無視
7. composition preeditをbodyへ混入

このmutation検査は、少なくとも上記の回帰に対してテストが有効という根拠。全欠陥の不存在やplatform adapterの正しさは示さない。別agentの読み取りレビューで見つかった未表示旧snapshotの取消漏れとserial-gap回復路を、本folderだけで修正した。共有source/native/Gitは変更していない。

## 原票・再現・性能の範囲

最終原票は [results-final-v2/summary.json](results-final-v2/summary.json)、[fixture-raw.json](results-final-v2/fixture-raw.json)、[probe-raw.json](results-final-v2/probe-raw.json)、[mutation-raw.json](results-final-v2/mutation-raw.json)、[failures.json](results-final-v2/failures.json)。初期成功原票 `results/`、追加試験の `results-r2/`、`results-final/` も残した。最終fixture定義は [fixtures.mjs](fixtures.mjs)、契約は [CONTRACT.md](CONTRACT.md)、型は [contract.d.ts](contract.d.ts)。

metadata traceに本文payloadは入れない。原票のfinalBody/finalDocumentとfixtureには再現用の人工文が入るため、このharnessを実文書へ接続してはいけない。本文保存なしの検査はreducer stateとserializerの対象であり、人工原票を消すという意味ではない。

Node v26.4.0 / darwin arm64 / ICU78.3で、20,000活動event probeは106.085 ms、最終stateのJSON表現は1,365 bytesだった。全最終runは120.725 ms。これは純粋処理の一回の人工測定であり、常駐アプリのCPU/RSS、200MiB/1core 5%、renderer、OS API、実入力遅延の達成値ではない。

```sh
# リポジトリのルートで実行
node experiments/ambient-input-contract-v1/run.mjs results-replay
```

追加package、network、widget起動は不要。NodeにIntl.Segmenterが必要。再現時刻・timingは変わる。bounded producer/confirmed sourceを満たす独立比較試作へ接続する所有は親taskへ返す。実IME・監視・native UI・製品公開の確認はこの検証の範囲外。
# 公開時の文書差分

作者の完了時点の [PROVENANCE.json](PROVENANCE.json) は保持した。README/本書から端末固有パスを除き、この説明を追加したため、2文書のSHAは元のsnapshotと異なる。[ROOT-PUBLICATION.json](ROOT-PUBLICATION.json) に旧SHAと公開時SHAを分けて残す。実装・interface・CONTRACT・fixture・runnerの5つのSHAと元の原票は変更していない。[rootの再実行](results-root-replay-r1/summary.json) でも人工51 run、10 probe、7 mutation checkが成功した。実OS/IME/アプリ連携の成功を表すものではない。
