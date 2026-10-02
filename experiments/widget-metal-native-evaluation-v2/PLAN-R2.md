# root の事前条件を公開計画へ対応づけた補足

2026-10-03 04:00 JST。原PLANとSHAを保持したまま、rootが測定前に保存した `METHOD-ROOT.json` を公開計画へ対応づける補足。WKの90秒測定は03:55台に開始済み。この補足とhelperの完成・人工JSON検証は開始後であり、実測値を閲覧する前に行った。90/30/30秒・PID帰属・状態・数値の判定は原PLANのまま。

- 両版とも **保存1,537文字／描画1,536文字**。最初の@を含む。WKは人工入力24grapheme×64＋@。Metalはfixture1537に揃える。
- 文字の種類はMetal22／WK24。raw batch・seed・文字IDの配置・カメラ・rasterizerは完全一致しない。同じ文字数と球・白・モデルなしを揃える比較であり、完全同一の身体ではない。
- rootが準備したWKの主PID90619、GPU90631、Networking90633、WebContent90634は、初期候補であって計測時までの生存保証ではない。開始counterとcoalitionを実計測前に固定する。PID再利用・消失は検証で除外する。
- expectation sidecarの `body` をstored1537/drawn1536へ固定し、fixture・kind・camera・font・byte差を別欄に残す。WKのshape/viewportはrootのscene inspection/UI根拠。診断にない値をhelperが測定したことにしない。

初稿の「測定前」の時点表記は、rootの開始済み連絡で訂正した。原PLANは03:54:38 JSTにSHA固定済み。METHOD-ROOTはrootの測定前条件、こちらの補足とhelper完成は測定開始後、と区別する。原PLANを差し替えていない。
