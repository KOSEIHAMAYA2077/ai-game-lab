# Standalone StaticEmbedding CPU encoder

2026-10-03。既存の `NativeStaticR5.swift` を参照し、固定した日本語 Unigram tokenizer と 128 次元 F16 表を、依存のない JavaScript へ移した。既存 preview、scene、依存、モデルと閾値はこの担当で変更していない。評価 holdout の本文と予測は読まず、人工入力だけで実装一致と負荷を確かめた。

## 接続 API

```js
import { loadStaticEncoder } from './static-runtime/encoder.mjs';
import { loadDenseModel, predictDense } from './dense-inference.mjs';

// アプリ内で一度だけ作り、両モデルで共有する。
const encoder = await loadStaticEncoder({ signal });
const model = loadDenseModel(modelJSON);
const result = predictDense(model, encoder, text);
```

`loadStaticEncoder({ tokenizerUrl?, tableUrl?, signal? })` は default で `experiments/bonsai-task-student-v1/static-candidate/assets/` の 2 ファイルを取得し、固定したサイズと SHA256 を照合する。予測の HTTP 送信はない。URL を変更しても同じ固定内容の検証を要求する。読み込み失敗は例外になるので、呼び出し側で表示する。

`createStaticEncoder(tokenizerJSON, tableArrayBuffer)` は既に取得したデータから構築する同期 API。こちらはサイズ・schema を検査するが hash 検証を省くので、信頼した固定 asset に用いる。`StaticTokenizer`、`normalizeNmt`、`metaspace`、定数も export している。

`encoder.encode(text)` は `{ vector: Float32Array(128) | null, mean, hold, unknownFraction, tokens, tokenizeMs, encodeMs }` を返す。`tokens` は ids、pieces、normalization を含む。`tokenize(text)` と `inspect()` も使える。入力は 512 Unicode scalar までで、513 以上は `input_limit`、未対応 UTF-16 surrogate は `invalid_unicode`、ゼロ vector は `empty_vector` になる。自動 BOS/EOS、padding、truncation はしない。

## 一致確認

`export-parity.py` は既存環境の Python `tokenizers 0.22.1` / NumPy を用い、公開してよい人工 90 入力から oracle を作る。対象は日本語の幾何・用途・属性、ASCII、全角、合成文字、scalar ごとの lowercase、特殊 token、未知 token の融合、62 種の Nmt 制御文字、512 / 513 scalar 境界。別の正解ラベルや意味精度は測らない。

`check-parity.mjs` の結果は **90 / 90 一致**。ids、pieces、normalization、保留理由、unknownFraction は全件一致。平均 vector の最大絶対差は 0、L2 正規化後 vector は `5.960464477539063e-8`、許容差は `2e-6`。原票は `parity-oracle.json`、検査結果は `parity-js-report.json`。

```sh
.local/static-japanese-v1/venv/bin/python prototypes/glyph-creature/src/task-student-v1/static-runtime/export-parity.py
node prototypes/glyph-creature/src/task-student-v1/static-runtime/check-parity.mjs
node --expose-gc prototypes/glyph-creature/src/task-student-v1/static-runtime/benchmark.mjs
```

## 単一 Node プロセス測定

`benchmark-node-report.json` は encoder 1 個と凍結 dense head 2 個を同じ Node プロセスで読み込んだ記録。ローカル disk 読込、hash、JSON parse、trie / F16 lookup 構築と両 head decode の合計は **39.04 ms**。アプリ起動とブラウザ fetch / UI は含まない。読み込み後に各モデル 500 回 warmup、短い人工 10 入力を各 5,000 回計測した。

| 経路 | encode + head p50 | encode + head p95 | encoder p50 | encoder p95 |
| --- | ---: | ---: | ---: | ---: |
| static-seed | 0.0203 ms | 0.0273 ms | 0.0103 ms | 0.0164 ms |
| static-bonsai8 | 0.0197 ms | 0.0256 ms | 0.0098 ms | 0.0152 ms |

境界人工入力を各 200 回計測。512 scalar の ASCII、日本語、astral は入力境界を通り、513 は encoder と両 dense 経路で `input_limit`。512 日本語の encode + head p95 は seed 0.3241 ms、Bonsai8 0.3229 ms。これは入力上限の動作確認で、その文章に対する形の妥当性は評価していない。

| 保持する数値バッファ | bytes |
| --- | ---: |
| F16 table | 8,388,608 |
| packed trie + Float64 vocabulary scores | 2,007,694 |
| F16 to F32 lookup | 262,144 |
| encoder 合計 | 10,658,446 (10.16 MiB) |
| dense head F32 weights / モデル | 35,328 |

この表は typed buffer の正確な byte 数で、文字列・JS object・配列・一時領域・allocator・UI を含まない。一方 `process.resourceUsage().maxRSS` は **109,776 KiB = 107.20 MiB**、Node と測定コードを含むプロセス全体の peak。読込前 RSS 49.59 MiB、読込後 GC 99.09 MiB、測定後 GC 107.20 MiB。全 widget / ブラウザの RAM の達成値とは扱わない。測定端末・Node / Unicode / ICU version は JSON 原票に保存した。

## 範囲と残る制限

元の 1,024 次元表の先頭 128 次元を F16 へ変換した固定表で、full model の再現や一般文の意味精度を主張しない。未知 token を連続箇所で融合する処理を維持したため `unknownFraction` は token 数の比率であり、未知文字の比率ではない。NFKC と lowercase は host JavaScript の Unicode 実装を使うので、別の Unicode version 全体の一致は今回の 90 fixture では保証しない。過去の native 比較で見つかった Unicode 入力差を、評価 holdout に合わせて調整していない。

本担当では browser UI / 日本語 IME / whole-widget memory を再測定していない。root が preview 接続と実 browser 確認を担当する。asset 出所・固定 revision・MIT 指定・128 次元 / F16 への変換は asset `NOTICE.md`、tokenizer algorithm の帰属はこの directory の `NOTICE.md` に記録した。追加 download はしていない。
