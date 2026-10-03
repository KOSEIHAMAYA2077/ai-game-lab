# 独立 wire 境界評価 METHOD R1

2026-10-03 JST。root の新 CLI source を読む前に、合成20 payload・21予定 reply を手書き固定する。既存 R5/source/parity例は既知。この試験は未見言語や形の意味精度ではなく、新しいwire入口の境界確認である。古いモデルreview20+4、長時間CLI観測、作者ケースと母数を合算しない。

request は requestId/text/registry の3必須keys、余分keys拒否。IDは0..2^53-1整数、Bool不可。shape/primitiveのみ。JSON parse前32768 content bytes上限（LF除外・CR含む）。長すぎる行は改行まで捨てて frame_limit、次lineへ復帰。EOFのunterminated最終lineも1件。複製JSONkeysの拒否保証は今回追加しない。

reply固定5keys: requestId、registry、ranks、hold、elapsedMs。requestIdはsafe整数かnull、registryはknown2値かnull。ranks最大3で各label/scoreのみ、score有限。holdはnullまたは固定理由、elapsedMs有限非負。本文・tokens/pieces/normalization/vector/mean/caption/query/入力由来error文・任意registry文字列を返さない。正常ID/registryは一致、malformed UTF8/JSON/frameは双方null。schema拒否は抽出できたvalidID/registryをechoしてもよいので期待集合を固定した。

invalid_utf8/invalid_json/invalid_schema/invalid_registry/frame_limitはranks=[]。正常encodingのholdはR5と一致する。空白onlyをemptyと再定義しない。4001scalarはinput_limit、球4000scalarは既知token_limitの境界を確認しembedding/rank完了例へ数えない。

20payloadを一つの固定順序へ連結し、固定candidateへ一回送る。W05はID1を再利用し、重複排除・順序認証が無いcorrelation contractを確認する。W18はCRLF込みcontent32768、W19は32769→valid nextlineの復帰、W20はEOF最終line。例ごとにmodelを再起動した20完走とは呼ばない。

正常wire返信9件（normal-r5-parityとラベル付けした件数はfixtureから算術検算）について、同じ人工text/registryでfrozen旧R5のtop3をlabel/scoreへ射影したoracleを使う。初回oracleはcandidate source受領後でもcandidate初回callより前に固定し、旧R5の再利用既知parityと区別する。tokens等を含むoracleの原票は人工文のみ。fixed score絶対誤差<=1e-6、label/order/hold一致。scoreはsemantic confidenceとしない。

15秒reply timeoutを持った独立driverを新folderだけに保存する予定。candidate/source/model/tokenizer/table/captionを固定通知後pinしてから初回callを行う。未返信、extra返信、EOF/exit非0、stderr、本文混入、非有限値は失敗として保持。原票/fixture/source/thresholdを上書きしない。修正candidateが来れば別snapshotの既知回帰。

JSONLの小さい人工入力だけを扱う。OS/body/UI/実IPC/epoch/timeout失効/複数producer/全入力収集へ接続しない。FRAME capと返信field制限は実IPCの認証・完全なsecurechannel・常駐性能を証明しない。自分の所有はwire-review folderと既longrun-reviewだけ、root app/source/Gitを変更しない。
