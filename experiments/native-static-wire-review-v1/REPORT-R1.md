# 固定 native wire R2 の独立レビュー

事前に手書き固定した20 payloadを、一つの固定候補processへ一回だけ送った。21返信すべてが固定gateへ一致した。これは合成JSONL入口の境界評価であり、形の意味精度、人間評価、実IPC、全アプリ入力、常駐アプリの達成値ではない。

|母数|結果|扱い|
|---|---:|---|
|独立手書きpayload|20/20|新wire候補初回|
|予定reply|21/21|W19のoversizeと次lineを別返信として数える|
|正常返信の旧R5 parity|9/9|旧R5を再利用する既知oracle|
|正常rank完了|6|上位3 label/order/scoreが一致、score差0|
|正常hold|3|empty_vector / input_limit / token_limit、rank完了へ加えない|
|固定source/model pins|15/15|候補call前後とも一致|

旧R5の9返信は候補の初回callより前に別processで保存・SHA固定した。固定candidateは1 process、exit0・stderr0・timeout0。最大返信content207B、固定上限2048B以下だった。20payloadは20個の起動や20個の独立した長期試験を意味しない。旧R5 model review20+4、作者knownケース、100分CLI観測とも分母を合算しない。

元METHOD、CASES、追加契約、driverを候補source受領前に固定した。candidate sourceは受領後にread-onlyで確認した。候補manifestはa22e82f7f8cacc29df561ad206cfc71408cbb476a4016a9c178f67889b9bcf70、sourceはf73bfc79769603ab53519453e3c45ec844ba25e3c069e43148c8deff46919fcf、binaryは49d92dc50595202fd8a74ff3760d33c1607cb041353ecb2069cd5cc6500085f6。compile失敗R1は作者folderへ保存済みで、新R2 runtime初回とは別の履歴である。

32768Bのcontent上限はLFを含まずCRを含む。CRLFのちょうど上限、32769Bを改行まで捨てた後の通常line、invalid UTF-8、不正JSON、必須key欠落・extra key、Bool/fraction/負値/範囲外ID、不正text型・registry型・未知registry、ID再利用、EOFの改行なし最終lineを確認した。sourceは4096B read bufferと上限付きlineで処理し、overflow時に本文を保持して伸ばし続けない。正常replyは5keys、rankは上位3のlabel/scoreだけで、tokens・pieces・normalization・vector・入力由来error文を返す自由fieldがない。

本文混入の検査は固定schemaと人工markerの照合である。全任意文に対する漏洩試験や匿名化保証とは呼ばない。固定shape label自体は入力の意味を示す可能性があり、本文なしでも意味情報が完全に消えるわけではない。stderrは固定wire_runtime_failureだけをsource上で使い、actual Errorをserializeしていない。正常試験ではstderr0だった。

R5のfunc main()より前の13229B prefixはbyte一致し、wire R2 sourceはそのprefix＋WireMainR2.swift.partにbyte一致する。captionの固定SHAチェックをlazy initializationへ追加し、旧tokenizer/tableの固定SHA検証はそのまま利用する。invalid frameをrejectした後にmodelのlazy initializationへ進む構造であり、この試験ではW01が最初のvalid frameなので「冷状態のinvalidのみでmodelが未load」の資源測定までは行っていない。

requestIdはcorrelation値であり、順序認証・duplicate排除・epochではない。数値はFoundationのJSON/NSNumber解釈後にdoubleValueの有限性・非負・safe範囲・整数値を確認し、BoolをCFBoolean型で拒否する。-0と1.0をcanonical整数として許す契約だが、今回の20payloadではその二つを個別には測っていない。複製JSONkeysの拒否保証もない。JSON lexical値の任意精度解析は追加していない。

外側frame上限と返信上限は、old R5の意味policyを変更しない。4001scalarはinput_limit、4000個の球は4001tokensとなりtoken_limit、空白onlyは旧R5と同じ非holdだった。空白onlyを勝手に「形変更なし」へ変える判断はこのwire層にない。

[driver](evaluate_r1.py)の15秒はwhole batchのcommunicate deadlineであり、各返信のreceipt timestampや個別15秒deadlineは取得していない。初回elapsedMsにはlazy model/caption初期化が含まれる。観測したbatch wallは旧R5約0.0482秒、wire約0.0475秒だが、初期化・入力経路・processを含む一回観測のため速度優劣、一般16GB PC、idle CPU、widget whole RAMの証拠にはしない。timeout時の終了処理は自分が起動したchildだけに限定されている。

adoption gateへの結論は「この固定合成入口の契約で不一致なし」。query取消、期限切れ返信、認証、複数producer、actual IPC、アプリ接続、OS本文取得、人間の快適さは未実装・未確認である。既存版・model・app・Git・OS設定は変更していない。

[原票](evaluation-r2-first/RESULTS.json)、[source pins](SOURCE-PIN-R2.json)、[事前method](METHOD-R1.md)、[事前追加契約](METHOD-SUPPLEMENT-R1.md)、[fixture](CASES-R1.json)、[oracle freeze](evaluation-r2-first/ORACLE-FREEZE.json)を別々に保つ。
