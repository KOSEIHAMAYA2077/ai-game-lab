# 証拠から研究の問いを分ける

対象は、創作・プログラミング・事務作業の横で、自分の文字が小さな身体にたまるサイドインテリア。毎回形の命令を送る使用と、日常文が素材になる使用は別である。現段階では専用 textarea の局所 producer までで、全アプリ取得を前提にしない。

## 読み取った三段階

| 層・版 | 検算された範囲 | この結果から言えないこと |
| --- | --- | --- |
| [人工入力契約](../../experiments/ambient-input-contract-v1/REPORT.md) | 活動と文字を分離、能力不足のknown宣言をpreview、composition / 差分 / seq / epoch / 有限queue、appendとdoc-syncの比較 | 合成source宣言が実OSの確定を認証すること、初期全文取込が望ましいこと、syncがID・色を完全保持すること |
| [人工統合 R3](../../experiments/ambient-integration-contract-v1/REPORT.md) | new grammar、唯一のmaterial/ID、whole-event追加後ACK、1slot retry、gapの修正回帰、限定3字句群、off集計export | v1 reducerへcast接続済み、全OS無損失、一般意味理解、widget全体保存 / renderer / 資源合格 |
| [専用欄 R2](../../experiments/ambient-editor-adapter-v1/REPORT.md) | 自作欄だけの局所trace guard、unknownIME素材0、重複 / paste / undo / redo / delete、Unicode原range、blur/破棄/二重owner修正、非UI検算 | 実IME全順序の保証、OS / 他app取得、3D小窓への接続、人体験、長期利用、全ページの安全消去 |

R3 / R2 は既知失敗を保持した修正回帰。assertion数を独立入力例、人、作業時間として足さない。R2の `isTrusted` は局所UA配送のguardであり、合成テストの true は人工宣言。正確なdocument差分だけをIME確定と呼ばない。親所有の実DOM / 資源記録は別記録で、この文書の調査・人間評価件数へ加算しない。

## 検証できる問いと必要な証拠

| 問い | 現段階の証拠 / 次の測定 | 分けるべき主張 |
| --- | --- | --- |
| Q1 入力と素材の対応を守れるか | knownな自作producer / 原version / serial / 原rangeに対して、期待追加量、重複、unknown誤追加、wholehold、ID / 色保持を数える。まず工学gate | 物理キー回数≠確定数。既知局所traceの保持率≠全IME対応率。全text event / known対象 / unknown層 / capacity holdを別分母にする |
| Q2 意味処理を待たず素材を増やせるか | ACKまでの受理遅延、描画へ渡る遅延、候補回答の遅延 / TTL失効を別測定。未返答・古い返答でも新文字追加を阻害しない | 同期の機構成功≠実アプリの低latency。人工clock / Node時間≠実DOM・renderer時間 / 人の反応 |
| Q3 表示は作業を止める場面を生むか | 同じ時間固定人工表示でOff / 静止 / 動き。課題誤り、完了時間、停止、隠す、邪魔の理由を個人別に記録 | 非有意≠無害・非劣性。少ない注視≠落ち着いている、多い注視≠価値がある |
| Q4 自分の入力が身体になると理解できるか | 別の研究用文章の自由試行。期待した変化、分からなかった変化、取りこぼしへの理解、見返したい理由を聞く | 固定replayの表示比較≠本人との因果感・愛着。理解できる≠日常利用を続ける |
| Q5 内容反映の安定性はどう働くか | 将来、同じ文字列・同じ候補列で更新scheduleだけを比較。変更数、受理候補の寿命、応答遅延、中断、説明を併記 | 変更166→21→13等の人工機構値≠快適性。引用/否定でも反応する3字句群≠一般意味理解 |
| Q6 編集と身体の履歴はどう関係すべきか | append保持 / 文書同期の明示された人工例を別提示し、期待との一致と理由を聞く | appendは暫定。削除しても古い文字を残す選好を全員へ一般化しない。syncの旧全文取込 / ID色再割当を隠さない |
| Q7 作業環境の横で維持できるか | 将来の通常窓でprocess帰属・CPU/GPU / memory / pause/hide復帰 / 上限後安定性、別の任意長期試用 | 8h工学稼働≠8h快適性。小型重み≠全appRAM。短期好み≠習慣・長期愛着・生産性 |

中心となる工学貢献候補は「不確かな入力と確定素材を分け、素材の唯一所有と返答待ちなしを守る有限な接続」。HCIの問いは「本人が望むときに見返せる痕跡として、作業を止める場面と価値の感じ方を具体化できるか」。どちらも新規性・一般性・製品成功を証明済みとはしない。

## 安全と不明点の境界

| 区分 | 現在の境界 | 未確認 / 将来のgate |
| --- | --- | --- |
| 取得 | 自分の専用欄のみ、初期baselineは素材0。raw keyは活動、unknownIMEはpreview | 実OS focus / securefieldの正確な識別、他appの確定証拠、既存全文取込は未実装・未採用 |
| no-ACK | 協調producerの1 frozen slotだけ同じeventを再送。pending中blur / 別値で明示unsupported | 非協調APIを無損失とは言わない。失効は追加取りこぼしとなり、通常baselineで隠れて復帰しない |
| 容量 | 文書512UTF16、単発256UTF16、preview64UTF16、body256 insertion-local grapheme units | 256units≠256bytes。長い変換の5秒失効、結合文字のイベント間非結合、自由文・数日の容量不足が体験へ影響 |
| 保存off | exportは集計のみ。本文・ID列・色順・doc / preview / window / query / fingerprintを除く | DOM / volatile body / read-only viewには本文が残る。安全消去、browser履歴 / BFcache / DevTools / 敵対scriptへの秘匿は未認証 |
| 人間研究 | 参加者0、募集なし。将来も研究用文章を使い、生本文・画面常時録画・外部モデル送信を既定にしない | 収集項目 / 終了・隠す / 任意撤回 / 資料削除の扱いを実施前に定める。所属先の研究手続きが必要かはその時点で確認 |
| 意味 | 有限の文字窓とsphere / box / ringの字句候補 | 命令精度のpositive / holdやexact形率をambient文章へ移さない。本人と異なる意味は具体的理由として聞き、事後の唯一正解にしない |
| 使用像 | Task Bar Heroは底部配置の参考 | 開発元紹介文は確定入力API・低資源・研究上の優位性の証拠ではない。[一次紹介](https://www.nugemstudio.com/en/games/taskbar-hero) |

このレビューは危険な取得機能を提案して実行するものではない。OS / clipboard監視や個人本文の送信、参加者募集を行わず、現在許可された専用欄の証拠範囲を明記する。
