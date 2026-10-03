# PQ2_0 / I2_S の別runtime試行条件

2026-10-03の小型モデル比較へ向けた追加調査。**sourceとreleaseメタデータを読んだ段階**で、ここでの重み・binary取得、build、推論、OS入力取得は0。rootが実試行を所有する。既存の`b11342 / f1cee9941`を置換しない。

## Prism PQ2_0：公式別binaryとCMake候補

固定Prism sourceは`2459f68b5c0eb26261fd5a81682004b93cd645ba`。PQ2_0型142/group128があり、現mainline Q2_0型42/group64と分ける。候補重みは`Ternary-Bonsai-1.7B-PQ2_0.gguf`。古いgroup128の`Q2_0.gguf`を新Q2の名前だけで代用しない。[前の調査と重みpin](../small-model-sweep-20261003/CANDIDATES-R2.json)

[公式release prism-b10754-2459f68](https://github.com/PrismML-Eng/llama.cpp/releases/tag/prism-b10754-2459f68)にmacOS arm64通常版がある。11,528,752 bytes、公開digestは`e411342cf017a9a3399cc242d45176acc025ecae1ec426c678bc6a9120432036`。KleidiAI版は別artifact。メタデータのdigestはダウンロード後のローカルSHA照合とは別であり、ここでは実行確認していない。

固定[トップCMake](https://github.com/PrismML-Eng/llama.cpp/blob/2459f68b5c0eb26261fd5a81682004b93cd645ba/CMakeLists.txt)、CPU・vendor・UI・serverのsourceを読んだ。CMake最小宣言は3.14、C/C++ compiler、Threads、Mac SDKを使う構成。loopback HTTPの比較にはOpenSSLを切れる。`LLAMA_CURL`はこのsourceではdeprecatedなので、それだけを指定してHTTPS依存が無効になると推定しない。

純CPU・余分な取得を避ける**未実行の案**：

```sh
cmake -S <FIXED_PRISM_SOURCE> -B <NEW_PRISM_BUILD> \
  -DCMAKE_BUILD_TYPE=Release \
  -DGGML_METAL=OFF -DGGML_BLAS=OFF -DGGML_OPENMP=OFF \
  -DGGML_CPU_KLEIDIAI=OFF \
  -DLLAMA_OPENSSL=OFF -DLLAMA_LLGUIDANCE=OFF \
  -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
  -DLLAMA_SUBPROCESS=OFF \
  -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_APP=OFF \
  -DLLAMA_BUILD_COMMON=ON -DLLAMA_BUILD_TOOLS=ON \
  -DLLAMA_BUILD_SERVER=ON
cmake --build <NEW_PRISM_BUILD> --target llama-server llama-cli --parallel 2
```

UIがHF bucketのprebuilt assetを取得する経路、KleidiAIがFetchContentで別sourceを取得する経路をsourceに認め、上では明示offとした。LLGuidanceもoff。すべてのCMake経路の安全性やネットワーク不使用を形式的に証明したわけではない。rootは実際のconfigure/buildログ・未使用option・追加取得を確認する。CPUのAccelerate/native最適化は既存runtimeとの条件差として記録する。

serverには[`/v1/chat/completions`](https://github.com/PrismML-Eng/llama.cpp/blob/2459f68b5c0eb26261fd5a81682004b93cd645ba/tools/server/server.cpp)と[`json_schema`→GBNF](https://github.com/PrismML-Eng/llama.cpp/blob/2459f68b5c0eb26261fd5a81682004b93cd645ba/tools/server/server-schema.cpp)がある。endpointやschemaのsource存在は、重みload・template・対象schemaの動作確認の代わりではない。

## Microsoft BitNet I2_S：固定submodule込みで別build

Microsoft公式superprojectは`0b341e582afbf9e1011f24744b554c96a3477eb5`。その[`.gitmodules`](https://github.com/microsoft/BitNet/blob/0b341e582afbf9e1011f24744b554c96a3477eb5/.gitmodules)は`isHuangXin/llama.cpp`を指し、gitlinkは **`390c307752ab78fd8189f359d6954c9ba1be74af`**。公式superprojectが指定する外部forkであり、Microsoftが直接所有するrepoと呼ばない。branch名へ追従せずgitlinkの固定commitを配置する。

今回の公開GitHub release一覧は0件で、macOS向け公式binaryを見つけていない。これは全経路でbinaryが存在しない証明ではない。[公式README](https://github.com/microsoft/BitNet/blob/0b341e582afbf9e1011f24744b554c96a3477eb5/README.md)の前提はCMake>=3.22、clang>=18。AppleClangのversion数字をLLVM clangの数字と同じに扱わず、手元のcompilerでの可否は実試行で残す。新しいcompilerやPython環境の導入はこの調査で行わない。

固定submoduleの[`ggml.h`](https://github.com/isHuangXin/llama.cpp/blob/390c307752ab78fd8189f359d6954c9ba1be74af/ggml/include/ggml.h)にはI2_S型36、CPU sourceにはvec_dotとI2_S用GEMV/GEMM経路がある。I2_SとTL1/TL2は別であり、I2_SはTLの生成kernelを有効にする前提にしない。

[公式setup_env.py](https://github.com/microsoft/BitNet/blob/0b341e582afbf9e1011f24744b554c96a3477eb5/setup_env.py)にはpip導入、元モデル取得・変換・再量子化、kernel生成、CMake buildが混在する。**既に配布済みI2_S GGUFを使う試行では、scriptを丸ごと実行せず必要なCMake候補だけを分離できる**。`src/ggml-bitnet-lut.cpp`はTL macroがoffなら生成headerのincludeを除くsource guardを持つ。これはCMake-onlyのbuild成功をまだ証明していない。

固定superprojectに固定submoduleを新しいフォルダへ配置した後の、**未実行の案**：

```sh
cmake -S <FIXED_BITNET_WITH_PINNED_SUBMODULE> -B <NEW_BITNET_BUILD> \
  -DCMAKE_BUILD_TYPE=Release \
  -DBITNET_ARM_TL1=OFF -DBITNET_X86_TL2=OFF \
  -DGGML_METAL=OFF -DGGML_BLAS=OFF -DGGML_OPENMP=OFF \
  -DGGML_CPU_KLEIDIAI=OFF \
  -DLLAMA_OPENSSL=OFF -DLLAMA_LLGUIDANCE=OFF \
  -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
  -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_APP=OFF \
  -DLLAMA_BUILD_COMMON=ON -DLLAMA_BUILD_TOOLS=ON \
  -DLLAMA_BUILD_SERVER=ON
cmake --build <NEW_BITNET_BUILD> --target llama-server llama-cli --parallel 2
```

`BITNET_ARM_TL1=OFF`は[公式setupのarm64 compiler args](https://github.com/microsoft/BitNet/blob/0b341e582afbf9e1011f24744b554c96a3477eb5/setup_env.py)とも一致する。固定submoduleに[/v1/chat/completions](https://github.com/isHuangXin/llama.cpp/blob/390c307752ab78fd8189f359d6954c9ba1be74af/tools/server/server.cpp)と[`json_schema`](https://github.com/isHuangXin/llama.cpp/blob/390c307752ab78fd8189f359d6954c9ba1be74af/tools/server/server-schema.cpp)があり、公式`run_inference_server.py`は`-ngl 0`、loopbackを既定にしている。本文をネットへ送る必要はない。CLI/HTTPの実際の応答と停止はrootの検証対象。

## 比較に残す条件

通常CPU `b11342`、Prism `prism-b10754`、BitNet＋gitlinkは**別runtime群**。同じ人工入力、有限shape schema、prompt版、context、出力上限、thread数、GPU layer0を使えても、compiler・backend・template・kernel差が残る。性能差をモデルのparameter数やbit幅だけの効果と解釈しない。

まずloadと単発の固定一般文、schema、timeout、正常停止を確認し、失敗は未実行・build失敗・load失敗・意味の誤答に分ける。formatをgrammarで保証することと、文章に合う形を選べることも別に記録する。rootの実行結果が来るまではこのfolderで成功・速度・RAMの数値を記さない。

modelとruntimeのlicenseは別に扱う。PrismのBonsai/PQ2重みはApache-2.0、llama.cpp系sourceはそのMIT条件、BitNet重みはMIT。新しいweightやbinaryを作品の既定へ接続・再配布する判断は、このsource調査の完了に含めない。

## 公開原票

[PUBLIC-SOURCE-READS-R5.json](PUBLIC-SOURCE-READS-R5.json)に、読んだ固定source・revision・URL・byte数・hash、markerのline番号、releaseのasset metadataを収録。source textの抜粋を含む初期R1〜R4はローカルに保持し、公開manifestから除外する。rootのbuild・推論結果は別の実験folderに保存する。

[BUILD-TOOLS-R1.md](BUILD-TOOLS-R1.md)に公式Prism binaryと、OSへ導入せず専用フォルダで使うCMake 4.4.4の固定取得先・byte数・SHA照合元をまとめた。どちらもこの調査担当は未取得・未実行であり、実際の動作は実験担当の記録を参照する。
