# Native CPU 日本語 embedding 結果 R5

2026-10-03。所有範囲はこの実験 folder だけ。既存 static 実験と model は読み取り、UI/GPU/OS 入力・クリップボード・権限・Git・共有 app/source/doc は変更していない。実行対象は人工文だけの独立 CLI。新しい model、重い runtime、訓練、品質 fixture は追加しない。

## 固定した方法と期待値

初回 native 結果前に [METHOD-R1](METHOD-R1.md)、[EXPECTED-R1](EXPECTED-R1.json)、[EXPECTED-FREEZE-R1](EXPECTED-FREEZE-R1.json) を固定した。oracle は取得済み venv の tokenizers 0.22.1 / NumPy 2.0.2。元 calibration 112 と caption 343 の 455 件、追加の Unicode/control/special/length 境界 254 件を合計 709 件とする。新しい意味品質や独立未見の評価ではない。

ID/piece/normalization/pretoken exact、mean/unit/cosine 絶対誤差 1e-5、top1 exact、score 差が 2e-5 より大きい pair の逆転禁止を結果後に変更しない。caption と weight、候補の label 母数も変えない。shape 60 と primitive 6 は別 registry で、label の最大 caption cosine を使う。

初回 source の作成前、事前 fixture の 4000 個の「㍿」が NFKC で 48000 UTF8 byte になるため、native 内部の正規化 byte 上限を 32768 から 262144 にする [補足](PRE-RUN-ADDENDUM-R1.md) を作った。元の 4000 scalar / 4000 token、crop なし、数値 gate は維持した。最初の R1 は compile で止まり、初回成功 build 前の [SOURCE-PRE-RUN-R2](SOURCE-PRE-RUN-R2.json) に R1 source/失敗 log/R2 source/補足を固定している。METHOD に予定名 SOURCE-R1.json とあるが、実際の保存名はこの R2 record である。

METHOD の special66 という表現は新規 ID 数を参照した初期記述だった。実 JSON の added_tokens は **71 record**、そのうち **5 record は base vocab ID を再利用、66 が追加 ID**。全 71 record の literal/context を期待値に含めた。固定 METHOD は書き換えず、この記述と [schema 修正記録](TOKENIZER-SCHEMA-CORRECTION-R3.json) で区別する。

## 失敗原票と修正の境界

| 版 | 初回観測 | 変更と扱い |
|---|---|---|
| R1 | `.8` literal の compile 失敗。runtime 結果なし | [source](NativeStaticR1.swift) と BUILD-R1.log を保存 |
| R2 | compile 成功、added record を 66 と誤認した schema guard で起動拒否。709 出力なし | [source](NativeStaticR2.swift)、[build](BUILD-R2.json)、RUNTIME-R2-FAILURE.log を保存 |
| R3 | 旧 455 は全 ID exact、edge 253/254。半角濁点・半濁点の 1 文だけ正規化/ID 不一致、全体 gate 不合格 | [原票](NATIVE-R3.json) / [不合格判定](PARITY-R3.json) を保存 |
| R4 | explicit NFC 合成を正規化経路へ加え、同 709 全 gate 合格 | [修正理由](NORMALIZATION-CORRECTION-R4.json)。既知回帰であり fresh ではない |
| R4 lean | 非 TTY JSONL の最初の応答待ちで blocked。CPU 0%、resident 約 40MiB を観測して own process だけ終了 | [blocked 記録](LEAN-R4-BLOCKED.json)。正常に完走した latency 原票ではない |
| R5 | 回答ごとの flush と query autoreleasepool 後、同 709 回帰と lean1382 call が完走 | [source](NativeStaticR5.swift) / [parity](PARITY-R5.json) / [lean](LEAN-CPU-R5.json) |

R3 正規化経路で半角濁点の合成が一致しなかった。Foundation API 一般の不具合とは断定しない。scalar/character と String の mapping、全 String 合成の順序依存もあり得る。R4 は compatibility mapping の直後に canonical composition を明示した修正である。

R3 の一致 **708 件だけ**では mean/unit/cosine 最大誤差が 8.472e-7 / 9.316e-8 / 8.596e-7 だった。しかし不一致 1 件を含む全 709 は mean 6.919 / unit 0.2675 / cosine 0.2813 と gate を外れ、shape/primitive の top1 がそれぞれ 1 件違った。708 件の小誤差を R3 全体合格に混ぜない。R4/R5 は同じ既知入力に対する修正回帰で、後から人工境界や品質例へ調整していない。

R4 blocked は stdout buffering を疑った。R5 で明示 flush 後に応答したことは確認したが、flush と autoreleasepool を同時に入れたため単一要因の因果試験ではない。autoreleasepool は一時 object の寿命管理であり、測定された leak を直したという主張はしない。R5 driver は各応答 15 秒・全 batch 300 秒の deadline を持つ。

## R5 の既知回帰

| 比較 | 旧 455 / 追加 254 | 最大誤差・差分 |
|---|---|---|
| ID / piece / 正規化 / whole pretoken / hold | 455/455、254/254 | exact、各不一致 0 |
| Float32 mean | 全比較対象で gate 合格 | 最大絶対誤差 8.471679677768407e-7 |
| L2 unit vector | 全比較対象で gate 合格 | 最大絶対誤差 9.315536497744858e-8 |
| Caption cosine | 全比較対象で gate 合格 | 最大絶対誤差 8.596046447983952e-7 |
| raw top1 | shape と primitive 別 | 差 0。保留時は両方の空 rank の一致も含む |
| 全順位 / 最良 caption 選択 | registry 別、同じ caption index | 差 0 / 0 |
| pair reversal | 2e-5 以下 / 超過 | 0 / 0 |

mean は同じ 128F16 table を Float32 へ変換し、64 token の block を逐次加算して token 数で割る。NumPy reduction と加算順が異なるため bitwise equal を gate にせず、上の絶対誤差を使う。Unigram の cumulative score は Float64、全部の prefix を比較する。形を新しく生成したり、語順・否定を理解するモデルにはならない。

## CPU とメモリの母数

[HOST-R5](HOST-R5.json): Apple M5、32GiB、macOS 26.5.1、Swift 6.3.2、optimized `swiftc -O`、arm64。CPU 競合を統制した独立性能試験ではなく、この host の短い 1 batch の観測。

通常人工文 112 件×10＝1120 timed call、別途 200 warm、cold1、4000 scalar 3 種×20、4001 拒否1、合計 1382 call。旧 target は driver で採点しない。query の `elapsedMs` は single-pass encode→60shape rawrank の内側で、JSON decode/encode、pipe I/O、メモリ観測、起動は含めない。JSONL 往復は別値。

| 時間 | p50 | p95 | p99 | 最大 |
|---|---:|---:|---:|---:|
| 通常の encode→rank、1120 call | 0.0356ms | 0.0438ms | 0.0553ms | 0.1300ms |
| JSONL driver 往復、同 1120 call | 0.1491ms | 0.1740ms | 0.2478ms | 0.4476ms |
| 日本語反復 4000 scalar、20 call | 0.9083ms | 1.0276ms | 1.0276ms | 1.0601ms |
| ASCII 反復 4000 scalar、20 call | 0.5115ms | 0.6185ms | 0.6185ms | 0.6457ms |
| emoji 反復 4000 scalar＝8000 UTF16、20 call | 1.0266ms | 1.1516ms | 1.1516ms | 1.1518ms |

cold 起動→first response は 44.465ms、first query 内側 0.0579ms。別 parity process の SHA validation 込み tokenizer/table 初期化 36.138ms、343 caption index 構築 2.409ms。別 process の値を引き算して起動内訳とはしない。parity harness の `totalMs` は tokenizer を計測用に別途繰り返すので production single-pass latency に使わない。3 種の反復は全入力の最大時間の保証ではない。

| メモリ対象 | 値 | 解釈 |
|---|---:|---|
| F16 table file / virtual mmap | 8,388,608B＝8MiB | model component。全 page が常駐するとの測定ではない |
| tokenizer JSON file | 2,127,941B | file size。JSON object と 102711 node の trie には別の RAM が要る |
| 343 caption×128F32 payload | 175,616B | vector payload だけ。Swift 配列/label 等の overhead を含まない |
| Lean first response resident / physical footprint | 43,008,000B / 33,620,472B | process 全体の task_info snapshot |
| Lean 1120 timed 後 resident / physical footprint | 44,171,264B / 34,243,064B | normal batch 後の snapshot |
| Lean 4000 scalar 3 種後 resident / physical footprint | 45,645,824B / 35,684,856B | synthetic long-query 後の snapshot |
| Lean time-l 終了 max resident | 45,645,824B＝43.53MiB | native 子 process の高水位。driver Python は含まない |
| R4 全 709 parity harness peak | 102,367,232B | 7MB oracle と全 output/JSON serialization を含む別 process |
| R5 全 709 parity harness peak | 102,318,080B | 同じ検証 workload。lean や widget の RAM ではない |

短い batch での footprint 変化だけで leak の有無、長期安定性、電力、16GB Windows、全 widget メモリ削減を主張しない。8MiB の file と 43.53MiB の CLI RAM を同じ数として扱わない。

## 採否と未確認

**独立 native tokenizer/runtime の候補として保管、アプリ既定採用なし。** 再訓練、品質改善、新しい任意 text-to-mesh、未知語理解を示した結果ではない。以前の [static 日本語比較](../static-japanese-retrieval-v1/README.md) と fresh140 の意味品質は過去の同 caption/threshold に対する別評価であり、native parity や速度で新しい品質にはならない。

- 709 は作者が事前に選んだ旧文・人工境界。R3 の失敗を知った修正後は全 709 が既知回帰。独立 tokenizer ケースの追加監査は別担当・別 artifact で実施する予定で、本版 source を変更しない。
- Foundation/Swift と Rust の Unicode data 全体、offset/alignment、pair encoding、decoder、動的 added vocabulary、automatic BOS/EOS を含む一般 tokenizer API との完全互換は未確認。固定 single-input、add_special_tokens=false、固定 tokenizer JSON の ID/piece 範囲である。
- 入力 decoded text は 4000 Unicode scalar、token4000、正規化262144 UTF8 byte を上限として crop せず hold。JSONL `readLine` 自体の外側 byte bound は未実装なので、未信頼 producer をつなぐ前に framing 制限が必要。
- Fused UNK のため未知 emoji 4000 scalar も ID は 2 個、unknownFraction は 0.5 になり vector が出る。元 encoder policy を保った parity で、unknown 検出の十分性を証明しない。
- raw cosine rank は意味 confidence/意図/否定 guard ではない。ambient 文章をすべて命令にしない。adapter/scheduler/body/native16/UI へ接続しない。
- CLI の出力には piece/normalization が含まれる。人工入力だけを使い、private saving-off の実装にはしていない。将来の本文 retention は別設計。
- Windows 実装/配布、全ウィジェットの比較、8h常駐、CPU機種差、消費電力、実ユーザー快適性は未確認。

model と tokenizer の旧 read-only 参照 SHA、各 R source/build/JSON、公式 source、private path と local link の確認は FINAL-QA と RETURN-MANIFEST に残す。旧失敗を消去・上書きせず、共有 app や既定 resolver は不変。
