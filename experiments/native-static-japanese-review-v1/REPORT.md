# 小型日本語 StaticEmbedding の native 配備独立レビュー

2026-10-03。固定候補は `NativeStaticR5.swift` / `native-static-r5`。対象は既存の tokenizer・F16 埋め込み表・手書き caption index を Python/Rust runtime なしの macOS Swift CLI へ移す処理。**手書き追加 20 入力で 20/20 の配備 parity**、実際の added-special 補助 4 入力も別母数で 4/4。これは形の意味精度、未知言語理解、3D モデル生成、人間による評価ではない。

## 実行前に固定したもの

[METHOD-R1](METHOD-R1.json) と [CASES-R1](CASES-R1.json) は candidate source / 作者の 709 fixture を読まず、native / oracle query 0 の段階で固定した。空文字、空白、Nmt control、半角濁点、結合文字、Unicode casing、互換文字、emoji、special 風の文字列、改行、プログラム風文章、稀な文字、512 / 513 / 1024 UTF-16 を含む 20 件。shape registry 12、primitive registry 8。人体や未知形への意味ラベルは付けていない。

元 tokenizer artifact を後から読むと、実 special は `<s>` / `<mask>` / `[unusedN]` 等であり、手書き 20 の `[CLS]` 等は special 風の通常文字だった。20 は差し替えず、artifact 読取後・native 初回前に [補助4](CASES-SPECIALS-R1.json) を別固定した。この 4 件は source-informed で、source 未読 20 と合算しない。

旧 `tokenizers 0.22.1` / `NumPy 2.0.2` と、取得済み・固定 SHA の 8 MiB / 32,768 × 128 / little-endian F16 表を read-only mmap する独立 oracle を用いた。BOS/EOS 追加なし、64 token block の Float32 加算 → token 数の平均 → L2 正規化。元 reference の unknown token fraction > .8、norm ≤ 1e-12、input/token 4000 上限を使い、精度の閾値を選び直していない。

初稿 oracle は captionIndex を registry 内 local と仮定した。作者 API の **全343 caption の global index** という説明を受け、native call 0 のうちに `oracle_r2.py` / `ORACLE-R2.json` へ修正した。元 r1 の結果と [訂正記録](ORACLE-SCHEMA-CORRECTION-R1.json) を保存した。入力、tokenization、pooling、gate は変えず、caption index の列挙と事前 tie 監査用の caption score 保存だけを直した。

candidate source / binary / model / tokenizer / caption の pin と active oracle 結果を固定した後、比較 driver と schema mapper を [RUNNER-FREEZE](RUNNER-FREEZE-R1.json) に固定した。candidate は一つの持続する非 TTY JSONL process で、手書き20、その後の補助4へ一回ずつ応答した。24 request / 24 reply、process exit 0、timeout 0、stderr / 余分な stdout 0。native 追加 call は行っていない。

## 固定 gate と結果

token ID / normalization / hold は完全一致、mean 最大絶対差 1e-6、unit vector / cosine 最大絶対差 1e-5。caption score 差 2e-5 以内だけは事前に tie とし、label 順・caption choice の入替えを許容する。それ以外の順序差は失敗とする。token pieces / whole-normalized Metaspace pieces は exact 診断として別に数えた。

| 母数 | whole-case gate | ID / piece / normalization / pretoken / hold exact | mean 最大差 | unit 最大差 | cosine 最大差 |
|---|---:|---:|---:|---:|---:|
| 手書き追加20 | 20/20 | 各20/20 | 2.3795e-7 | 6.3514e-8 | 2.0252e-7 |
| artifact-informed special4 | 4/4 | 各4/4 | 1.2500e-7 | 3.3396e-8 | 3.1615e-7 |

原票は [NATIVE-FIRST](NATIVE-FIRST-R1.json)、比較は [PARITY-FIRST](PARITY-FIRST-R1.json)、集計は [SUMMARY](SUMMARY-R1.json)。モデル、input、caption、gate、重み、閾値の変更は 0。

初回比較を終えてから作者の 709 fixture との重複を読んだ。[OVERLAP](OVERLAP-KNOWN709-R1.json) では手書き20の exact / NFKC exact がともに 1 件（空文字）、補助4はともに 0。残る 19 件が全文として異なっていても、既知の濁点修正や同じ Unicode / special 機能を使う。独立未見語の一般化を証明したとは呼ばない。

## 作者の既知709との区別

709 は旧 calibration 112、旧 caption 343、人工 Unicode 23、Nmt whitespace 62、added-special 142、mask lstrip 16、special boundary 6、limit 5 の保存済み回帰。これを今回の native process で再実行していない。保存 EXPECTED / NATIVE R5 の独立算術だけを行い、709/709、mean 最大差 8.4717e-7、unit 9.3155e-8、cosine 8.5960e-7 を再確認した。旧 gate 1e-5 / top1 exact と、今回の mean 1e-6 gate は混ぜない。[既知原票の算術](KNOWN709-AUDIT-R2.json)。

この算術 helper 初稿は input-limit ケースで省略された optional `normalization` を必須 key と読んで KeyError になった。初稿ソースと [failure](KNOWN709-HELPER-FAILURE-R1.json) を保存し、別 r2 helper で missing → None の mapper のみ直した。native call 0、製品 / EXPECTED / gate 変更 0。20 の初回結果には影響しない。

作者側の R1 compile、R2 schema、R3 半角濁点の 1 失敗、R4 非 TTY 応答の停止と R5 の同709回帰は過去版として保持されている。初期失敗を独立20へ足さず、R5 の成功を修正前から達成していた値へ戻さない。

## 技術を確認した範囲

Swift は literal / normalized=false special を先に抽出し、mask の raw whitespace lstrip を扱う。普通の部分は Nmt → Foundation の compatibility / canonical composition → scalar ごとの lowercase → Metaspace always prefix / split → UTF-8 trie の Unigram Viterbi。Float64 score、strict greater、min score−10 の UNK fallback、連続 UNK fusion は固定 [公式 tokenizers v0.22.1](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/unigram/model.rs) を読む範囲で対応している。greedy 置換ではない。offset / alignment、全 Unicode version、動的 vocabulary / pair / template の一般互換は未確認。

モデルは新たに学習していない。取得済み 1024 F32 表の先頭128次元を F16 へした表を再利用し、8,388,608 B の SHA / size / tokenizer schema を起動時に確認する。表を readonly / private mmap し、必要行だけ F16 → Float32 で加算する。8 MiB は file / virtual mapping の値で、全 process RAM ではない。343 × 128 × 4 = 175,616 B は caption vector の Float32 payload だけで、Swift array / trie / strings の overhead を含まない。

binary は arm64 Mach-O、コンパイル対象は固定 R5 の Swift 1 ファイル。`otool -L` は macOS の Foundation / CryptoKit / Swift / system libraries を示し、Python、PyTorch、GPU runtime を新 native process に載せていない。Python は別 process の検証 driver / oracle だけ。固定 source snapshot を [snapshot-r5](snapshot-r5/NativeStaticR5.swift) に保存した。

作者の返却 manifest の publicFiles は 66（元 PUBLIC-MANIFEST-R6 に載る65 + manifest自身）。RETURN-R7 は別。これら66と入力17の SHA は実行前・後とも一致した。private 除外された旧 QA 内容は読んでいない。source / binary / table / tokenizer / caption の個別 SHA は [SOURCE-PIN](SOURCE-PIN-R1.json) と [SOURCE-AUDIT](SOURCE-AUDIT-R1.json)。

## 資源の観測と未達範囲

今回の24 call の自己申告 native task_info は、RSS 最大 44,285,952 B（42.23 MiB）、physical footprint 最大 34,456,080 B（32.86 MiB）。最初の往復 42.60 ms は起動、SHA、tokenizer、caption 初期化を含む。query 内の手書き20最大 0.463 ms は JSON encode / pipe / driver を除く。0.054 秒ほどの短い子 process 全体の観測で、入力長や初期化を含めた最大時間保証ではない。元表は oracle も読んでおり、cold file cache を統制していない。

作者の lean 1382 call（first1 / warm200 / timed1120 / worst60 / limit1）は別 process と METHOD の報告値。先の709全 output harnessとも分ける。今回その timing benchmark を再実行していない。RSS、phys_footprint、ru_maxrss の高水位、mmap file bytes、payload bytes を互換な RAM 値にしない。CPU % / power を測っていない。host は作者記録の M5 / 32 GiB macOS 26.5.1。一般16 GB laptop、Windows、GUI、Metal、8時間常駐の目標達成とは言えない。

## アプリへ繋ぐ前の課題

JSONL は各応答で flush、各 query を autoreleasepool に置く。人工非 TTY 24往復では応答が返った。しかし外側 line bytes / JSON parse 前の容量制限と応答 byte guard はない。decoded scalar4000 / token4000 / normalized UTF8 byte262144 の hold は JSON を読んだ後で、未信頼 OS / adapter stream の wire 契約にはまだ足りない。malformed JSON / registry 不正では process 全体が終了する。

stdout に token pieces / normalization が入るので、今回の人工入力を実ユーザー本文へそのまま置き換えてログへ保存しない。body に繋ぐ段階では必要な数値と label のみにする、本文なしの logging、request/response byte cap、timeout・retired / stale guard が必要。今回 OS / clipboard / 実本文を取得せず、新 download もしていない。

CLI は raw cosine rank を返すだけで、採用・否定・曖昧・confidence の policy を実装しない。空白だけの入力も Metaspace 6 token となり hold されなかった。UNK率は token 個数の比率で、fusion 後の「文字がどれだけ既知か」と異なる。配備一致に合格しても、文章内容にふさわしい形の評価を代替しない。default 接続・全16/60形への意味変換・3D生成としての採用は保留を推奨する。

## 出所とライセンス

モデルの pinned [作者 README](https://huggingface.co/hotchpotch/static-embedding-japanese/blob/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3/README.md) の metadata と weights / training code の記述は MIT。独立 LICENSE file がない点も旧 manifest と取得済み本文から確認した。tokenizer 作者 repository の旧 provenance は MIT metadata で、今回使う JSON は static model 内の固定 SHA。最新版を代替取得していない。

tokenizer 算法は Hugging Face tokenizers の Apache-2.0。公式 commit `afaae088837b277c19f90604a1111a272838857b` と source attribution を残し、[LICENSE](snapshot-r5/LICENSE) を同梱した。モデル MIT と算法 Apache-2.0 は別。[公式 StaticEmbedding.py](https://github.com/UKPLab/sentence-transformers/blob/f6922f0269426ab93efd9ac6d9c0da5cc207c1cb/sentence_transformers/models/StaticEmbedding.py) の token lookup / mean を参照するが、L2 は今回の cosine 前処理であり、元 forward が常に正規化するという主張ではない。ライセンス記述の確認は新しい法的認証ではない。

## 再現

repository root から、まず `.local/static-japanese-v1/venv/bin/python` で `oracle_r2.py` を新しい出力名へ複製した review folder で実行し、reference と driver SHA を native call 前に固定する。`run_native_r1.py` は fixed R5 binary、15秒 reply timeout、人工24 input を一回ずつ使用する。保存ファイルは exclusive creation のため既存名へ再実行しない。

保存結果だけの再検算は [audit_saved.py](audit_saved.py)。native process を起動せず、20/4集計、誤差、source drift、709別算術を比較する。

```sh
python3 experiments/native-static-japanese-review-v1/audit_saved.py
```

root が Git / 公開 / アプリ採否を所有する。このレビューは新しい review folder だけを編集し、既存 source / model / app / 原票を変更していない。
