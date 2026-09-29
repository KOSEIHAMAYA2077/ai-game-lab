# 執筆の横で育つ文字アート — 実現方法と試作設計

調査日: 2026-09-30。これは調査と設計の文書であり、OS全体の入力監視を導入・開始した記録ではない。実装済みの範囲は[作品の進捗](../concepts/glyph-creature/PROGRESS.md)を参照する。

## 受け取った案

ユーザー案は、任意のアプリで書いた文字が同時に作品へ入り、Enterで育ち、毎日新しい存在になり、前日の姿が日記として残る常駐作品。入力した文字そのものが材料になることと、執筆の邪魔をせず横で動くことが核となる。最新の「試作作ってみてくれ」を受け、まず現在のWeb版で体験を確かめられる設計にする。

**実現は可能。ただし「小窓を横に置くこと」と「別のアプリで確定した日本語を正しく受け取ること」は別の技術課題。** 通常のWebページは、他アプリや別サイトのキー入力を取得できない。Webのキーイベントはフォーカスしている要素へ送られる。このため、今回すぐ触れる入口は専用の執筆欄とし、将来はユーザーが選んだエディタとの連携へ広げる。[W3C UI Events](https://www.w3.org/TR/uievents/#events-keyboardevents)

## 今回試せる小さな構成（AI提案）

1. 作品内の「書く」から黒地の素朴な執筆欄を開く。普段の画面にはWebサイト風の操作パネルを増やさない。
2. 入力途中の文字は一時的な文字の列として作品へ近づく。日本語の変換中は未確定の影、確定後は読める文字とし、Enterでその行を集合へ送る。
3. 送信後も執筆欄へフォーカスを残す。Shift+Enterで改行、通常のEnterで作品へ送る。案内は欄の下に一行だけ置く。
4. 「横に置く」を押すと対応ブラウザでは小窓を開く。非対応なら普通の別窓か同画面で試す。
5. 日付ごとの姿を端末内に保存する。翌日最初に開いたとき、または起動中に日付が変わった次の操作時に前日を保管し、新しい @ を始める。
6. 「今日の形」からその日を見返せる。前日の記録を上書きしない。作品の状態と文章本文の保存設定は分ける。

文字が飛び込む前に編集した文章を全量保存する必要はない。初回は、Enterで送った断片と形・色・個数・乱数の種だけで再現可能にする方法が小さい。文字そのものを再現するには断片は必要なので、端末内に残ることを表示し、その日だけ消せる操作を付ける。本文保存を望まない場合は、文字集合を保存せず画像と統計だけを残す別設定にする。これは保存内容を選ぶ設計案であり、すべて実装済みという意味ではない。

日記の日付はUTCの文字列切り出しでなく利用端末の暦日を用いる。日付変更タイマーだけに依存せず、起動時・入力時にも比較する。PCを閉じていた日の架空の記録は作らない。過去へ時計を変更した場合にも記録を上書きしないよう、日付と記録IDを別にする。

## ブラウザでできること

| 方法 | 実現できること | 制約 |
| --- | --- | --- |
| 同じ画面の執筆欄とアート | 文章入力とアートの同時反応。今のThree.jsをそのまま使える | この執筆欄への入力だけが対象 |
| 同一オリジンの別窓 | 執筆窓と鑑賞窓を分け、イベントを送れる | 普通の別窓を常に最前面にする保証はない |
| Document Picture-in-Picture | 対応ブラウザで任意のHTMLを常に手前の小窓へ置ける | ユーザー操作が必要。親ページを閉じれば終了。全ブラウザ共通の前提にしない |
| アプリ本体のネイティブ化 | 枠なしの小窓、最前面表示、メニューから停止など | OS別の配布・起動・入力連携の検証が加わる |

別窓間の通信には同一オリジンの `BroadcastChannel` を使える。これは同じ作品の窓同士の通信であり、別アプリの入力取得機能ではない。[BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)

Document Picture-in-Picture は任意のHTMLを浮かぶ小窓に表示でき、呼び出しにユーザー操作が必要。位置はサイトから自由に指定できず、親窓の寿命を超えて残せない。機能検出を行い、非対応時は普通の別窓へ戻す。[Chrome公式の解説](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)

日本語は `keydown` の文字を連結して作らず、実際の入力欄の値と `input` / composition の状態で扱う。変換確定のEnterを送信として数えず、次のEnterで一度送る。ブラウザ自動試験のイベント再現と、実OSの日本語IME試験は別々に記録する。[UI Events](https://www.w3.org/TR/uievents/#events-compositionevents)

## 将来のデスクトップ版

### 先に「浮かぶ窓」だけをネイティブ化する

現在のThree.jsの描画を保持し、Electron等のデスクトップ窓へ載せれば、最前面表示を使える。Electronの `setAlwaysOnTop` はWindows/macOSに用意されている。まず専用入力欄と一時停止を持つ小窓にする。別ゲームの排他的フルスクリーン中にも必ず見えるとは保証せず、ゲームごとに確認する。[Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window#winsetalwaysontopflag-level-relativelevel)

最小化・一時停止時は描画を止め、通常の小窓もフレームレートと文字数を抑える。「作業やゲームの横にいる」が目的なので、文字数の上限なしより、少ない負荷で成長が読めることを優先する。

### macOSで別アプリに反応させる場合

`NSEvent.addGlobalMonitorForEvents` は他アプリへ送られるイベントのコピーを観察する。キー関連イベントにはアクセシビリティの許可が関係し、自アプリのイベントは同じ監視には来ない。macOSには利用者が切り替える入力監視の設定もある。OS版と採用APIを決めたうえで権限を実機確認する。[Apple NSEvent](https://developer.apple.com/documentation/appkit/nsevent/addglobalmonitorforevents%28matching%3Ahandler%3A%29)、[Apple入力監視設定](https://support.apple.com/guide/mac-help/control-access-to-input-monitoring-on-mac-mchl4cedafb6/mac)

これはキー操作の観察で、他アプリのIME変換結果をそのまま渡す契約ではない。たとえば「かみ」を「紙」にする最終結果、文章途中の置換、音声入力や貼り付けは物理キー列だけでは正しく復元できない。AppKitが確定テキストを編集ビューへ渡す入口は `NSTextInputClient.insertText(_:replacementRange:)` であり、入力先の文脈を伴う。したがって、グローバルキー監視だけで万能な文章ミラーを作れると扱わない。[Apple NSTextInputClient](https://developer.apple.com/documentation/appkit/nstextinputclient/inserttext%28_%3Areplacementrange%3A%29)

### Windowsで別アプリに反応させる場合

`WH_KEYBOARD_LL` はキー入力イベントを監視できる。一方、IMEの結果文字列は入力先ウィンドウの `WM_IME_COMPOSITION` と `GCS_RESULTSTR` 等で扱うため、低水準キーフックとは別である。フックで日本語確定文まで簡単に取り出せると想定しない。[Microsoft LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc)、[Microsoft WM_IME_COMPOSITION](https://learn.microsoft.com/en-us/windows/win32/intl/wm-ime-composition)

UI Automationによるテキスト取得も候補だが、対応するコントロールをアプリが提供している必要がある。文書の全文を繰り返し読む方法は、新たに書いた文字だけを拾う目的とずれる場合がある。対象エディタを限定し、選択・削除・置換の差分を検証する。[Microsoft TextPattern](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.textpattern.pattern)

### おすすめの入力連携順

**専用執筆欄 → 選んだエディタの拡張機能 → 必要ならOSごとの入力連携**、の順が、書いた文字を正しく取り込む目的に合う。エディタ拡張なら「確定した変更」と「送る対象の文書」を明示しやすい。ゲーム中は文字を読まず、本人が選んだキー操作に対応して匿名の光や粒を増やす別モードも考えられる。これは執筆内容の日記とは区別する。

OS全体に広げる場合も初期状態はオフとし、「どのアプリを読んでいるか」「停止」が小窓から分かる状態にする。許可したアプリ・編集欄だけを対象にし、パスワード欄・ロック画面・保護された入力・種類の分からない欄では収集しない。対象外へ移ったら未送信のバッファも捨てる。OSの保護入力を回避しない。

macOSのSecure Event Inputは、保護された入力を横取りするプロセスへのイベント供給を制限する仕組み。WindowsのUI Automationでも、提供側はパスワード等の保護情報を公開しないよう求められている。ただし全アプリが正しく属性を付ける保証としては使えないため、除外だけでなく対象を限定する設計にする。[Apple TN2150（旧APIを扱う技術資料）](https://developer.apple.com/library/archive/technotes/tn2150/_index.html)、[Microsoft UI Automation TextPattern](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/ui-automation-textpattern-overview)

## 試遊で確かめること

- 書きながら視界の隅で育つ変化が、書く意欲につながるか。
- 文章の意味と関係する形が時々出る頻度は、創作を邪魔せず発見になるか。
- 一日の終わりに残る姿を「自分が今日書いたもの」と感じるか。
- 日本語の変換確定・再変換・削除・貼り付け・改行で二重投入しないか。
- 再読み込みと日付変更で、前日の記録や当日の姿を失わないか。

最初のWeb試作で確かめるのはこの体験。OS全アプリ対応や任意のゲーム上への表示は、ネイティブ版として別途実機確認する。
