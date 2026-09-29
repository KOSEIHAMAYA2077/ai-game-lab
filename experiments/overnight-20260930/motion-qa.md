# motion / 団子 統合の独立QA

対象の事前確認: `a9498f1`、2026-09-30。rootが `SceneSpec.motion?`（省略時calm）と `dango` を統合する前の読み取りレビュー。共有ソースは変更していない。以下は検証計画であり、motionの実装後に成功したという報告ではない。

## 今回守りたいこと

- v0.5以前のmotionのない日記はそのまま開ける。既知shapeの挙動もcalmとして従来と一致する。
- 入力から選んだ動きは形とは別に残り、色だけの文章・次の形・モデルの形推定でも失われない。
- 入力→保存→復元→別窓に、shapeとmotionの組をそのまま渡せる。
- 不明なmotionを保存や外部からの復元へ通さず、失敗時に現在の形を壊さない。
- 新しい団子は明示語彙の追加。凍結モデルの学習成果に数えない。

## ソース上の接続点

| 場所 | 現状 | 追加時の確認 |
| --- | --- | --- |
| `src/language.ts` の `SceneSpec` | motionなし | 既存日記との互換のためoptional。許可値の一覧をvalidationとも共用する |
| `interpret()` | specをフィールド列挙で新規構築 | motion未指定では`current.motion`を保つ。動きだけの命令も`recognized: true`にする |
| `main.ts` の `addText()` | recognizedならparsed.spec、そうでなければ現在specを採用 | motion単独命令のrecognized忘れはここで無効化される |
| `scene.setForm()` / mainの形ボタン | 現在specをspreadし、shape/count等だけ上書き | 形切替でmotionを意図せずcalmへ戻さない。既存構造なら保持される |
| `Matter.reset()` / 日付替わり | DEFAULT_SPECでreset | 最初へ/新しい日ではcalmへ戻る。未指定維持とresetを混同しない |
| `captureDay()` / `restoreDay()` | spec全体をspread | motionの保存・復元は自然に通る。Day version:1を維持できる |
| `validDay()` | 固定shape/mode/count等を検証。未知のextra fieldは無視 | motion省略または許可値だけ通す。null/数値/オブジェクト/未知語は拒否 |
| `readDays()` / `recoverDays()` | 不正を含む履歴は一旦拒否、明示復旧で正常日のみ救出 | 不正motionのある日も同じ方針。motionのない旧日は救出対象に残す |
| `companion.ts` のpublish/ready/restore | Dayをそのまま送信し、受信でvalidDayを確認 | 保存だけでなく新しい別窓への初回送信もmotion保持。未知motionは描画へ渡さない |
| `learned-shape.ts` | モデル外はfireworksのみ救済 | dangoの明示語彙をモデルonでも通す。モデルのラベル・重み・成績は変更しない |

## 必要なロジック確認

既存 `src/diary.test.ts` の「文字・色・日時・乱数を保って再生」に、現行版で取り得るmotionを1件加えるだけでは旧日記互換の確認が消える。次の二つは分ける。

1. **旧日記:** `spec`にmotionプロパティを持たないfixtureを保存・read・restoreする。`validDay=true`、文字/batches/seed/time/旧spec保持。新たなcalmプロパティを足す実装なら、状態の等価比較は`motion ?? 'calm'`を使う。描画位置は省略calmと明示calmが一致する。
2. **新日記:** breathe/wave等の実際の許可値ごとにspecへ入れ、capture/write/read/restoreの後に同じ値がある。dangoもshapeとして保存・復元できる。
3. **不正値:** 未知の文字列、`null`、`42`、`{}`を入れた日記はvalidDay=false。`restoreDay`が例外になっても現在Matter.inspectが変わらない。
4. **未指定維持:** breatheの現在specへ「赤」「表面 立方体」「流れる 球体」「何気ない文章」を順に解釈しmotion保持。modeのflow/surface変更とmotionは独立する。explicit calm命令だけがcalmへ戻す。
5. **モデル経路:** 学習モードonで「サイコロを黄色に」によるshape補完でもmotion保持。「だんご」の明示反応は学習によるshape選択と表示しない。
6. **表示名:** describeがmotionを説明できる。ただし省略calmの旧入力説明が不要に冗長にならない。

## ブラウザ検証案

使うのは専用Chrome一時プロファイルとlocalhostの試作だけ。実IAB、本人の原稿、個人のブラウザ領域は使わない。下のmotion語と内部ラベルは統合後の語彙を読んで確定する。

### A. 普通のターミナル → 日記 → 執筆 → 別窓

1. `/`を開きEnter。例「波打つ 表面 青い立方体」を通常ターミナルから送る。
2. inspectでshape=cube、motion=wave、ink=blue、batches全文を確認。
3. 日記→「いまの形を残す」で保存。localStorageのspecも同値。
4. 同じテストcontextの`/?write`へ移る。今日の日記が復元され、motion/shape/count/全文が同値。
5. `/?companion`を新しいpageで開く。`ready`応答後に同じshape/motion/count。
6. 執筆から色だけの文章を送る。shape/motionを保持し、新しい文字だけ色変更。
7. 書く側をreload。motion/shape/batchesを維持し、未送信行を自動追加しない。

注意: `/`の単なるreloadは元から日記を自動復元しない仕様。旧仕様と新たなmotionの不具合を混同せず、`?write`または日記を明示選択して復元する。

### B. 形・動きの独立

1. `?write`で動きだけを入力し、recognized経路でmotionが切り替わる。
2. 次に形ボタンから団子、HELP内のメビウスへ変更。motionが保持される。
3. 「表面」「流れる」を順番に送ってmodeだけ変わり、motion保持。
4. explicit calm語でmotion=calm。その後同じ形を普通に切り替えてもcalm。
5. 「最初へ」で新しい@、DEFAULT_SPEC相当へ。原稿は残る。

### C. 旧日記と不正motion

1. 一時contextへ、motionなしの小さな旧日記fixtureを直接入れる。`?write`起動で保存エラーなく復元。
2. 新しくmotion命令を送ってから保存・reloadできる。
3. 別のテストcontextへ未知motionを含む日記fixtureを入れる。新しい@を保ち、日記読み込み失敗を説明。原本を無言で削除しない。
4. healthy writer/viewerを開き、不正motionを持つ形メッセージをテスト用BroadcastChannelから送る。viewerの現在shape/motion/countが変わらない。

直接fixtureやmessageを注入するのは境界検証のみ。通常入力からの体験をA/Bで別途確認し、この注入を実入力の成功とは数えない。

### D. 見た目の最小確認

A/Bの状態保持が成功しても、motionが実際に見える保証にはならない。同じseed、同じ文字、同じ時刻でcalmと各motionの画面を撮る。時間を進めて位置の有限性、文字が画面外へ永久に消えないこと、表面に沿う向きが極端にずれないことを確認する。位置と接線の数学的な確認はrootの専用ロジックテストへ任せ、こちらの保存QAで二重実装しない。

## 実装後の結果

rootの統合後、独立した `tests/motion-diary.spec.ts` を追加して実行し、**5件すべて成功**した。既存IAB/ユーザー原稿へは触れていない。出力先は `test-results/motion-diary-independent` とし、並行担当のテスト出力を消さないよう分離した。

1. 通常アートで「表面 呼吸する 黄色い立方体」を入力→明示保存→writerで復元→viewerを後から開く→色だけの文章を追加→writer再読込。cube/breathe/surfaceと全文batchを維持。
2. motion単独「波打つ」→団子の形ボタン→メビウスのHELPボタン→「流れる 球体」→学習モードonで「サイコロを黄色に」→「だんご」。各段階でwaveを保持し、明示「変形なし」でcalmへ戻る。保存と別窓も同値。
3. motionプロパティを持たない旧日記（文字・色・追加seedあり）を起動時に復元。calmへ正規化し、旧batchを保持。その後「呼吸するだんご」を追加して保存/再読込できる。
4. viewerへ不明文字列/null/数値/objectのmotionを持つmessageを注入。現在のshape/motion/countを変更しない。
5. 不正motion入りの日記を初期保存へ注入。現在の@を保ち、エラーと退避復旧の入口を表示し、原本を消さない。

初回の1ケースだけ、回転し続ける`press enter`ボタンをPlaywrightの通常clickで安定待ちしたためタイムアウトした。これはテストの開始操作をEnterキーへ修正して解消。残り4件は初回から成功。sourceの追加修正は行っていない。

結論: 今回担当した保存/復元/互換/別窓/未指定維持の範囲では新しい問題を見つけなかった。文字の表面方向と動きの見た目はroot側の画面・幾何検証に委ねており、この5件だけで表現の美しさや実OSのIMEを保証しない。

### 全体実行で見つかったテストの待機不足

後続の全体ブラウザ実行で、最初の保存直後のlocalStorage参照が`null`になった。traceではクリック後ただちに読み出しており、失敗時のページsnapshotにはすでに769文字の日記と保存成功の表示があった。通常アートの保存はWeb Locks取得をawaitするが、Playwrightのclick完了は非同期event handler全体の完了を保証しないため、アプリのデータ消失ではなくテストの待機不足と判定した。

`motion-diary.spec.ts`だけを修正し、保存成功の表示と、nullを扱える`expect.poll`で保存spec一致を待つようにした。単に再試行で通すのではなく、このケースではWeb Locksの取得をテスト内で意図的に150ms遅延させ、必ずクリックと保存完了の間隔がある状態で確認した。修正後5件すべて成功。sourceの変更なし。
