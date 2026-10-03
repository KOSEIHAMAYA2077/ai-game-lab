# 既存runtimeと元モデルの追加照合

README作成後に、rootから比較に使う既存runtimeが`llama.cpp b11342 / f1cee9941 / macOS arm64`と報告された。研究担当はbinaryの実体・signatureを確認していない。報告された短いcommitを公式GitHub APIで **`f1cee9941b0e843ea260bf8dd9a090fbd9711b6a`**へ解決し、その固定sourceだけを読んだ。[原票](ROOT-RUNTIME-SOURCE-R1.json)

| 読んだ箇所 | sourceで確認したこと | sourceだけでは分からないこと |
| --- | --- | --- |
| `ggml/include/ggml.h` | Q1_0型41、Q2_0型42。PQ2_0/I2_Sの宣言はこのheaderになかった | binaryがこのsourceと一致するか、重みをloadできるか |
| `ggml/src/ggml-common.h` | Q1_0 group128、Q2_0 group64 | 古いgroup128 Q2ファイルのtensor型・メタデータが何か |
| `ggml/src/ggml-cpu/ggml-cpu.c` | Q1_0/Q2_0のCPU型登録がある | 全operation・CPU機種・backendでの完全対応、速度 |
| `src/llama-arch.cpp` | qwen35、lfm2、granite、bitnetの名前の登録がある | 特殊I2_S実装、形式差、実際の会話templateと精度 |

通常群とTernary group64はこのruntimeで実際にloadして確かめる候補。Prism PQ2_0 group128はPrism forkの別群、Microsoft I2_SはBitNet runtimeの別群として扱う。同じ形問題へ答えさせる比較は可能でも、runtime差を量子化だけの差と解釈しない。rootの比較・ロード失敗を先回りして合格と記録しない。

GGUFの元モデルについて、[UPSTREAM-METADATA-R1.json](UPSTREAM-METADATA-R1.json)に16個の異なるrepoの固定revision、metadata byte数/hash、license/gate/languageを追加した。Qwen3.5の元モデルはimage-text-to-textだが本比較ではtext-only、SmolLM2とBitNetはEnglishタグ、Liquidは日本語を含む8言語タグ。metadataのlanguageが空であることは日本語非対応の証明ではなく、タグがあることも本作品の日本語精度の証明ではない。

Qwen2.5のAPIはEnglishタグだが、元の[0.5B card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)は系列の多言語対応を説明する。今回の有限形への日本語対応は、rootの固定人工問題で実測する課題として残す。

この追加照合でもmodel inference・runtime build・重み取得・OS入力取得は0。既存のCANDIDATES R1/R2とREADMEは残す。ここは候補探索の追加原票で、作品の意味精度や一般PCへの採用判断の結果ではない。
