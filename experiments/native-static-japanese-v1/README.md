# 日本語 StaticEmbedding の native CPU 移植候補

取得済みの 128 次元 Float16 表を、Python なしの Swift CLI で tokenization → mean pooling → cosine ranking まで実行した。最終候補 R5 は元 455 件と人工境界 254 件、計 709 件の既知回帰で token ID・piece・正規化・順位が一致し、数値誤差は事前の 1e-5 以下だった。未知語理解や新しい意味精度を達成した評価ではなく、アプリ既定や文字の身体には接続していない。

最終実行体は [native-static-r5](native-static-r5)、source は [NativeStaticR5.swift](NativeStaticR5.swift)。macOS SDK の Foundation/CryptoKit/Darwin を使う CPU CLI で、PyTorch・Python・Rust library は native 実行時に使わない。元モデルと tokenizer は既存のローカル取得物を読み取り、再取得・再学習しない。

| 確認項目 | 結果と範囲 |
|---|---|
| Tokenizer | tokenizers 0.22.1 の公式固定 Rust source を参照した Unigram Viterbi。greedy 近似ではない |
| ID/piece/正規化/前処理 | 同じ 709 件で exact。R3 の 1 件不一致を残し、R4/R5 は既知修正回帰 |
| mean / unit / cosine 最大絶対誤差 | 8.472e-7 / 9.316e-8 / 8.596e-7、いずれも固定 gate 1e-5 以下 |
| raw ranking | 60 authored shape と primitive 6 を別 registry で比較。top1、全順位、caption 選択の差 0 |
| 通常の人工文 112×10 | encode→60shape rank の内側 p50 0.0356ms / p95 0.0438ms。JSONL 往復 p95 0.1740ms |
| 起動→最初の JSONL 応答 | 44.47ms。この host の 1 回観測、SHA 検査と index 初期化を含む |
| Lean CLI peak | 45,645,824B＝43.53MiB。1382 call の短い batch、親 driver の RAM を含まない |
| Model table | 8,388,608B＝8MiB の read-only mmap。全 process RAM や常駐 page 量とは異なる |

この Mac は Apple M5 / 32GiB / macOS 26.5.1。Windows 16GB、全 widget RAM、電力、8 時間常駐、独立未見 tokenizer ケース、すべての Unicode、offset の互換性は未確認。元 static fresh140 の意味品質は以前の固定版の成績であり、今回の native 計測で更新しない。

- [結果・失敗履歴・限界](REPORT.md)
- [再現方法と JSONL 契約](REPRO.md)
- [一次 source と license の対応](PROVENANCE.md)
- [初回期待値 freeze](EXPECTED-FREEZE-R1.json) / [最終 parity](PARITY-R5.json)
- [Lean 計測 method](METHOD-LEAN-CPU-R5.md) / [Lean 原票](LEAN-CPU-R5.json) / [最終 build](BUILD-R5.json)

R1 compile 失敗、R2 schema 拒否、R3 正規化不一致、R4 対話計測 blocked の原票は保存した。最終候補を独立 tokenizer/runtime 監査へ渡せる状態とするが、default 採用や意味品質改善を結論にしない。
