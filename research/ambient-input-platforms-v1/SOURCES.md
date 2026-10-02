# 出典と確認範囲

確認日：**2026-10-03（JST）**。Apple、Microsoft、VS Code、Obsidian、CodeMirrorの提供者自身のAPI資料／SDK宣言だけを判断の根拠にした。一般blog、SNS、Q&Aの個別報告を互換保証には使っていない。各資料の要約はこの設計で必要な範囲に絞り、全文は転載しない。

## macOS

| ID | 一次資料 | 確認した範囲 |
|---|---|---|
| A1 | [CGEventTapOptions.listenOnly](https://developer.apple.com/documentation/coregraphics/cgeventtapoptions/listenonly) | passive listenerであり、イベントを変更／迂回できない |
| A2 | [Advances in macOS Security, WWDC19](https://developer.apple.com/videos/play/wwdc2019/701/) | Catalinaの他appキー監視にユーザー承認。現行仕様の全権限組合せを実測した資料ではない |
| A3 | [CGPreflightListenEventAccess](https://developer.apple.com/documentation/coregraphics/cgpreflightlisteneventaccess%28%29) | 現行公開シンボル。SDK CGEvent.hの説明でpreflightとrequestの違いも確認。APIは呼んでいない |
| A4 | [NSEvent global monitor](https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents%28matching%3Ahandler%3A%29) | 非同期copies、変更不可、自appイベントを含まない、キー監視のAccessibility条件 |
| A5 | [NSEvent.characters](https://developer.apple.com/documentation/appkit/nsevent/characters) | keyboard mapping由来、dead keyの空文字。IME確定本文のAPIという説明ではない |
| A6 | [TN2150 Using Secure Event Input Fairly](https://developer.apple.com/library/archive/technotes/tn2150/_index.html) | 2007年archive。Secure Inputによるintercept停止、IsSecureEventInputEnabled。現行SDK宣言も確認、現行OS実測なし |
| A7 | [AXObserverCreate](https://developer.apple.com/documentation/applicationservices/1460133-axobservercreate) | 指定processから通知を受けるobserver |
| A8 | [AXObserverAddNotification](https://developer.apple.com/documentation/applicationservices/1462089-axobserveraddnotification) | notificationUnsupported等の失敗。system-wide要素は通知に未対応 |
| A9 | [AXUIElementCopyAttributeValue](https://developer.apple.com/documentation/applicationservices/1462085-axuielementcopyattributevalue) | 属性未対応、no value、通信失敗、API未実装という状態 |
| A10 | [AXIsProcessTrustedWithOptions](https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions)、[AXUIElementSetMessagingTimeout](https://developer.apple.com/documentation/applicationservices/1459345-axuielementsetmessagingtimeout) | 公式referenceとSDK AXUIElement.hでtrust promptは非同期、要素別timeoutを確認 |
| A11 | [NSTextInputClient](https://developer.apple.com/documentation/appkit/nstextinputclient) | 自text viewがmarked text／replacement／insertTextを管理するprotocol |
| A12 | [tapDisabledByTimeout](https://developer.apple.com/documentation/coregraphics/cgeventtype/tapdisabledbytimeout) | timeoutによるtap停止のevent種別。handler負荷の管理が必要 |

SDK読み取りはCoreGraphicsのCGEvent.h/CGEventTypes.h、HIServicesのAXUIElement.h/AXRoleConstants.h/AXAttributeConstants.h/AXNotificationConstants.h、HIToolboxのCarbonEventsCore.h。インストール済みSDKのversionとhashをsource-evidenceに保存した。端末固有の絶対pathは公開記録へ含めない。

## Windows

| ID | 一次資料 | 確認した範囲 |
|---|---|---|
| W1 | [Using Raw Input](https://learn.microsoft.com/en-us/windows/win32/inputdev/using-raw-input) | device data、standard/bufferedのread経路 |
| W2 | [RAWINPUTDEVICE](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputdevice) | INPUTSINKとEXINPUTSINKの違い。NOLEGACYは不要 |
| W3 | [RegisterRawInputDevices](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerrawinputdevices) | 同一process/device classの登録窓は一つ。libraryから登録すると干渉し得る |
| W4 | [LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc) | callback thread/message loop、timeout、黙ってhook解除、Raw Input推奨 |
| W5 | [TextEdit Control Pattern](https://learn.microsoft.com/en-us/windows/win32/winauto/textedit-control-pattern) | providerのComposition/CompositionFinalized、cancelの空文字 |
| W6 | [UI Automation Events Overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-events-overview) | 通知が必ず状態差分を示すわけではない。managed overviewである |
| W7 | [UI Automation TextPattern Overview](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-textpattern-overview) | provider依存、rangeのinvalid化、passwordを公開しない、cross-process GetTextの粒度 |
| W8 | [get_CurrentIsPassword](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomationelement-get_currentispassword) | password状態property。全providerが常に正しく実装する保証としては扱わない |
| W9 | [Security Considerations for Assistive Technologies](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-securityoverview)、[Understanding Threading Issues](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading) | IL境界、UIAccess要件／用途、MTA専用threadの推奨 |
| W10 | [ITfThreadMgr](https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfthreadmgr) | app/text serviceのcontext focusとactivation |
| W11 | [Text Stores](https://learn.microsoft.com/en-us/windows/win32/tsf/text-stores) | hostのtext store、locking、外からの編集通知 |
| W12 | [ITfTextEditSink.OnEndEdit](https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itftexteditsink-onendedit) | edit session終了のcontext/record。確定全文の普遍的callbackではない |
| W13 | [Text Service Registration](https://learn.microsoft.com/en-us/windows/win32/tsf/text-service-registration) | COM/TSF/language profile登録と利用条件 |
| W14 | [WM_IME_COMPOSITION](https://learn.microsoft.com/en-us/windows/win32/intl/wm-ime-composition) | 自WindowProcへのcomposition message、RESULTSTR。別appを横断する受信APIではない |

Windows APIはこのMac上で実行・インストールしていない。UAC、管理者app、lock screen、ゲーム、Electron、各IMEの互換範囲は未測定。

## 明示連携

| ID | 一次資料 | 確認した範囲 |
|---|---|---|
| E1 | [VS Code API](https://code.visualstudio.com/api/references/vscode-api#TextDocumentChangeEvent)、[固定した公式型定義](https://github.com/microsoft/vscode/blob/382d6bffe6b61712a83ec794472c93899374a2c9/src/vscode-dts/vscode.d.ts) | transactional contentChanges、offset/length/text、version増加、Undo/Redo、dirty通知の空差分。公開型にIME確定fieldはない |
| E2 | [固定したObsidian公式型定義](https://github.com/obsidianmd/obsidian-api/blob/40301c12bb922dd8b954c60d674069b6818f0be4/obsidian.d.ts) | editor-changeはprogrammatic/user両方、registerEditorExtension、registerEventのcleanup |
| E3 | [Obsidian Editor](https://docs.obsidian.md/Plugins/Editor/Editor)、[Vault](https://docs.obsidian.md/Plugins/Vault)、[plugin lifecycle](https://docs.obsidian.md/plugins/guides/lifecycle-management) | active editorと保存fileの違い、CM5/CM6 abstraction、handler解除 |
| E4 | [CodeMirror reference](https://codemirror.net/docs/ref/#view.ViewUpdate)、[composing](https://codemirror.net/docs/ref/#view.EditorView.composing)、[ChangeSet.iterChanges](https://codemirror.net/docs/ref/#state.ChangeSet.iterChanges) | docChanged/changes、compositionStartedとcomposingの違い、transactionの変更範囲。Obsidianへの適合は未実機検証 |

公式developer branchの型宣言を固定したもので、ユーザー端末に入っているObsidian／VS Codeの版やそのIME動作を確認したわけではない。資料のAPI存在と採用版の互換を分ける。
