# 仕事や創作の横で育つ Glyph Matter：入力を受け取る方式

確認日：2026-10-03。API仕様と、そこから提案する設計を分ける。この調査ではOS全体の入力監視、権限の要求、設定変更、IMEの導入、クリップボードの読み取り、実ユーザー本文の取得を行っていない。既存のアプリ・保存・実験を変更していない。

**全体への反応は「入力活動」、言葉に応じた変形は「対応アプリの本文」という二層で始めるのがよい。** キーを押した信号と、日本語変換・貼り付け・推敲を終えた文書は別のデータである。OSのキーボード監視だけで、全アプリの確定本文を普遍的に受け取れるとはいえない。

仕事中は静かに呼吸する。入力が続くと流れが少し強まる。対応する執筆アプリで「輪っか」「四角い」などの言葉が現れたら、形の候補をゆっくり混ぜる。活動量しか分からない場面では、押された文字を推測して表示しない。これは実装方針の提案であり、今回検証した完成機能ではない。

## 先に区別する四つの入力

| データ | 分かること | 分からないこと | 表現への使い方 |
|---|---|---|---|
| キー活動 | 押下の回数、間隔、継続 | 変換後の日本語、貼付本文、文書の置換 | 呼吸・流速・密度の小さな変化 |
| IME確定 | 対応する入力経路で確定した文字列 | 別アプリ全体の履歴、全置換の位置 | 新しい文字の吸収。ただし確定を判断できた経路だけ |
| 文書差分 | 挿入・削除・置換、対応APIなら版番号 | 操作が本人の打鍵か補完か、一般にはIME確定状態 | 言葉の候補、修正を含む可逆的な見た目 |
| 文書スナップショット | 読めた範囲の現在の本文 | その間の操作順、全文が読めない場合の差分 | 互換経路。確定や正確な増分として扱わない |

「Enterを押した」はIME候補を確定する操作でもあり、改行でも、ダイアログ操作でもある。原文を受け取る側が、キー名から意味を決めない。

## macOS と Windows の比較

○はそのAPIの契約で得られるもの、△は対象の対応・権限・別の情報が必要なもの、×はその経路だけでは得られないもの。特定アプリでの実測結果ではない。

| 経路 | キー活動 | 日本語IME確定 | 貼付・置換・undo・音声入力 | 正確な文書差分 | 権限・適用範囲 |
|---|---:|---:|---|---:|---|
| macOS `CGEventTap` / `.listenOnly` | ○ | × | ショートカット等のキーは観測できても、結果の文章は× | × | 他アプリのキー監視はユーザー承認。Secure Event Inputでは受け取れない場合がある [A1–A3, A6] |
| macOS `NSEvent` global monitor | ○ | × | 結果の文章は× | × | コピーを非同期観察。自アプリ分は届かない。キー監視の参照資料はAccessibilityの信頼を要求 [A4–A5] |
| macOS `AXObserver` ＋ AX属性 | △ | △ | 対象の値／テキストが更新され、通知・読取に対応すれば△ | △ | Accessibility。対象プロセス・要素単位。属性／通知未対応や通信失敗がある [A7–A10] |
| macOS 自分の `NSTextView` / `NSTextInputClient` | 自窓で○ | 自窓で○ | 自分のtext storage変更で扱う | 自窓で○ | 自アプリの入力。別アプリを横断するAPIではない [A11] |
| Windows Raw Input / `WM_INPUT` | ○ | × | 結果の文章は× | × | `RIDEV_INPUTSINK`なら自窓が非前面でも受信。現在のdesktop/sessionの入力機器経路 [W1–W3] |
| Windows `WH_KEYBOARD_LL` | ○ | × | 結果の文章は× | × | hookを入れたthreadに戻る。message loopと短いcallbackが必要 [W4] |
| Windows UI Automation Text/TextEdit | △ | 対応providerなら△ | Text変更通知／読取に対応すれば△ | △ | providerの対応と整合性に依存。管理者UIや保護desktopに境界がある [W5–W9] |
| Windows TSF text service | 対応contextで△ | 対応contextで△ | host text storeが通知する変更なら△ | 対応contextで△ | text service登録・language profile・host実装が必要。常駐の普遍的な本文APIではない [W10–W13] |
| VS Code extension | 文書変更は○ | **公開APIだけでは確定フラグ×** | 文書変更なら○、操作原因が不明な場合あり | 対象TextDocumentで○ | インストールして許可したworkspace/docだけ [E1] |
| Obsidian editor-change | 文書変更は○ | このイベント単独では× | active editorの変更なら○ | 変更通知だけでは差分× | pluginを許可したVault/active editor [E2–E3] |
| Obsidian CM6 editor extension | 文書変更は○ | composition状態を使って△ | editorのtransactionとして○ | ChangeSetとして○ | host/CMバージョンと日本語IME回帰が必要 [E2, E4] |

上の○も、操作が「人間による新規入力」だったと保証しない。補完、formatter、拡張機能、共同編集も文書を変える。音声入力もキー信号より、最終的に文書へ入った変更として扱う方が自然である。

## macOS で気を付ける実装上の違い

`CGEventTapOptions.listenOnly` は観察専用で、イベントを変更・遮断できない。Catalina以降の全体キー監視承認はWWDC19で説明され、現行SDKには `CGPreflightListenEventAccess` と `CGRequestListenEventAccess` がある。前者は事前の状態確認、後者は要求のための別APIである。今回はどちらも呼んでいない。参照の古い `CGEventTapCreate` ページにはOS X 10.4時点の説明が残るため、その記述だけで現行OSの権限条件を決めない。[listenOnly](https://developer.apple.com/documentation/coregraphics/cgeventtapoptions/listenonly)、[WWDC19](https://developer.apple.com/videos/play/wwdc2019/701/)、[preflight](https://developer.apple.com/documentation/coregraphics/cgpreflightlisteneventaccess%28%29)

`NSEvent.characters` はキーのUnicodeマッピングであり、別アプリのIME確定本文ではない。global monitorは自アプリのイベントを含まないので、後で採用する場合もlocal/global二経路を同じ操作として重複させない。Input MonitoringとAccessibilityを「どちらか一つで常に全部動く」とも決めない。包装・署名・OS版を固定した実アプリで後日検証する必要がある。[characters](https://developer.apple.com/documentation/appkit/nsevent/characters)、[global monitor](https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents%28matching%3Ahandler%3A%29)

AXの通知は「値が変わった」と知らせるのであり、必ず差分やIME確定文字列を持つわけではない。対象のattribute/notification対応を先に確認し、対応しないeditorを毎フレームpollしない。AX通信は描画threadから分離し、要素ごとのtimeout、取得量、再試行回数に上限を置く。composition状態が分からなければ `candidate` として扱う。[AXObserver](https://developer.apple.com/documentation/applicationservices/1460133-axobservercreate)、[登録の失敗条件](https://developer.apple.com/documentation/applicationservices/1462089-axobserveraddnotification)、[属性の失敗条件](https://developer.apple.com/documentation/applicationservices/1462085-axuielementcopyattributevalue)

Secure Event Inputを解除することで補う方式は採らない。password field、`AXSecureTextField`、除外したアプリは本文経路に入れない。Secure Inputが有効なときキー信号が欠けること自体を正常な停止状態とする。AppleのTN2150は2007年のアーカイブであり、現行SDKの宣言も読み取り確認したが、最新OSの実際の遮断範囲は今回未測定である。[Secure Event Input](https://developer.apple.com/library/archive/technotes/tn2150/_index.html)

## Windows で気を付ける実装上の違い

Raw Inputはscan code/virtual key等を受ける。`RIDEV_INPUTSINK` は非前面での受信を可能にするが、変換済みの文章を返す指定ではない。専用helperが一つの受信窓を所有し、libraryから登録を奪わない。Microsoftも、同一processの同じdevice classでは最後の登録窓だけが受け取ると説明する。[RAWINPUTDEVICE](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputdevice)、[RegisterRawInputDevices](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerrawinputdevices)

`WH_KEYBOARD_LL` はcallbackのtimeoutで失われる場合があり、Windows 7以降は黙って解除される。Microsoftは多くの場合Raw Inputを推奨する。活動量なら、キーを遮断するhookを導入する理由は薄い。どちらも日本語IME、貼付、音声入力後の本文を復元するための根拠にはしない。[LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc)

UIA TextEditには `CompositionFinalized` があり、対応providerは確定した文字列を通知できる。cancel時の空文字も合法である。一方、普通のTextChanged通知だけで確定状態・差分・操作者を決めない。password propertyを先に確認し、本文の読取はmoderateな範囲に制限する。UIA処理は専用COM MTA threadで行い、UIthreadから全面走査しない。高いintegrityのUIへ届かないことを、この作品のためにUIAccessや管理者実行を使って回避しない。[TextEdit](https://learn.microsoft.com/en-us/windows/win32/winauto/textedit-control-pattern)、[password](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomationelement-get_currentispassword)、[threading](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading)、[UIAccess条件](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-securityoverview)

TSFはtext storeとcontextを通じてinput serviceが協調する仕組みである。自分のprocessでThreadMgrを作れば他アプリの全文が列挙できるわけではない。text serviceとして登録する案もhostのtext store通知、選択profile、composition対応に依存する。IMEを切り替える研究としては別途考えられるが、普段の執筆を邪魔しない小窓の第一案にはしない。[Text Stores](https://learn.microsoft.com/en-us/windows/win32/tsf/text-stores)、[Text service registration](https://learn.microsoft.com/en-us/windows/win32/tsf/text-service-registration)、[OnEndEdit](https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itftexteditsink-onendedit)

## 明示連携から始める具体案

**VS Code：** `onDidChangeTextDocument` の `contentChanges`、rangeOffset/rangeLength/text、document.version、Undo/Redo reasonを使う。文書名・file URIを送らず、そのセッションだけのopaqueなdocument IDに置き換える。接続開始時点の既存全文は送らない。dirty状態等の通知でcontentChangesが空なら、文字の追加と数えない。extension APIはIMEの確定フラグを公開していないので、最初の正確な吸収は「選択範囲／段落を送る」commandとし、自動の差分経路は可逆的な候補表示にする。一定時間変化がなかったことをIME確定の証拠にはしない。terminal入力、webview、custom document、他アプリは別対応である。[VS Code API](https://code.visualstudio.com/api/references/vscode-api#TextDocumentChangeEvent)

初版はlocal extension hostのlocal workspaceに絞る。Remote SSH、WSL、Codespaces、browser extensionは、transportと本文の所在が変わるため別の比較対象とする。初版の「端末内」はこれらを含むと主張しない。

**Obsidian：** まず許可したactive Markdown editorだけを対象にする。`editor-change` はユーザー操作にもprogrammatic変更にも発生し、差分は返さない。全文getValueを毎打鍵で複製するより、`registerEditorExtension`でCM6のViewUpdate.changesを受け、compositionStarted/composingとtransactionを組み合わせる。IME途中は仮の文字列を更新し、cancelなら廃棄、composition後の安定したdocument revisionを一度だけ吸収する。この処理が正しいかは、Obsidian＋同梱CM6＋日本語IMEで回帰する。Vaultのmodifyは保存・外部変更も含むため、ユーザーが今入力した確定文と同一視しない。[公式型定義](https://github.com/obsidianmd/obsidian-api/blob/40301c12bb922dd8b954c60d674069b6818f0be4/obsidian.d.ts)、[Editor](https://docs.obsidian.md/Plugins/Editor/Editor)、[CodeMirror reference](https://codemirror.net/docs/ref/)

plugin内で「そのアプリで見える文書だけ」を扱う。clipboardは読み取らず、貼付の結果は文書transactionで受ける。formatterやAI補完が長文を入れても、1回のbatch上限を超えた分は数と省略状態だけにする。原文ファイルを変更・保存・削除する機能は不要である。

## 小窓に渡す前の境界

実装時は以下を設定・処理として持たせる。今回は設計のみ。

1. **入力源を分離する。** 活動イベントは文字・key code・modifier・window titleを持たない。意味処理へ渡せる本文は許可したadapterだけ。
2. **除外を読取より先に判定する。** password/securefield、除外app、許可されていないworkspace、古いfocus epochでは本文を読まない／受信済みなら破棄する。状態が不明なら本文取得を止める。
3. **同じ文書の入力源は一つにする。** pluginがあるeditorではAX/UIAを重ねない。キーは流れの脈動に使えても、本文の文字数へ加算しない。
4. **本文は短い一時bufferにする。** 提案上限は意味処理用512grapheme・5秒、IME候補512grapheme、通信batch8KiB、待機queue64件。数値は初期設計値であり実測した最適値ではない。原文の長期mirrorを小窓側へ持たない。
5. **原文を保存しないmodeを標準にする。** 本文・候補・描画中の文字・復元可能な文字ID列はvolatile。保存するのは形のseed、集約した活動量、時刻等。日記に実文字を残すmodeは別の明示設定とする。文章の順序を捨てても字形は情報を残すので、「文字のbodyをdiskへ保存」と「原文保存なし」を同時に約束しない。
6. **端末内のtransportを独立させる。** Unix domain socket／Windows named pipeなど、利用者を限定したIPCを第一候補とする。新しい入力API調査のためにnetwork listenerを今開く必要はない。adapter許可、nonce、受信量、切断、停止をrendererから独立したqueueで扱う。
7. **見えない時も入力と描画を別にする。** hide時に描画予約は止める。許可した入力batchはboundedに集約できるが、意味modelは文のまとまりができた時だけ起動し、常時tokenごとに推論しない。取れない時は活動量のみ、または静止へ落ちる。

## 推奨する段階と採用条件

| 段階 | 新しい比較版で試すもの | 完了条件 | 今回の状態 |
|---|---|---|---|
| 0 | 人工eventのreplayとIME重複・cancel・undo設計 | [イベント設計](EVENT-DESIGN.md)のケースを満たす | schema／fixtureを作成。実adapter無し |
| 1 | Obsidian CM6連携、VS Codeの明示送信command＋可逆候補 | IME二重吸収0、本文ログ0、除外有効、既存文書不変 | 提案。未実装・未実機検証 |
| 2 | 活動量だけの全体反応を独立helperへ | passive、キー文字を保持しない、負荷と欠落の数値記録、停止可能 | 今回は監視を開始しない |
| 3 | 許可した少数appだけAX/UIA互換経路 | app/版ごとの対応表、securefield0本文、通知欠落の扱い | provider依存の研究候補 |
| 保留 | TSFや独自IMEによる広範囲の本文取得 | 普段のIMEを邪魔しない証拠とhost別回帰 | 小窓の第一案にしない |

研究としては、**「不完全で異なる入力源を、文字の身体へ一貫して接続する境界」**が題材になる。比較軸は、新規文字のprecision/recall、IME重複率、削除・undo後の整合性、取得できないappの割合、意味反応の遅延、idle CPU/charged footprint、執筆を中断した回数である。OS APIの存在から、正確さ・低負荷・快適さの測定値は導けない。今回のMetal offscreen試験も、この入力方式の性能や通常windowの性能を証明しない。

出典一覧・確認方法・固定したSDK/型定義のhashは [SOURCES.md](SOURCES.md) と [source-evidence.json](source-evidence.json)。

人工28ケースと35イベントのrequired/additional field等を確認し、activityにtextを混ぜる1ケースを拒否対象にした。[設計ファイルの確認範囲](design-checks.json)には、JSON Schema 2020-12の完全validator、semantic reducer、実IME、OS APIを実行していないことも記す。
