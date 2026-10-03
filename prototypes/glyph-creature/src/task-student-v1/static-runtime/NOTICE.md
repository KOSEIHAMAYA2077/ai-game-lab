# Standalone tokenizer attribution

The tokenizer and Float32 accumulation algorithm in `encoder.mjs` adapt the public local implementation [NativeStaticR5.swift](../../../../../experiments/native-static-japanese-v1/NativeStaticR5.swift). That implementation independently adapts Hugging Face [tokenizers v0.22.1](https://github.com/huggingface/tokenizers/tree/v0.22.1) algorithms under Apache-2.0, including Unigram Viterbi decoding, Nmt normalization, Metaspace, and added vocabulary handling. The project's cached upstream files and provenance are in `experiments/native-static-japanese-v1/upstream/`.

The standalone JavaScript version adds a 512 Unicode scalar input limit, rejects unpaired UTF-16 surrogates, stores the byte trie in typed arrays, and reads the F16 table without expanding it to a 16MiB Float32 table. It uses browser standard JavaScript APIs only.

Static model and tokenizer asset notices are separate, in `experiments/bonsai-task-student-v1/static-candidate/assets/NOTICE.md`. No upstream copyright holder or year is inferred here.
