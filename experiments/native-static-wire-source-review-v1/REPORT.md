# Read-only source review of NativeStaticWireR2

結論: **source上のtransport契約はMETHODと整合し、確認したprefixは旧R5とbyte同一**。新たなsource blockerを確定していません。このレビューは実行0で、実失敗を再現した結果ではありません。独立fixture20/21・作者fixture・結果を読まず、candidate/方法/旧source/shared/Gitを編集していません。

## Pinned source boundary

[NativeStaticWireR2](../native-static-wire-v1/NativeStaticWireR2.swift) は18,913B = [CorePrefix-R5](../native-static-wire-v1/CorePrefix-R5.swift.part) 13,229B + [WireMainR2](../native-static-wire-v1/WireMainR2.swift.part) 5,684B、全bytesが一致しました。元 [NativeStaticR5](../native-static-japanese-v1/NativeStaticR5.swift) も同prefixで開始します。prefix SHA `2750d9e2cdbae3b0724419f83e867455043502fe0fc45ad1b195d10f7e89d21f`、candidate SHA `f73bfc79769603ab53519453e3c45ec844ba25e3c069e43148c8deff46919fcf`。[CANDIDATE-R2](../native-static-wire-v1/CANDIDATE-R2.json) の対象source5pinsと一致しました。

元tokenizer/128F16 table/mean/rankのsourceを変更していません。source一致は、全OS版のFoundation Unicode変換・JSON数値解釈や全入力の意味精度までbyte一致する証明ではありません。caption/table/tokenizerは固定SHAを初期化時に確認する実装です。今回はmodelやcaption本文を開いていません。

## Wire and recovery

| Source lines | 確認した機構 | 範囲 |
|---|---|---|
| 179–189, 233–243 | UTF8確認→JSON→exact3keys、Boolを除いたsafe整数id、String text、shape/primitive registry | unknown文字列や余分なkeyを返さず固定hold。duplicate JSON keysはFoundation解釈のまま |
| 250–269 | 4096B read、content32768B cap、LFで一frame。CRもcontentに数える | 32769個目のnon-LF byteでlogical lineを捨て、改行までdiscard。一frame_limitを返し次frameへ |
| 257–259 | EOFでunterminated非空line/overflowを一回処理 | 空EOFはreply追加なし。overflow直後EOFも一回frame_limit |
| 190–208, 225 | output全体encode後2048B cap、LF1B追加、short write/EINTR処理、SIGPIPE無視 | 正常short writeは続行。I/O失敗は終了し、途中までstdoutへ出たframeを撤回しない |
| 244–248 | schema/registry通過後だけWireRuntime初期化し同processで保持 | invalid frameだけならmodelを開かない。protocol-validの空文字/input-limit requestでも初回initする |
| 272–276 | catchはwire_runtime_failureだけをstderrへ出してexit1 | 初期化/I/O/outputエラーのactual exception文字列を出さない |

replyはcustomEncodableの固定5keys `requestId/registry/ranks/hold/elapsedMs`、nilは明示JSON null（164–176）。ranksはtop3のlabel/scoreだけ。元RankのcaptionIndex、tokens、pieces、normalization、mean/vector、本文を落としています。registryも既知2語だけ返し、requestIdは数値canonicalにします。

1frameを同期処理し返信をwriteしてから次のframeへ進むので、Swiftにrequest履歴queueを作っていません。stdin/stdoutが止まればblocking read/writeで待ち、deadline・timeout・取消・epoch/stale・IPC認証・producer ACK・CPU throttle・model lifetime解放は未実装です。無限にLFが来ないstreamも有限bufferでdiscardできますが、時間/CPUは無制限に消費し得ます。これはMETHODに記載された単独CLI境界で、R3 body receiverへのdirectcast/接続採択ではありません。

## Float / index safety

Tableは8,388,608B = 32768×128×2、SHAとfstatサイズを確認しreadonly mmap（116–125）。vectorに入るidは0..32767を確認しdimension0..127だけloadするので、最後のUInt16はoffset8,388,606..8,388,607です。mmapはpage-aligned、offsetは2の倍数、littleEndianのFloat16をFloat32へ変換します。

Tokenizeはsource4000 Unicode scalars、encoderへ進むidsは4000以下（98–113, 131–136）。有限Float16の最大絶対値65504を使えば、最大4000項のsumは約2.62e8、meanの絶対値は約65504、128次元square-sumは約5.50e11でFloat32のoverflowより十分小さいです。Float16のNaN/Infが混じればmeanのisFinite guardでholdになります。normが1e-12以下ならvectorを返しません。これらはsource型と有限長に基づく安全範囲で、tableを実走査した計測ではありません。

caption/query vectorは同encoder由来128次元、raw dotをlabel別maxに集約してsort（143–153）。Wire emit前に全top3 scoreとelapsedMsのfinite/nonnegativeを検査します（202–206）。NaN/InfをJSONへ出す経路を通常のthrow/catchで止めます。raw cosineを厳密[-1,1]へclampせず、confidence/probability/命令受理にしません。`hold=nil`はencoderのtechnical holdがないことだけで、否定/禁止/unsupported intentの受理許可ではありません。

## Memory and output/privacy limits

**32KiB/2KiBはframe/replyのlogical capであり、total heap/RSS上限ではありません。** read buffer4096B、line content32768B、返信Data2048B＋LFはboundedですが、frameのSwift String、Foundation JSON object、normalization/DP arrays、TokenResult、rank arraysが同時に存在し得ます。modelはreadonly map8MiBに加えてtokenizer trie/scores/vocab/added-token strings・caption vectorsを保持し、初期化はSHAの1MiB read buffersとJSONデコード等も使います。mmap bytesをprocess RAMと同一視しません。今回はallocation/peak/RSSを測っていません。

input4000 scalarはnormalize前ですが、normalization262144B guardは生成後、token4000 guardもtoken/piece arraysを組み立てた後です。従ってこれらの値を全中間allocationの上限としません。DPは各pieceのUTF8長Nに比例するDouble/Int配列を作ります。64bit上でbestScore/starts/bestIdのraw配列payloadだけでも24×(N+1)Bで、bytes/paths/pieces等は別です。fixed tokenizer/caption SHAは入力由来データの無限増加を防ぐ前提ですが、Foundation・allocatorのexact overheadや一時コピーまで数値上限を導出していません。

`line.removeAll(keepingCapacity:true)` とread buffer再利用は、logical countを消すだけでmemory bytesをsecure-zeroしません。requestをruntimeの履歴へ保存するコードはありませんが、本文はstdin buffers/decoded objects/処理中memoryに存在し、解放後の残存bytes、swap/core dump、OS管理まで匿名化・削除を証明しません。text-free responseは本文取得の許可にもなりません。

正常reply・意図したthrow/catchのstderrに本文やprivate pathをserializeしない設計を確認しました。`writeNew`/Report/Memoryは旧prefixのhelper定義として残りますがwireMainから呼びません。unigramのprecondition（90）やruntime/OSのuncatchable crash/OOMはcatchの固定stderr契約の外です。今回はその実失敗を見ておらず、通常入力で起きると主張しません。

## Four source limitations separated from observed failures

1. **Numeric id precision**: safeRequestIdはNSNumber.doubleValueに対するfinite/非負/2^53−1以下/整数の検査です。Foundation復号やdoubleValueへの丸めで整数になったfractional decimal literal等について、raw十進数学値の完全性を保証しません。-0/1.0のcanonical integerはMETHODで許容しています。これはdecoded JS-safe数の契約であり、新たな実失敗として数えません。
2. **Peak memory**: logicalframe/reply capとmapped8MiBをtotalRAM capへ読み替えません。上の中間allocation・初期化・persistenttrie/vectorが別にあります。allocation traceは未実施です。
3. **Post-construction guards**: normalization/token capは生成後判定です。入力4000scalarとの有限性はありますが、token4000が一時配列も常に4000以下という保証ではありません。実overflow/crashを再現したわけではありません。
4. **Trusted stable local files**: shaFileと後のJSON read/open/mmapは別操作です。固定local artifactsが変更されない前提で、悪意ある同時file replacement/書換えまでatomic snapshot確認しません。mapped fileのSHA検査後不変をsource aloneで強制するものではありません。今回はmodel/captionを書き換えず、このraceを実行していません。

以上は修正提案を実装したものではなく、現候補の採択scopeを明確にするsource reviewです。prefixや閾値を変えていません。

## Reported execution evidence is separate

Rootから、独立初回20payload/21reply PASS・旧R5score差0、別lazy METHODでmodelなしemptycwdのinvalid2reply exit0とvalidrequestの固定stderr/exit1が確認された、との通知を受けました。この担当はcases/rawを読まず、実行していません。したがってそれらをこのsource reviewの独自PASS件数へ足しません。

Rootは作者helper履歴の一部でrawを保持していなかった点を公開監査へ残す方針です。`AUTHOR-HELPER-FAILURE-R1.json` のoldCalls5/newCalls5と`SUMMARY-R2`の初回oldReplies/newReplies5は「5件ずつ人工依頼を送信したが実返信数/exit原票は再検算不可」。修正版helperの保存raw5+5のみを作者PASSへ数える、と通知されました。このprovenance訂正はcandidate/方法/元prefix変更ではありません。ここではその原票の独立再検算を行っていません。

候補は本文なしbounded CLIの限定source契約として整合しています。実IPC/body/renderer接続、意味精度、fullwidget/Windows/電力/人体験、OS収集や実IMEの成立を採択していません。
