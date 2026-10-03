# Wire spec 補足（新source読取前）

root から初回20payloadを固定した後、candidate sourceを受け取る前に次の運転仕様を受領した。元fixture/期待数は変更しない。

- 応答は LFを除いて2048bytes以下。IDはJSON数値として非負safe整数なら -0/1.0 も canonical整数にしてよい。Boolは不可。元20casesにこの追加numeric表記を網羅したとは言わない。
- model/captionは最初のvalid request時にlazy初期化し同processで保持。初回elapsedには初期化が入るためsteady queryの性能と混ぜない。invalid frameでloadしないことはsource placementで確認し、追加invalid-only model欠落実行は計画しない。
- R5 core prefixは byteのまま再利用する予定。core/table/tokenizer/captionのpinを確認する。初期化失敗は本文/path詳細無しの固定stderr＋終了で、全IPCの復旧は未実装。
- 独立driverは20payloadを一processへ一回連結してcommunicate(input,timeout=15)する。15秒はbatch全体のreply deadlineで、逐次replyのtimestampは採取しない。計時はcandidate自身のelapsedMsとbatch wallを区別し、source20caseのtimeout一般適合やfast起動を主張しない。
- 正常R5 parityは9reply、拒否12reply、21reply total。9の中にempty/input_limit/token_limit保留経路があり、9embedding成功と数えない。
