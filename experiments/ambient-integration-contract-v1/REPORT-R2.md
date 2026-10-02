# 人工統合の結果と採否

R2受信器は、専用editorの次の人工比較へ進める契約候補になった。widget接続やOS取得の採用ではない。親の独立レビューを採用条件とする。唯一のmaterial body/ID、確認品質が未知の差分のpreview隔離、全体追加後ACK、保存OFFの集計出力を、同じ事前凍結20ケースで確認した。

|記録|ケース結果|実呼出|位置付け|
|---|---:|---:|---|
|`results-r1-first`|0/20|receive120、検索0|初回fixture adapterがfocusEpoch0を送る不具合。原票/source保存|
|`results-r2-harness-regression`|18/20|receive120、検索18|focus header修正後。deferred回答の生成時計順とobject key順比較が残った|
|`results-r3-harness-regression`|20/20|receive120、検索18|harnessのみ修正。R1受信器とshape本体は不変|
|`results-probes-r2-first`|通常7/8、mutant6/6検出|receive1042|独立追加P05が実装の来歴失効漏れを検出|
|`results-r4-receiver-r2-regression`|20/20|receive120、検索18|別ファイルR2受信器。同じ事前期待値の修正後回帰|
|`results-probes-r3-receiver-r2-regression`|通常8/8、mutant6/6検出|receive1042|追加期待値も不変の回帰|
|`results-recovery-r2.json`|1/1|receive11|独立レビュー後のordinary-baseline非復旧の人工追試|

最後の20ケースは2431 assertions、補助検査は50 assertions。多くは同じ有限状態条件の各step確認であり、2431個の独立課題ではない。R2ケースrunnerの約6.18ms、補助runnerの約9.67msはこのNode人工処理の経過時間だけで、実appのCPU/RSS/資源予算や快適性を示さない。

I01–I14は既存mapの未実行案をPASSへ転記せず、新しいgrammar/手書き期待値から検査した。AI手書きの期待であり、人間注釈・実IME観察ではない。

|条件|独立原票|確認した境界|
|---|---|---|
|I01 活動/材料分離|C01/C15/C18|raw key3、shortcut1が本文0。禁止本文getterを読まず拒否|
|I02 不明commit品質|C02/C16、M03|document APIの正確な「初箱」差分とquietでも本文/window0。incapableのknown claimを昇格しない|
|I03 composition|C03|取消preedit0、宣言final「漢字」2units一度、echo0|
|I04 重複|C04、M01|別serialの同じ「輪」は2units。transport重複/operation echoは追加0|
|I05 explicit-send|C05|選択5units、document=null、baseline/rangeを捏造しない|
|I06 multi-edit|C06/C20、P04|original offset順にABのみ追加、間の「あ中う」は追加しない。重なり/65変更は全拒否|
|I07 undo/redo/delete|C07|documentはrevision4の空、歴史bodyはbox4unitsと旧ID/colorを維持、候補/window失効|
|I08 no-ACK/handoff|C08、P05/M02|待ち中doc/seq/serial/ID不変、producer1slot。retryのdelivery300で2units全追加後ACK。表示遅れと容量を分離|
|I09 非協調/gap|C09、P05、recovery追試|欠落文字を作らずunsupported。R2は割込み元・待機元をともに失効。普通baseline後の新Xも追加0|
|I10 永久hold|C10/C20、P03/P06|容量とevent長に理由付きACK、all-or-zero。mirrorの観測更新と素材成功を区別。表示drainで容量を空けない|
|I11 保存|C11/C17、P01/P02/M06|OFF: text/ID列/color順/doc/preedit/window/query/dictionary/fingerprintなし、再起動body0。ONは明示人工opt-in|
|I12 Unicode/identity|C12|eと後続結合符号は歴史2units、ZWJ emojiは1unit、旧ID/color保持、NFC変換なし。surrogate途中range全拒否|
|I13 epoch/exposure|C13/C19、P08/M05|hidden/paused中は有限素材のみ。stale/expired/window更新前回答は不適用、再開時4units以下ずつ|
|I14 baseline非素材|C14/C16|以前の全文は取込0、新「新🙂」だけ2units。stable revision flagでもbulk appendしない。doc-sync未採用|

R1で見つかった不具合は、editorのno-ACK待ち中にsenderが割り込むと、pending metadataを消してsenderだけunsupportedにし、editorをsupportedに残すことだった。R2は`markGap`でpending ownerも失効させた。普通baselineはmirrorだけを復旧し、append provenanceを復旧しない。追試では普通baseline後のeditor新Xはpreview/added0、sender新Xもsuppressed/added0。明示primary synthetic-rebaseだけがeditorを復旧し、次YだけID1で追加できた。これは信頼された人工宣言であり、実欠落文字の復元ではない。

shapeは返却済みschedulerの固定定数・限定字句群だけを読み、独立shape-only adapterでbatch/hysteresisを接続した。旧createScheduler/accept/body/ID allocatorを呼ばない。windowは唯一bodyへのbounded参照で、別glyph bodyを持たない。C13の実原票では非表示開始2500〜再開5500に検索/表示/形変更は0件、素材は3000に2units、4100に1unit即時追加。表示は5600に3units、復帰検索は7500一回、候補一致後9500にboxへ変更した。遅延5400msを「快適」と評価しない。独立読取auditは実query/reveal/change110記録と20出力のrecursive storage gateを確認し、違反0だった。`hiddenWork=0`という初期counterだけを証拠にはしていない。

引用否定「引用『輪』ではない。」相当の人工文でもringへ変わる。一般意味モデルや命令分類のprecision評価ではなく、限定字句と低頻度変更の機構比較である。二回目の一致はcached sampleであり、独立した意味証拠ではない。既定60形への写像・tiny model・外部model取得・人間の快適性は対象外。

状態上限はbody256 insertion-local grapheme units、各event挿入256UTF-16、document512UTF-16、preview/preedit64UTF-16、recent64chunks/128UTF-16、pending metadata1slot、各history64rows、counters1000000。bodyは履歴を削らないため、非常に長い結合符号を含むunitを繰返す理論上限は65536UTF-16であり、256bytesではない。256-unit pasteは全保持しqueue peak256、表示は100msごと最大4units。1000活動event試験ではbody/window0、counter飽和1000000、状態JSON7088bytesだった。これはRSSや入力APIのframe/transportメモリ上限ではない。

material IDはbody内の単調なordinalで、glyph atlas IDではない。canonicalもshapeもIDを割当てず、`readBody`の一時読取projectionから将来rendererが描画する想定。実renderer/atlas/IME/UIは未実装・未検証。OFFではこのID列や順序付き色もexportしない。ONのconsent文字列は人工contract opt-inだけで、実ユーザーの同意UIやOS権限ではない。

残る境界は、source/session/capability登録が人工的に信頼されること、metadataが一致するretryの本文同一性をcooperative producerのfrozen eventへ依存すること、異なるpayloadを同じmetadataで偽装するproducerを認証しないこと、入力側の無限frame/通信bufferを保証しないこと。未知API、非協調producer、no-ACKを無損失とは呼ばない。epoch/gapの宣言による除外と実OSのfocus/securefield検出は別である。doc-syncの既存本文取込は未採用。将来の専用textarea最小API境界は[PROTOTYPE-BOUNDARY.md](PROTOTYPE-BOUNDARY.md)にあり、そのUIは今回作っていない。

所有返却対象はこの新folderだけ。既存contract/scheduler/map/widget/source/native/Git/network/clipboard/OS権限は変更・操作していない。R1/R2原票と凍結期待値を残し、修正後を未知評価の成功として扱っていない。
