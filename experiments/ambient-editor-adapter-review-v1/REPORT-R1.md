# 専用編集欄 adapter 初回候補の独立検算

2026-10-03 JST。作者の結果・ケースを読まず、まず17個の抽象期待値を固定し、APIを対応づけ、候補と依存の同一バイト snapshot を保存した。実行 probe はソース読後・結果を見る前に固定した。これは人工 textarea-like object と人工イベントによる module の検算であり、ブラウザ実DOM、実際の日本語IME、全アプリ入力取得の検証ではない。

初回候補は **15/17**。失敗2件を修正せず [results-r1.json](results-r1.json) に保持した。初回候補 `adapter.mjs` SHA-256 は `32485a02209b85158e536afecc03edf0b7be79f03908e28453ff386c1994066a`。受信側は統合 R3 `d72e7931fb601104f70929d7ce0ceb60756b968fc540a59698f2c08dc1e9cb6d`。依存の hash / bytes は [SOURCE-FREEZE-R1.json](SOURCE-FREEZE-R1.json)。

| Probe | 初回 | 境界 |
| --- | --- | --- |
| P01 | 一致 | 初期 baseline を材料にしない。別 target は本文 getter を読まない |
| P02 | 一致 | 選択置換の挿入だけ追加。同値 echo は重複せず、本当に新しい同じ文字は別 ID / 指定色 |
| P03 | 一致 | preedit / Enter は材料・形の根拠にならず、空の compositionend と待機では確定しない |
| P04 / P05 | 一致 | 明示した既知 IME 順序だけ最終文字を一度追加。start なし・非trusted end は0 |
| P06 | 一致 | 5000msで失効した ended token は後の final input で復活しない |
| P07 | 一致 | 型・flag・trust・beforeinputの不足や未知の型は待っても材料化しない |
| P08 | 一致 | nullable paste は自作欄の差分だけ追加し、DataTransfer / getTargetRanges を読まない |
| P09 | 一致 | undo / redo / delete は文書を更新し、材料本文・ID・色を増やさない |
| P10 | 一致 | no-ACK では1個の immutable payloadを保持。DOMを無通知で改変しても retry は元のX・色・IDを全体追加 |
| P11 | 一致 | 再送待ち中の異なる値の新イベントは unsupported。自動復帰しない |
| P12 | **不一致** | blur 時、no-ACK slot が残る。事前 A13 の古い pending を跨がない境界と不一致 |
| P13 | 一致 | keydown は文字を読まず活動数のみ。capture/policyの公開APIは未提供 |
| P14 | 一致 | off export は10個の限定キーだけで、本文・doc・preedit・ID列を出さない |
| P15 | **不一致** | 同じ element に2回 createAdapter すると、各種 listener と receiver が2個できる |
| P16 | 一致 | grapheme、surrogateの範囲、256イベント / 512文書上限、literal文字列、ID連番 |
| P17 | 一致 | body容量の超過は全体を0追加。旧材料のID・色を保持 |

P12は「確認されたコミットを、欄から離れたあとも配達する」という別の方針なら意図として説明し得る。しかし、独立事前条件では blur の pending を無効にする仕様であり、実行後に期待値を書き換えて一致にはしない。作者と root へ旧版保持・新候補での明示方針を依頼した。

P15は所有権の問題。自動 listener がないと聞いた段階ではページの attach 管理を未確認としたが、受領APIが自動 attach / destroy を実装していたため、その API 境界を実行前に対応づけた。同じ要素の二重構築を拒否するか、同じ authority を返す設計が候補になる。独立評価から共有 source は変更していない。

初回結果を読んだ後に、`destroy()` の補足 lifecycle を別に調べた。`handle` は破棄後に止まるが、元 payload は残り、古い readiness / retry callback は止まらない。実行前に [LIFECYCLE-FREEZE-R1.json](LIFECYCLE-FREEZE-R1.json) と独立コードを固定した追加1件は **0/1**。no-ACK のX → destroy → readiness → retry の人工列で、破棄された旧 body に1文字が追加された。[追加原票](lifecycle-results-r1.json)。初回17項目の結果とは別に保持する。これはソース・結果閲覧後に設計した既知問題の補足回帰で、新しい盲検評価ではない。

`isTrusted=true` は、この fake object の人工 producer 宣言に過ぎない。実ブラウザのイベント由来を認証する試験ではない。IME active / ended token を5000msで破棄する保守的設計は、長い変換や未対応イベント列の取りこぼしを許容する。この試験が無誤取得や快適な日本語入力を証明するわけではない。

本文の唯一の allocator は受信側。adapter は字形 body を作り直さず、その受信 body の iterator を返す。制限値512は UTF-16文書長、256は1回の挿入 UTF-16 長、body容量は最大256 grapheme unit であり、単位を混同しない。専用 textarea の実DOM自体の全文を512文字に切り詰める試験ではない。

再現はリポジトリのルートで次を実行する。結果出力は既存ファイルを上書きしないので、別名を指定する。

```sh
node experiments/ambient-editor-adapter-review-v1/probes-r1.mjs \
  experiments/ambient-editor-adapter-review-v1/snapshots/r1/experiments/ambient-editor-adapter-v1/adapter.mjs \
  experiments/ambient-editor-adapter-review-v1/replay-r1-new.json
node experiments/ambient-editor-adapter-review-v1/lifecycle-probe-r1.mjs \
  experiments/ambient-editor-adapter-review-v1/snapshots/r1/experiments/ambient-editor-adapter-v1/adapter.mjs \
  experiments/ambient-editor-adapter-review-v1/lifecycle-replay-r1-new.json
```

実DOMのイベント配送・listener lifecycle、実IME、ページ全体の保存、表示の快適性、CPU / RAM / 電力は別の root 評価が必要。OS全体監視・クリップボード・ネットワークモデル・個人本文の取得は行っていない。
