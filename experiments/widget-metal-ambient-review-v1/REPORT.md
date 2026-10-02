# 専用編集欄 → 単一の文字身体 → Metal の独立レビュー

2026-10-03。対象は Producer R2 / Build R4 と、応答容量を直した Bridge R2 / Build R5。実装作者のソースを読む前に、人工コールバック 12 件・境界 6 件の期待値を固定した。取消の既知回帰 1 件は別の母数として扱う。ウィンドウに接続していない `NSTextView` のメソッドを人工文字で呼び、同梱 JavaScriptCore と実際の 80 B インスタンス生成関数まで検査した。

最初の固定 R4 で **12/12、6/6**。R5 の同じ期待値による既知修正後の回帰でも **12/12、6/6**。取消 1/1 をこれらへ足して「19 件の新規検証」とは呼ばない。実ウィンドウ・日本語 IME・OS 全体入力・描画・常駐性能は今回の独立評価に含まれない。

## 結果と分母

| 固定した対象 | 人工入力コールバック | 独立境界 | 既知取消 | 位置づけ |
|---|---:|---:|---:|---|
| Producer R2 / Build R4 | 12/12 | 6/6 | 1/1 | 期待値固定後、修正版の初回独立評価 |
| 過去の Producer R1 を同じハーネスで呼ぶ | 10/12 | 6/6 | 0/1 | 初回評価後の感度確認。取消不具合を再現 |
| Producer R2 / Bridge R2 / Build R5 | 12/12 | 6/6 | 1/1 | 応答 guard 修正後、同じ期待値の回帰 |

R1 は C05（一般 `unmarkText`）と C12（明示取消後の hide/resume）、別 K01（取消の再入）で失敗した。過去版の失敗は保存し、修正版の数値へ混ぜていない。全行の body 数・一意 ID・集計を保存 JSON から再計算し、保存済み集計との相違はなかった。R4/R5 のコールバックから bridge への例外は 0。

12 件には同じ文字を二度入れる、marked text を二度更新してから確定する、出所不明の編集、選択置換、属性付き文字と emoji、追加単位だけの色変更、削除後も身体に残る文字、通知 echo、明示取消後の再開が含まれる。6 件は pause/hide 復帰時の ID、80 B 配列、body 容量、単発 UTF-16 容量、編集欄の文書容量、destroy 後の追加停止、保存 off の allowlist を確認する。case 本文と期待値は [CASES-R1.json](CASES-R1.json)。

## 応答 JSON の既知容量不具合

作者から応答 guard の不具合を聞いた後、別 METHOD と人工 fixture を固定した。ASCII 一文字に 255 個の結合記号を加えた、256 UTF-16 / 1 grapheme の単位を 256 回追加し、各回に文書だけを空へ編集する。身体は 256 grapheme でも、保持本文は合計 65,536 UTF-16 になる。この検証は上の 18 件へ追加しない。

| 応答 guard | send 例外 | 最初の例外 | 最終 body | Swift 復号 view の再 JSON 化 |
|---|---:|---|---:|---:|
| R4: 131,072 B | 33 | command 481、241 回目の commit | 256 / 65,536 UTF-16 | 139,704 B |
| R5: 524,288 B | 0 | なし | 256 / 65,536 UTF-16 | 139,704 B |

両方で古い ID・色・本文 prefix は保持された。R4 の `passed:true` は「古い guard が失敗する感度確認が期待どおり」という負例の意味であり、R4 の製品動作を合格とした値ではない。R4 は send が失敗しても JS 側の材料追加が先に済んでいる場合がある。以前の `current()` は無制限復号だったため最終状態を読み取れた。R5 は `send/current` の共通 guard を使う。

139,704 B は `AmbientReceiverView` を Swift で復号し再エンコードした値。元の JS frame に存在する `shapeToken` 等を含む wire byte の直接測定ではない。作者の別 fixture の 204,985 B / send 187 とは材料が違い、置換しない。

固定スキーマの上界は `256 × (256 × 6 + 64) + 8192 = 417,792 B`。UTF-16 単位を JSON escape の最大 6 B とし、各 unit の固定キー・ID・4 色を 64 B、固定 frame メタデータを 8,192 B で予算化する。ID は実際には 1〜256、shape は 3 種類、`latestAnswer` は query ではなく五つの整数メタデータと shape のみ。新 guard まで 106,496 B の余白がある。この根拠は今の固定フィールドと各文字容量に限る。JSON、JS、Swift、atlas がそれぞれ持つコピーを含むアプリ全体 RAM の上界ではない。

独立 JSON ハーネス初稿では Swift の `||` と `!` 間の空白不足でコンパイルが失敗し、実 probe は 0 件だった。[BUILD-JSON-R1.json](BUILD-JSON-R1.json) と初稿ソースを保持したまま、空白と結果の版名だけを直した r2 helper を実行前に固定した。製品ソース・fixture・期待値・閾値は変えていない。

## データの所有と描画側の境界

R3 receiver の一か所が grapheme 分割、whole-event 追加、ID 採番を行う。新 JSC bridge はこの receiver と `readBody` を参照し、Swift Projection は既存 ID・色・本文 prefix を検証して表示用 view を増やす。別の material allocator はない。空の身体ではインスタンス 0、初期 `@` は別の AppKit label。置換・削除は現在の文書を更新するが、すでに身体になった文字を削除しない。

実際の `ambientInstances` は五つの 16 B 成分、stride 80 B。表示済み ID をそのまま使用することを CPU で確認した。Renderer は新しい表示文字が生じたとき atlas / instance buffer を組み直し、文字の表面位置・接線は shader 側へ残す。一方、bridge の state は持続していても、**各 command / advance の応答は全文 body view の JSON**。Swift 側も既存 prefix を走査する。通信が新しい一文字だけの delta になった、または CPU が uniform 更新のみになった、とは言えない。

語彙 scheduler は sphere / box / ring の 3 種類で、native では sphere / cube / mobius へ対応させる。ring → mobius は作品上の表現で数学的同値ではない。shader に他の形の実装があっても、専用編集欄から native 16 表現へ意味理解で対応したことにはならない。

## 入力とライフサイクルの限界

R2 は取消中の `super.unmarkText` から `insertText` が再入しても材料追加しない。一般 `unmarkText` も、この実験では出所を確定できない document-only として 0 追加にする。ただし Apple は `unmarkText` の marked text を通常の挿入のように受理することを説明している。この 0 追加は取消混入を防ぐ保守的な lab 方針であり、一般 IME への適合や確定取りこぼしの不存在を示さない。[Apple: NSTextInputClient.unmarkText](https://developer.apple.com/documentation/appkit/nstextinputclient/unmarktext%28%29?changes=_7_4_1&language=objc)（2026-10-03 確認）。

容量不足では whole-event の材料追加を 0 に保ち、古い ID を残すが、canonical 文書は更新され、R3 は ACK=true / held で消費する。この native producer は常時 admission ready の subset で、retry の公開経路がない。無損失入力や一時 no-ACK 復旧まで完成したと呼ばない。

source の hide 経路には確認事項が残る。明示 hide / INPUT を閉じる操作 / key-window resign は `cancelLocalComposition` を呼ぶ。しかし miniaturize / application hide / occlusion は `exposure` へ進み、そこに直接の取消はない。OS が先に resign 通知を出す可能性はあるが、実 UI の順序を今回確認していない。C12 は **明示取消を先に呼ぶ人工列**の合格であり、あらゆる隠れ方で preedit が失効すると主張できない。pause も進行中 composition の全経路を証明していない。この点は root へ返した追加確認事項で、固定 R4/R5 ソースは変更していない。

## ソースと公開記録の確認

R4 は snapshot 27、app 6、compiled Swift 10 の SHA を一致確認。R5 は snapshot 30、app 6、compiled Swift 10、元 R3 の read-only 4 の SHA を一致確認し、最後にも同じ値を検算した。BuildInfo のソース一覧は履歴ファイルを含むため、実コンパイル一覧と同一扱いしない。R5 は `OwnEditor-r2.swift`、`ReceiverBridge-r2.swift`、`AppMain-r3.swift` を使い、過去の OwnEditor / main / ReceiverBridge はコンパイル対象外。

R4/R5 同梱 shader は 23,850 B、SHA `75a1aa21d61860483bc999fd4cd9c5e027d6aef71edcf3872192024573e3bd82`。元 `desktop/glyph-metal-lab-v4/Sources/Glyphs.metal` と byte 一致を独立確認した。事前 METHOD は比較先を「old 3 形 R5 teacher」と書いたが、返却された shader の実比較先は v4 だったため、この source 比較範囲の差を残す。編集欄の 3 mapping と shader inventory は別の母数で、旧 3 形 R5 との byte 同一を確認したとは言わない。CPU builder も固定 source と app manifest の一致を確認した。今回 GPU を再実行していないので、作者の manual 12 / old 20 / instances 278 / CPU 2304 / offscreen 10 は作者による別検証として扱う。

両 app の `codesign --verify --deep --strict` は exit 0。これは固定 bundle の整合確認で、起動確認・配布者の認証・一般的安全性の認定ではない。公開用ログは件数・ID 数・色の件数・bytes・失敗ラベルだけで、人工本文や個人絶対パスを含めない。source のテスト fixture は人工文字だけ。実ユーザー本文は取得していない。保存 off の export は allowlist を検証し、body / 文書 / atlas は入れない。新経路でネット送信・OS 監視・clipboard の読み取り・OS 設定変更は行っていない。

実ウィンドウの見た目、通常表示時 CPU/RAM、16 GB PC、Windows、全アプリ入力、実 IME、長時間の快適さ、形の意味理解、60/16 形への汎化は未評価。今回の採用候補は専用編集欄から単一の身体へ接続する有限な native lab。通常利用の採否と公開は root が扱う。

## 再現

repository root から [replay.sh](replay.sh) を実行する。macOS の Xcode command line tools / AppKit / JavaScriptCore が必要。新しい出力先を要求し、既存原票を書き換えない。固定した own snapshot と固定 app の Receiver.js を使い、ウィンドウ・Metal・実 IME は起動しない。過去 producer 負例の exit 1 は期待どおりとして個別に記録する。

```sh
bash experiments/widget-metal-ambient-review-v1/replay.sh experiments/widget-metal-ambient-review-v1/replay-local-r1
```

初回原票、負例、修正後回帰、source pin、集計、公開 file manifest は別ファイルで残す。再実行結果は初回結果の代わりにしない。
