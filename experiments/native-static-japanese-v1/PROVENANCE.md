# 一次資料・固定 source・license

2026-10-03。モデル/Tokenizer の既取得 pin と SHA は旧実験の manifest を読み直し、今回も同 SHA を検証する。今回のネットワーク取得は固定した公式 tokenizers の source/License 162595B だけで、remote executable/code を実行しない。model/library の再取得・再訓練は行わない。

| 根拠と読んだ範囲 | 本版への対応 | 境界 |
|---|---|---|
| [作者 model card、固定 revision](https://huggingface.co/hotchpotch/static-embedding-japanese/blob/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3/README.md)、旧 [model manifest](../static-japanese-retrieval-v1/model-manifest.json) | metadata と作者記述で weights/training code の MIT を旧実験で確認。取得済み32768×1024F32の first128 を F16 にした表を再利用 | 独立 LICENSE file は元 tree に存在しない。今回は model quality/author performance を再検証しない |
| [作者 tokenizer repository](https://huggingface.co/hotchpotch/xlm-roberta-japanese-tokenizer)、旧 [provenance](../static-japanese-retrieval-v1/tokenizer-author-provenance.json) | 作者 tokenizer metadata MIT の旧確認。使用する JSON は static model 内の固定 SHA | tokenizer repository の latest を使わない。別 tokenizer を download しない |
| [公式 StaticEmbedding.py、固定 revision](https://github.com/UKPLab/sentence-transformers/blob/f6922f0269426ab93efd9ac6d9c0da5cc207c1cb/sentence_transformers/models/StaticEmbedding.py)、旧 [source record](../static-japanese-retrieval-v1/static-implementation-source.json) | token lookup + mean、add_special_tokens=false の旧 source 確認を引き継ぐ | runtime に sentence-transformers/PyTorch を載せない。L2 normalization は本 retrieval の cosine 前処理で、author forward が常に normalize すると主張しない |
| [公式 Unigram model.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/unigram/model.rs): encode_optimized/tokenize/from | 全 UTF8 prefix の Viterbi、Float64 累積、strict greater、min_score−10 UNK、scalar 単位 fallback、fuse_unk | greedy 近似は使わない。byte_fallback=false の固定 schema のみ |
| [公式 trie.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/unigram/trie.rs): common_prefix_search | 短い terminal からの走査、score tie の更新順を維持 | Rust binary の実行/FFI を native に入れない |
| [公式 unicode.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/normalizers/unicode.rs): Nmt/NFKC | Nmt control 除去と空白 mapping → compatibility + explicit canonical composition | Foundation/Rust 全 Unicode 表の一致は未確認、709 known regression の範囲 |
| [公式 normalizer.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/normalizer.rs): lowercase | Unicode scalar ごとの lowercase expansion。全 String の文脈依存 Greek final sigma 変換にしない | offset/alignment の完全互換は本 gate に含めない |
| [公式 metaspace.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/pre_tokenizers/metaspace.rs): replace/prepend/split | ASCII space→▁、always prefix、MergedWithNext、連続/末尾 space を残す | trim/collapse を加えない |
| [公式 added_vocabulary.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/added_vocabulary.rs): extraction | non-normalized literal special を先に leftmost-longest 抽出。mask lstrip の raw Unicode whitespace。71 record/66新規ID | 動的 token 追加、pair/template、offset は移植しない |

tokenizers の tag v0.22.1 は commit `afaae088837b277c19f90604a1111a272838857b` に固定する。上の Rust 7 file と Apache-2.0 [LICENSE](upstream/LICENSE) は [upstream/MANIFEST](upstream/MANIFEST.json) で URL/size/SHA を保存した。Swift はこの固定算法を独立 CPU 実装として適用し、source 先頭に出所を記す。License を model MIT と混ぜない。

Python oracle は既存 tokenizers0.22.1 と NumPy2.0.2。旧 [requirements-lock](../static-japanese-retrieval-v1/requirements-lock.txt) と tokenizers.abi3.so の SHA は [EXPECTED-FREEZE](EXPECTED-FREEZE-R1.json) に固定する。native 実行は macOS system SDK library だけで、これら Python/Rust library をロードしない。

本文/公式 source を確認した範囲、固定入力で確認した実装、一致が未確認の一般 API を分ける。作者の benchmark や MIT 表記を、本版の精度・Unicode 完全互換・Windows 配布の認証には使わない。
