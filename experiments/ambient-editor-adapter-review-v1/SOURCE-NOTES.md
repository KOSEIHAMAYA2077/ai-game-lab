# DOM一次資料と独立reviewへの含意

確認日：2026-10-03 JST。一般的な仕様URLだけを外部に照会し、ユーザー本文は送っていない。いずれも現行仕様/draftで、実ブラウザの順序や実IMEは別途実操作を必要とする。

- [DOM Event.isTrusted](https://dom.spec.whatwg.org/#dom-event-istrusted)：UAの配送とscript dispatchを区別する属性。fake objectのtrueやdispatchした合成eventを実OS/IMEの確認として扱わない。
- [UI Events InputEvent](https://w3c.github.io/uievents/#interface-inputevent)：beforeinputとinputはDOM変更の前後を表し、isComposingはcomposition session中を表す。keyだけから確定本文を作らない。
- [UI Events compositionend](https://w3c.github.io/uievents/#event-type-compositionend)：終了にはcancelも含まれ、data空もあり、control更新後の通知。compositionendが来たという理由だけで全baselineを素材へ追加しない。
- [Input Events interface / inputType](https://w3c.github.io/input-events/#interface-InputEvent)：textareaのtarget rangesは空で、undo/redoでもranges/dataが空になる。contenteditableのrange方式をtextareaへそのまま流用しない。これは全ブラウザの具体的実装動作を確認したという意味ではない。
- [HTML textarea](https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element)：API value・選択offsetを扱う独自のtext control。読み取りは渡された専用fieldに限り、ほかのinputやOSを巡回しないというのが今回の設計上の制限。

上記からテスト設計として推論した方針は、入力type・対象field・composition lifecycle・原base差分の成立を分け、欠けたtraceはunknownとして素材0へ落とすこと。タイムアウトを確定証拠にはしない。仕様自体はこのGlyph Matter固有のadmission/ACK/privacy契約を定義しない。
