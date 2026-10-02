# 専用欄の入力 adapter 比較

専用 textarea の入力を、保存 off の人工統合 R3 へ正規化する独立 lab。採択候補は **R2 の module 境界**。本文・ID の唯一の所有者は既存 receiver の material であり、adapter と表示は新しい body / ID を作らない。既定60形、作品の黒い3D空間、隠れる入力端末は変更していない。

入口候補は [index-r2-neutral.html](index-r2-neutral.html)。素朴な入力欄・集計・有限な文字一覧だけを表示する。これは作品の描画を置き換える製品 UI ではない。[index-r2.html](index-r2.html) と初回 [index.html](index.html) は旧比較として保持する。

作者の確認範囲は fake textarea / 人工イベントの非UI試験。実ブラウザ DOM、実日本語 IME、OS 全体や他アプリからの入力取得を実施・達成したとはしない。実操作・公開・共有文書・Git は親担当の所有。別の実DOM記録と混ぜない。

| 評価 | R1 | R2 |
| --- | --- | --- |
| 作者の事前固定30ケース | 30/30 | 同じ期待値の既知回帰30/30 |
| 原 UTF16 diff 4プローブ | 4/4 | 同じ期待値の回帰4/4 |
| 独立17ケース | 15/17 | 既知修正回帰17/17 |
| 独立追加 destroy/retry | 0/1 | 既知修正回帰1/1 |
| 作者の追加 lifecycle 4ケース | 後付け負例0/4 | 実装前固定4/4 |

結果・失敗と分母の説明は [REPORT.md](REPORT.md)、初回独立原票は [別所有の REPORT-R1.md](../ambient-editor-adapter-review-v1/REPORT-R1.md)。R2 は新しい未見評価と呼ばない。

## 操作と境界

1. このページの専用欄だけへ入力する。初期本文は観測 baseline で、素材0。
2. 既知の局所イベント列から挿入を確認できたときだけ素材を追加する。変換中・確認不明の入力は preview / 観測だけ。
3. 色は各入力操作の開始時に固定。削除、undo、redo は文書を同期し、過去の素材・ID・色を保持する。

`isTrusted===true` は UA 配送の局所 guard。人工試験の true は手書き宣言であり、実IME / OS確定の証拠ではない。compositionend も単独では確定にしない。start 時の文書・選択範囲と、非空の最終 data による置換が実際の欄の値に一致する既知列だけを扱う。空の cancel、start 欠落、未対応順序、5000ms失効は0。Enter / 無入力時間から確定を推定しない。

制限は **文書512 UTF16、単発挿入256 UTF16、preview64 UTF16、body最大256 grapheme unit**。grapheme は追加イベントごとに receiver が作る。別イベントの `e` と結合文字を後から合体しない。NFC正規化やID再採番はしない。

temporary no-ACK は元の event を recursively frozen な1 slotだけ保持し、専用欄を一時 readOnly にする。再送は同じ event / 色 / 時刻で全体受理後に ACK。異なる値の割込みや pending 中の blur は slot を破棄し unsupported にする。文書観測は残せるが、普通の baseline / 新しい入力で append を自動復旧しない。上限による permanent whole-event hold は追加0で理由を表示する。未知の API や非協調入力を無損失とは呼ばない。

同じ textarea への二重 `createAdapter` は `textarea-already-owned` を throw。destroy 後もその element の予約を保持し、新しい body を生成しない。destroy は terminal。古い handle / retry / advance / control / shape callback は本文・clockを読まず無作用。新しい element または reload は別の接続であり、初期値を自動素材化しない。この予約は同じ module instance 内の対策であり、別 bundle を意図的に二重ロードする敵対的環境の認証機構ではない。

素材の追加は同期処理で、形の返答を待たない。球・箱・輪の限定字句 scheduler の既存比較を使う。一般意味モデル、自由文の命令精度、人間の快適性を評価したものではない。

## 保存 off

本文は専用欄・bounded producer / receiver・文字一覧に volatile に存在する。`exportState()` は本文、ID列、色順、文書、preedit、window、query、fingerprint を出さず、集計だけ。`snapshot()` も本文なし。本文のログ、Web Storage、IndexedDB、fetch、sendBeacon、clipboard API は使用しない。

`readBody()` は表示用の読み取り iterator、`inspectVolatile()` は人工試験用の一時検査であり、保存用APIではない。ページの `window.ambientEditorView` には本文・ID・文書検査を公開しない。destroy は過去の受理済み素材を読み取り可能な volatile state として保持するため、安全消去を保証しない。ブラウザ履歴復元 / BFcache / DevTools 等のブラウザ管理まで保存 off として認証したものではない。

## 再現

リポジトリ root から実行する。新しい出力名を使い、旧原票を上書きしない。

```sh
node experiments/ambient-editor-adapter-v1/verify.mjs
node experiments/ambient-editor-adapter-v1/run-r2.mjs replay-r2-original30-new
node experiments/ambient-editor-adapter-v1/run-lifecycle-r2.mjs replay-r2-lifecycle-new
```

R1 の感度確認は、新R2方針を既知の旧R1へ適用した後付け負例。4件失敗を期待し、終了コード1になる。

```sh
node experiments/ambient-editor-adapter-v1/run-lifecycle-r1-negative-control.mjs replay-r1-negative-new
```

実UI確認は親担当がローカル server の未使用 port を選んで行う。例えば repository root から次を起動し、`http://127.0.0.1:4293/experiments/ambient-editor-adapter-v1/index-r2-neutral.html` を開く。作者はこの server / UI を起動していない。

```sh
python3 -m http.server 4293 --bind 127.0.0.1
```

共有 widget へ cast せず、[API.md](API.md) の単一 authority から描画する。素材の出所は AI authored module / CSS / 人工fixture、依存は同repoの凍結 R3 と scheduler。外部画像・フォント・モデル・依存導入なし。
