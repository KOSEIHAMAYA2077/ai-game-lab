# 非監視のイベント設計と人工ケース

実adapter、global hook、権限要求、通信listenerはない。[event-schema.json](event-schema.json) は正規化後の設計、[synthetic-fixtures.json](synthetic-fixtures.json) は人工の例文だけを使う期待値である。今回、schemaの整合性だけを確認する。OS/IME動作を試験済みという意味ではない。

## 生の信号をそのままrendererへ渡さない

```text
キー活動 ── countだけ ───────────────┐
                                       │ 脈動・速度
明示editor ─ policy ─ revision/IME ─────┤
                                       │ 仮の文字／確定batch
AX/UIA互換 ─ policy ─ capability確認 ──┘
                     ↓
         bounded queue → 小さな形の候補 → glyph surface
```

活動イベントはkey code、Unicode、modifier、clip、window title、file pathを持たない。activity.unitsは打鍵活動の単位であり、入力文字数ではない。

textDeltaは文書の置換範囲と新版を持つ。UTF-16 offset/lengthをそのまま文書座標に使い、字形を作る段階でgraphemeへ区切る。正規化したNFC文字列をoffset計算へ戻さない。例えば家族emojiは複数UTF-16 unitでも一つの字形である。multi-cursor変更は同じbase版に対する複数rangeとして、重ならないことを確認し、適用する場合は末尾rangeから処理する。文書本文をrendererへmirrorする必要はない。

schemaのallowed/secureStateは、外から届いた主張をそのまま信用するfieldではない。許可したadapterの内部境界で正規化し、receiverは自分の接続許可・policyEpoch・focusEpochと再照合する。synthetic=trueは今回のfixtureの性質を示すだけで、実adapterを許可する手段ではない。

certaintyは別fieldにする。

| certainty | 意味 | 永続的な文字吸収 |
|---|---|---|
| composing | 入力元がIME途中と示した | しない。候補を一つ更新する |
| finalized | 入力元で確定が判断でき、操作の同一性もある | 許可したprimary経路で一度だけ |
| document-only | 差分は正しいがIME確定状態が不明 | 可逆的な候補まで。確定と呼ばない |
| explicit-send | 本人が送信command等で選んだ文字列 | 一度だけ |

VS Codeの公開document eventは基本document-onlyにする。静かな時間が続いたからfinalizedへ格上げしない。UIAのCompositionFinalizedも、文書版・range・操作IDがない場合は全文差分として使わない。その経路を使うなら限定したtextCommitとして扱い、TextChanged経路を同じcontextのprimaryに重ねない。

compositionにはcontext内の操作IDを振り、updateはappendではなく同じ候補の置換にする。最終callbackと文書差分が同じ操作を示すと判断できなければ、二経路を使わない。cancelの空文字は新glyphを生まない。Undo/Redoは新規創作として加算せず、候補や参照する形を元に戻す方針にする。過去の身体をすべて巻き戻すかは作品の決定であり、API事実ではない。

dedupはsession/context/operation/revision/eventIdを使う。文字列だけのdedupは禁止。「輪」「輪」と本人が二度入力した場合は別操作であり、二つの新規入力である。transport再送は同じeventIdと同じpayloadなので一度だけ扱う。届いていない新版、古いfocus、古いpolicyEpochは追いかけて本文を取り直さず、gapを記録して新baselineまで候補を停止する。

## bufferと保存

- 仮の原文は最大512grapheme／5秒の候補buffer。全document snapshotを保存しない。数値は提案値で未測定。
- queue64件、text8KiB/batch、edits64個の設計上限。JSON SchemaのmaxLengthはUnicode code pointなのでUTF-16 unit／UTF-8 bytes／grapheme上限はadapterで別に検査する。
- 溢れた時、普通のactivityは集約できる。textDeltaを勝手に捨てて「正確」と扱わず、gapとして候補を止める。先頭だけを使う場合はtruncatedを明示し、正確な全入力文字数とは呼ばない。
- primary接続解除、focus変更、policy変更、secure化、explicit停止で候補本文を破棄する。保存なしmodeでは現在のglyph textもdiskへ保存しない。
- metricsは件数、遅延、drop、candidate/finalizedの数、queue peakのみ。本文、key code、file path、再構成可能な文字列hashを記録しない。

## 後で実機で確認する条件

| 条件 | 成功として必要なこと |
|---|---|
| 日本語「りんかん」→「輪環」、候補を複数回切替 | 中間文字が重複して残らず、確定したglyphが一回 |
| IMEをEsc cancel／focusを別appへ | candidateの消去。finalized0 |
| Enter確定後もう一度Enterで改行 | 確定と改行を別操作として扱う |
| Ctrl/Cmd-V、mouse paste、音声入力 | clipboardを読まず、文書変化として扱う |
| multi-cursor、置換、undo/redo、formatter | UTF-16座標と版を保持。人間の新規入力と推測しない |
| emoji、結合アクセント、NFC/NFD、日本語長文 | 座標と字形の粒度を混同しない |
| password、securefield、除外app、管理者window | 本文吸収0。取れない範囲を示す |
| pluginとAX/UIAを同時接続 | 同contextのprimaryは一つ。文字の二重吸収0 |
| toolが切断／応答停止／queueoverflow | boundedな停止・gap。表示が動いても正確さを偽らない |
| 入力1000件/min、idle30min、hide30min | input thread時間、CPU/RAM、queue、原文disk write0を別々に測る |

実機では対象app/版、OS版、IME名/版、通常入力とsynthetic入力、権限状態を必ず併記する。人工fixtureの成功から上表の互換や資源値を主張しない。

今回の確認はJSON構文、参照、必須field、追加field、人工データの印だけである。完全なJSON Schema validatorやsemantic reducerは実行していない。期待値は後の実装が満たすべき設計であり、28件の実装テストが通ったという意味ではない。
