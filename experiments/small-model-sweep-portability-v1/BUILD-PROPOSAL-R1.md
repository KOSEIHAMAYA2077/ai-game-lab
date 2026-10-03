# Prism forkをCPUだけで別buildする提案

読み取りだけを行った。configure/build/model起動は0件。Prism defaultの`prism`は動くbranchなので、実際のbuild前に固定commitまたは公式releaseへ解決し、source/hash/licenseと選んだ設定を保存する。Webからcommit APIを取得できなかったため、この調査自体には固定commitのbuild再現性はない。

2026-10-03のPATH確認でCMakeは見つからず、Homebrew標準位置・usr/local・CMake.app・Anaconda標準位置にも見つからなかった。Mac全体を検索した結果ではない。ClangはApple clang21.0.0、arm64-apple-darwin25.5.0だった。[読取記録](TOOLCHAIN-R1.json)。rootはCMakeを新しい専用folderに取得するか、利用可能な既存絶対pathを探す必要がある。OS設定・既存環境はここで変更していない。

[Prism build docs](https://raw.githubusercontent.com/PrismML-Eng/llama.cpp/prism/docs/build.md)はCMakeによるCPU buildと、MacでMetalを無効にする`GGML_METAL=OFF`を示す。[ggmlのCMake設定](https://raw.githubusercontent.com/PrismML-Eng/llama.cpp/prism/ggml/CMakeLists.txt)はApple上のMetal/BLASを既定ON、CPUをONと定義する。Accelerate/BLASはCPU側の処理なので、CPU基準では保持する案。

以下は未実行の例。`/path/to/...`はrootが確認した新しい専用sourceとbuild先へ置き換える。既存b11342やその共有libraryへ上書きしない。

```sh
cmake -S /path/to/frozen-prism-source -B /path/to/new-prism-cpu-build \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DBUILD_SHARED_LIBS=OFF -DLLAMA_USE_SYSTEM_GGML=OFF \
  -DGGML_BACKEND_DL=OFF -DGGML_CPU=ON -DGGML_NATIVE=ON \
  -DGGML_METAL=OFF -DGGML_CUDA=OFF -DGGML_HIP=OFF \
  -DGGML_MUSA=OFF -DGGML_VULKAN=OFF -DGGML_SYCL=OFF \
  -DGGML_OPENCL=OFF -DGGML_WEBGPU=OFF -DGGML_RPC=OFF \
  -DGGML_OPENVINO=OFF -DGGML_VIRTGPU=OFF -DGGML_VIRTGPU_BACKEND=OFF \
  -DGGML_HEXAGON=OFF -DGGML_OPENMP=OFF -DGGML_OPENMP_FETCH=OFF \
  -DLLAMA_BUILD_COMMON=ON -DLLAMA_BUILD_TOOLS=ON -DLLAMA_BUILD_SERVER=ON \
  -DLLAMA_BUILD_APP=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
  -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
  -DLLAMA_OPENSSL=OFF -DLLAMA_SUBPROCESS=OFF \
  -DLLAMA_DSPARK_MARKOV_CUDA=OFF -DLLAMA_DSPARK_MARKOV_METAL=OFF
cmake --build /path/to/new-prism-cpu-build --config Release --target llama-server -j 2
```

これはApple Siliconの比較用build案で、Intel/AMD laptop向けbinaryではない。`GGML_NATIVE=ON`は作ったhostの命令セットへの最適化なので、配布の移植性は別問題。x86用は対象hostで別buildし、古いCPU対応ならnativeをOFFにして公式docsの命令セット条件を選ぶ。

[root CMake](https://raw.githubusercontent.com/PrismML-Eng/llama.cpp/prism/CMakeLists.txt)、[tools CMake](https://raw.githubusercontent.com/PrismML-Eng/llama.cpp/prism/tools/CMakeLists.txt)、[server CMake](https://raw.githubusercontent.com/PrismML-Eng/llama.cpp/prism/tools/server/CMakeLists.txt)から、serverを作るにはcommon/tools/server経路を有効にし、targetを`llama-server`に絞る案にした。Web UIをOFFにして外部prebuilt UI取得を避ける。ただしconfigureがすべての依存取得をしない保証ではなく、実configure logをrootが確認する必要がある。未実行なので設定の組合せがbuild成功したとも言わない。

OpenMPをOFFにするのは、今回のMac専用案で追加runtime自動取得を避けるため。stock prebuiltと同じbuild条件とは限らない。別buildが必要なartifactはそのruntime/hash・設定を結果表へ併記し、modelだけの差と決めつけない。起動時にもdriver共通の`--device none --gpu-layers 0 --no-op-offload --no-kv-offload`を維持し、ログでCPU backendを確認する。
