# Metal 13形のroot実小窓確認

2026-10-03 05:29 JST。Apple M5・32GiB・macOS arm64。元Webの60形版、Metal v1/v2、人工状態・履歴を保持し、新しく作った比較アプリの独立copyだけを操作した。各copyは起動前にstrict ad-hoc署名を確認し、BuildInfoと実行物SHAを保存した。notarization・Intel・Windows・16GBの確認ではない。

## A：剣・花瓶・クラゲ

6形へ広げたStage Aの実小窓で剣・花瓶・クラゲを選択。クラゲの傘と触手の動きを観察した。fixture1,536白文字に人工の日本語・英字・家族emojiを青で加え、1,808保存／1,536描画／29種類、クラゲへの変化と旧白＋新青を確認した。pasteの確認で、実IME全体の確認ではない。

停止中の2原票はframe/time差0、scheduled=false。再開して隠した2原票もframe/time差0、hidden=trueだった。ただし隠した後のopen/CUA再選択はtimeoutで復帰不能。PID96022・開始時刻・自分の実行物pathを照合してSIGTERM終了した。**native Quit成功とはしない**。[原票](a/shutdown.json)、[停止](a/paused-first.json)、[非表示](a/hidden-first.json)。

## B：13形と入力

旧3形＋剣・花瓶・クラゲ・花・蝶・木・星・螺旋・砂時計・土星の候補。実窓では螺旋・蝶・花を選択し、人工入力 `青い表面 土星 ABCDあいうえお🙂` で土星へ変化、保存1,792／描画1,536／28種類を確認。続く `仕事の記録 ABCDEあいうえお` は材料を2,062／33種類へ増やし、土星を保持した。未知文の一般意味理解を確認したという意味ではない。

[前後診断](b/after-blue-saturn.json)、[未知文後](b/after-unknown.json)。visible Cmd-Qで終了し、同PID98198が消えたことを確認した。[終了](b/shutdown.json)。花と蝶の写真は側面に近い位相で薄く見えるため、形の認識性の合格画像にはしない。全13形の実操作・長期資源・人間の好みは未確認。数値・offscreen13形の確認は作者の別記録にある。

## C：非表示後の復帰

reopen delegateから既存showWindowを呼ぶ通常修正候補。fixture1,536白／クラゲのPID98628で、Cmd-H後の2原票はframe/time差0。explicit openで同PID・同1,536・同shape5の窓へ復帰し、frameが再開した。

先にCUA再選択でも復帰することを観察したため、本比較は **Hide → native診断2回 → explicit open → AX/画像** の順に分けた。[非表示1](c/hidden-first.json)／[2](c/hidden-second.json)／[開き直し](c/after-explicit-open.json)。停止したまま隠し開いた場合もpaused=true、time/frame差0、scheduled=falseを保持。[停止非表示](c/paused-hidden.json)／[復帰](c/paused-reopened.json)。visible Cmd-QとPID消失を確認した。[終了](c/shutdown.json)。

## E：明るさ候補の同状態比較

同じ人工状態の白1＋青260・メビウス・time24を、起動時pauseで固定。paletteと面の扱いは同じ、depth floorだけ0.30と0.45で比較した。time/shape/stored/drawn/kinds/viewport/camera/minimum/zoom/paused/scheduledは全同値。両appの実bundled MSLのSHAもBuildInfoに一致した。

[従来](e/legacy30/mobius-blue261-t24.png)／[候補](e/light45/mobius-blue261-t24.png)、[画素比較](e/pixel-comparison.json)。小窓内容のcode-value union mean lumaは4.898→5.522、約12.7%増。ただし校正された輝度や人間の読みやすさの測定ではない。実画像の差は小さく、どちらも青260の疎な文字は暗い。**既定floor0.30を保持し、0.45は別候補に留める**。青のサイズ・密度・字形の見え方は残課題。両方visible Cmd-Qで終了・PID消失確認済み。

このフォルダはrootのUI原票で、作者のsource/CPU/GPU検証とは別。本文は自作の人工文だけ。fixtureでは履歴read/writeを行わず、現行Webの原文保存off実装や全アプリの入力取得を示さない。CPU/RAMはここでは測っていない。

## 通常起動・保存復元 R1

fixtureではない通常modeを、新しい専用snapshot pathで実操作。近い@/press enter→Enterで欄が開く→人工文 `青い表面 花瓶 ABCDあいうえお👩‍👩‍👧‍👦` をclipboard復元型paste→Enterで花瓶へ変化した。@白1＋青256、257保存/描画、16種類。

actual Cmd-Q→独立snapshotからrelaunchでshape4/stored257/drawn257/kinds16/batches/seed一致。再度actual Cmd-QでPID消失。3追記snapshotを保持した。

[復元検査](normal-r1/RESTORE-CHECK.json)、[before状態](normal-r1/before-restart-state.json)、[初期](normal-r1/initial.png)、[入力後](normal-r1/after-input.png)、[再起動](normal-r1/restarted.png)、[コピーSHA](normal-r1/COPIES.json)。実IME全体・既存保存・全OS入力には触れない。
