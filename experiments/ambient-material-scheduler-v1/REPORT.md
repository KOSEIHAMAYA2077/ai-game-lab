# 素材追加と形変更の頻度を分けた人工比較

**素材をすぐ有限bodyへ追加し、形検索・姿の保持・表示の追いつきを別に扱う機構を、次の人工比較候補として採択する。** 2秒batch/5秒保持が快適という採択ではない。有限の球・箱・輪の字句検索は一般意味モデルでも命令分類器でもなく、引用からも形を変える。実OS入力への接続は未実施。

R1はproposal値をcase作成前に固定し、同じ人工17streamを3policyで比較した。**51/51 runsが人工期待値・bounds検査に合格**。素材の原sequence・unit ID・色は3policy間で一致し、容量内の追加は人工時計で0ms、形検索の2〜5秒待ちに連動しない。これはlogical admissionで、実入力→UI表示遅延の実測ではない。

R1の保存しないexportにはbody-unitのID列が残る。親taskのより厳しい「復元可能なID列もvolatile」という境界には採択しない。R1原票を保持した後、**別のR2 storage候補**を作り、count/色集計/形/時刻だけを出す51回の回帰を確認した。R2でもR1 scheduler・値・streamは同じSHA、全scheduler metricsも一致。ID列・本文・色の順序を漏らす意図的誤実装3件を検出した。R2は既に見たR1streamの回帰であり、未見評価ではない。

## 凍結と範囲

- METHOD.json: `60038352b8eae2787cd3e8be92c4f8cf0412e1adf4c7cf0cccbd29cf5332719d`
- streams.mjs: `99e59d16912d3ea3085049b10cc74fe565bc5fcd71fa928b8142825cc1edc6b6`
- R1 scheduler.mjs: `78f2fb2b32a90e1bf712a2f4e2647f9ce4493ad5e5f3a033f7c6441ca64b1bc2`

上記R1 proposal・人工期待値は初回結果を見る前に親taskへSHA通知した。[METHOD.json](METHOD.json)と[LIFECYCLE.md](LIFECYCLE.md)が仕様。batch=2,000ms、recent window=6,000ms/128UTF-16 units、candidate TTL=一致語の素材時刻+6,000ms、連続timed一致2回、最小姿保持5,000ms。cacheによる2回目は時間的一致であり、独立な意味証拠ではない。cache/idleはTTLを更新しない。期日とapplyが同時ならexpiryを優先する。

この比較は上流で正規化された人工known accepted materialから始まる。IME確定やOS APIの取得品質を証明しない。既存contractを実行/importせず、widget source/APIも読取・呼出・複写していない。文字・貼付・引用を明示命令のprecision/hold評価へ混ぜていない。AIが手動で作った人工stream/期待値で、人間annotation・被験者試験はない。

## 同じ素材で生じた機構の差

下表の「形変更」は内部shape stateの遷移。1つのpaste時刻で何回も変わるものを、実画面で全て見えた回数とは呼ばない。検索は実際に字句検索関数を呼んだ数で、cached sampleを含めない。遅延は**実際に採用した一致語→内部変更**の最大値で、採用されなかった候補の待ち時間を0msへ読み替えない。

| 人工stream | 形変更:語/batch/hysteresis | 検索:語/batch/hysteresis | 最大反映遅延ms:語/batch/hysteresis |
|---|---:|---:|---:|
| 500msごとの箱/輪交互12語 | 12 / 2 / 1 | 12 / 3 / 3 | 0 / 500 / 2,500 |
| 引用に球・箱・輪が出る執筆 | 2 / 2 / 1 | 22 / 2 / 2 | 0 / 1,000 / 3,000 |
| 1pasteにbox/ring/cube/sphere/ring | 5 / 1 / 1 | 5 / 1 / 1 | 0 / 2,000 / 5,000 |
| 日本語・ZWJ emoji・combining・3色 | 2 / 1 / 1 | 原票参照 | 0 / 1,000 / 4,000 |
| hide中の蓄積→reopen | 2 / 1 / 1 | 2 / 1 / 1 | 2,100 / 2,100 / 4,100 |
| 256unitの箱/輪burst | 128 / 1 / 1 | 128 / 1 / 1 | 0 / 2,000 / 5,000 |

17streamの合計は形変更 **166 / 21 / 13**、検索 **195 / 26 / 26**。hysteresisだけ追加のcached consistency sample14回。これは人工構成比による合計で、256unitのburstが語ごと変更128回を占める。実使用率、一般性能、快適性の差へ外挿しない。

各policyが受理・保持した素材は510unitで一致し、意図的にbody上限8へ縮めたcapacity caseだけで5unitをwhole-event holdした。受信して数えた正常known/current-context素材は515unit。duplicate・unknown quality・stale epochは別に拒否し、欠落素材を補っていない。16の通常容量streamでは容量拒否0、原文sequence/ID/色が一致。capacity caseでも途中切り捨てはなく、拒否を「元APIまで無損失」に変換しない。

IDはrun内で新規発番するappend unitの順番identityで、字形atlasのglyph IDではない。日本語/emoji例は9unit、ID1〜9、青5/緑2/紫2を保持。per-insertion grapheme分節なので、別commitを跨ぐcombining/ZWJの全体表示はrendererの追加課題。文字列は正規化しない。

## 期限・idle・focus・gap・停止

- `box`の後に20秒idle:検索は各policy1回。hysteresisのcache sampleだけ1回追加し、古い語を反復解析しない。
- `box`後、保持deadline直前の4,500msに別入力:dirtyな未解析windowは旧candidate applyを阻む。6,000msで期限切れし、hysteresisは形変更0。反映されないことも低頻度案のコストとして残す。
- focus:window/cache/candidateを取消す。append履歴/current shapeは残し、古いepochの素材は拒否する。新文書の球でhysteresisの旧箱候補が復活しない。
- seq gap:1回・missing seq1を明示する。観測したbox/ringは保持するが、欠けた素材を推定/復元しない。
- 停止はこの試作ではpresentation/interpretationのpause。known素材receiverはboundedのまま動く。実入力監視を止めるUI/OS操作とは別。

候補のexpiry・invalidation・cached observationは原票に別計上した。メタデータhistoryは種類ごと直近64行。大きな語burstでは192行がdropしたが、総遷移数・検索数・delay合計/最大はcounterに残る。省略された全timelineが原票から復元できるとは主張しない。

## hide中と復帰の上限

logical bodyは最大256 grapheme material units、1event最大256UTF-16 units、window最大128UTF-16 units/64chunks、解析待ちは1slot。描画queueの文字複写は持たず、bodyに対するpresentation cursorを使う。展示計画は最大4units/100ms。語burstのpeakは256units、hide例のpeakは9units。状態/counter/historyも有限にする。

hide/pause中は解析・cached sampling・shape application・revealをしない。hidden文字をlogical bodyへ即時追加し、復帰後は100msごと4units、形検索は2秒後の1回のbounded catchupから始める。hiddenの全語を再生しない。11秒後の復帰で期限切れした語は解析結果へ残らない。ここでのrevealは人工の表示計画記録で、WebGL描画や実ウィンドウの測定ではない。

## 保存境界のR1とR2

R1 rawSavingOffは本文/query/window/fingerprintをexportせず、有限な本文をvolatile stateへ持つ。しかしbody-unit **ID列・色列・origin seq/epochをexportする仮仕様**である。off export自体にID→text辞書はなく、IDは字形番号ではない。それでも外部の対応表、以前のsaving-on body、公開人工fixture等と照合できないことは証明しない。親taskの保存gateに合わせてR1 serializerは採択しない。

[storage-export-r2.mjs](storage-export-r2.mjs)は別のstorage候補。off時は順番ID・unit色列・origin link・原text・query・辞書・fingerprintを出さず、color histogramとcount/shape/timeだけにする。onはexplicit opt-inでbounded body ID/text/inkを出す。R2はvolatileな表示stateを削らず、原文・ID・色の保持やscheduler値を変えない。

R2の51回は全scheduler metrics・形・原素材が保存したR1と一致。ID列漏れ、本文漏れ、色順序漏れの3mutantを拒否した。これはserializerの人工schema境界であり、OS privacy、source認証、実アプリstorageの実装証明ではない。shape等の許可した派生metadataまで情報ゼロになるとも言わない。

上流contractもbody IDを所有し、このschedulerも私的IDを作るため、**そのまま直列接続済みではない**。接続前にID authorityを一箇所へ決める必要がある。upstream no-ACK/replayの保証もここにはない。

## 原票・再現・採否

[R1 summary](results-r1-first/summary.json)、[R1 raw](results-r1-first/raw.json)、[comparison](results-r1-first/comparison.json)、[R1 failures](results-r1-first/failures.json)を初回のまま保存。[R2 method](R2-STORAGE-METHOD.json)、[R2 summary](results-r2-storage-regression/summary.json)、[R2 raw](results-r2-storage-regression/raw.json)、[R2 mutations](results-r2-storage-regression/mutations.json)は結果後の回帰として別保存。

Node v26.4.0 / darwin arm64 / ICU78.3。R1全runのwall timeは19.540ms、R2 replay/storage gateは13.856msの一回の人工処理。CPU/RSS、常駐200MiB/1core5%、IME・実アプリ遅延・表示品質の達成値ではない。word segmentationはICU依存なのでruntimeを記録した。

```sh
# リポジトリのルートで実行
node experiments/ambient-material-scheduler-v1/run.mjs results-replay-r1
node experiments/ambient-material-scheduler-v1/run-storage-r2.mjs results-replay-r2
```

既存出力を上書きしないため、新しいresults名が必要。R2は保存された初回R1原票と照合する。追加package・networkは不要。fixtureファイルには再現用の人工文がある。harnessは実文書に接続しない。

**候補採択:** immediate有限素材、形検索の分離、期限・最小保持、hide/pauseの仕事停止、復帰の小分け、R2の非文字・非ID列storage境界。**保留:** 2秒/5秒という具体値の製品採用、3群字句検索の一般意味解釈、快適性、実OS/IME/API、native表示、共有widgetへの連結とID authority。新folderのみで作業し、親taskへ所有を返す。

公開時のREADME/REPORTは端末固有パスを除いた文書差分。作者snapshotのPROVENANCEと実装・METHOD・初回原票は保持し、[ROOT-PUBLICATION.json](ROOT-PUBLICATION.json)に旧/新文書SHAを分ける。
