# 初期計画後の追加モデル群

2026-10-03。最初の18種類の通常群と特殊runtime候補を保持したまま、別系列の比較幅を広げる追加調査。**初期候補の置換、事前計画に遡った書き換えは行わない。** 重み取得・推論・作品への既定接続は実験担当の別工程であり、この調査担当は実施していない。

## 追加候補

| 候補 | GGUF配布元 | 選択量子化 | 正確なbytes | 元モデルのlicense |
| --- | --- | --- | ---: | --- |
| Phi-3.5-mini-instruct | bartowski | Q4_K_M | 2,393,232,672 | MIT |
| Phi-4-mini-instruct | Unsloth | Q4_K_M | 2,491,874,272 | MIT |
| SmolLM3-3B | ggml-org | Q4_K_M | 1,915,305,312 | Apache-2.0 |

合計6,800,412,256 bytes。各artifactは3GB未満だが、ファイルサイズを実行時RAMや常駐負荷と同一視しない。これらは有限の形・手続き的パラメータへ文章を対応させるLLM候補であり、任意の3Dメッシュを直接生成するモデルではない。ウィジェットの既定モデルへの採用はこの表の掲載に含まれない。

[CANDIDATES-EXTRA-R1.json](CANDIDATES-EXTRA-R1.json)に、固定GGUF revision・filename・bytes・LFS SHA256・固定download URLを記録した。配布元と元モデルの公開APIはいずれも`gated=false`、`private=false`。この調査はログイン・契約同意・ゲートの迂回を行っていない。

元モデルは[Microsoft Phi-3.5](https://huggingface.co/microsoft/Phi-3.5-mini-instruct/blob/2fe192450127e6a83f7441aef6e3ca586c338b77/README.md)、[Microsoft Phi-4-mini](https://huggingface.co/microsoft/Phi-4-mini-instruct/blob/cfbefacb99257ffa30c83adab238a50856ac3083/README.md)、[HuggingFaceTB SmolLM3](https://huggingface.co/HuggingFaceTB/SmolLM3-3B/blob/a07cc9a04f16550a088caea529712d1d335b0ac1/README.md)。ここで固定した元モデルrevisionは今回読んだ原票であり、変換者が実際に用いた元weight revisionを証明するものではない。

## 利用条件を読んだ範囲

Phiの元repoの[MIT全文](https://huggingface.co/microsoft/Phi-4-mini-instruct/raw/cfbefacb99257ffa30c83adab238a50856ac3083/LICENSE)を2件とも読み、各GGUFのcardがその元モデルとlicenseを明示することを確認した。無償の使用・変更・配布を許すが、配布時はcopyrightとpermission noticeを保持する条件がある。両元LICENSEは1,084 bytes、SHA256 `fa8235e5b48faca34e3ca98cf4f694ef08bd216d28b58071a1f85b1d50cb814d`。

SmolLM3は元cardがリンクする[Apache-2.0全文](https://www.apache.org/licenses/LICENSE-2.0.txt)を読んだ。元cardとggml-orgのcardで同じlicenseを確認した。無償の研究利用に対応する許諾があり、配布時のlicense添付・変更表示・通知保持、該当するNOTICE、特許・商標条項は別途守る。元HF repoに専用LICENSEファイルは今回の公開treeで見当たらず、元cardのlicense指定とそのリンク先全文を根拠としている。Apache本文は11,358 bytes、SHA256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`。

Gemma3-270M-itとGemma3-1B-itは今回の公式APIで`gated=manual`、cardがGoogleの利用条件への同意とログインを要求する。ゲート無し群へ追加せず、コミュニティ配布を利用した同意の迂回も試さない。これはGemmaの性能評価や一律の利用不可判断ではない。

## 固定runtimeで確認したこと

既存の通常群runtime `b11342` / `f1cee9941b0e843ea260bf8dd9a090fbd9711b6a`について、[architecture mapping](https://github.com/ggml-org/llama.cpp/blob/f1cee9941b0e843ea260bf8dd9a090fbd9711b6a/src/llama-arch.cpp)、[phi3実装](https://github.com/ggml-org/llama.cpp/blob/f1cee9941b0e843ea260bf8dd9a090fbd9711b6a/src/models/phi3.cpp)、[smollm3実装](https://github.com/ggml-org/llama.cpp/blob/f1cee9941b0e843ea260bf8dd9a090fbd9711b6a/src/models/smollm3.cpp)の存在を確認。HFのGGUF metadataでもPhiの2候補は`phi3`、Smolは`smollm3`となっている。sourceに対応経路があることと、選んだGGUFのload・tokenizer・chat・schemaが実際に動くことは別である。

SmolLM3の[元card](https://huggingface.co/HuggingFaceTB/SmolLM3-3B/blob/a07cc9a04f16550a088caea529712d1d335b0ac1/README.md)とGGUF templateはextended thinkingを既定にする。有限shape分類では初期条件をsystemの`/no_think`、`chat_template_kwargs`の`enable_thinking=false`とし、実際に適用されたtemplateと出力を確認する。これらの制御が固定serverで成功するとは、この調査段階では断定しない。

初期18候補と同じ人工文・schema・prompt版・context・thread数・GPU layer 0・出力上限を使用して比較し、追加群という印を残す。初期群の結果を追加群の結果で差し替えない。download hash照合、load失敗、template失敗、timeout、形式適合、意味の正答、CPU/RAM/latencyを区別する。日本語入力の適性、30秒以内の生成、常駐widgetに適する負荷はすべて未検証。

## 公開原票

[PUBLIC-MODEL-METADATA-R2.json](PUBLIC-MODEL-METADATA-R2.json)と[PUBLIC-SOURCE-READS-R2.json](PUBLIC-SOURCE-READS-R2.json)へ元card・license全文・runtime sourceのURL、pin、サイズ、SHA、参照lineを保存した。初期raw metadataとsource excerptはローカルに保持し、公開manifestから除外する。モデルカードのインストール例やremote Python codeは実行していない。
