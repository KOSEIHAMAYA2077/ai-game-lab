# 固定した取得先とローカル配置

2026-10-03の公開メタデータ確認。実際の取得・SHA照合・展開・実行は比較実験の担当が行う。以下はOSへインストールする手順ではなく、新しい専用フォルダで使う候補。

## Prism runtime

[公式release `prism-b10754-2459f68`](https://github.com/PrismML-Eng/llama.cpp/releases/tag/prism-b10754-2459f68)、固定source `2459f68b5c0eb26261fd5a81682004b93cd645ba`。

| 項目 | 値 |
| --- | --- |
| archive | `llama-prism-b10754-2459f68-bin-macos-arm64.tar.gz` |
| bytes | 11,528,752 |
| 公開 SHA256 | `e411342cf017a9a3399cc242d45176acc025ecae1ec426c678bc6a9120432036` |
| 配布 | [固定archive](https://github.com/PrismML-Eng/llama.cpp/releases/download/prism-b10754-2459f68/llama-prism-b10754-2459f68-bin-macos-arm64.tar.gz) |
| 照合元 | [公式GitHub release API](https://api.github.com/repos/PrismML-Eng/llama.cpp/releases/tags/prism-b10754-2459f68) のasset digest |

KleidiAI版は別archiveで、11,557,433 bytes、SHA256 `05634382ae372c752058be8410a1dfd8db05ebda04e3690dedda4b8ec14a787a`。最初は通常arm64版を別runtime群として使う。GitHubが返すdigestは署名や実行の安全性の証明ではない。取得後のSHA照合、tarのメンバー確認、versionと依存libraryの記録が必要。

[PRISM-RELEASE-METADATA-R1.json](PRISM-RELEASE-METADATA-R1.json)にasset metadataを保存した。既存のllama.cppを置き換えず、既存ライブラリへの上書きもしない。serverはloopbackへbindし、比較ではGPU layerを0、context・thread・出力上限を明示する。binaryが実際にどのCPU backendを含むかは実行担当が確認する。

## CMake

[公式ダウンロードページ](https://cmake.org/download/)と[Kitwareの固定release `v4.4.4`](https://github.com/Kitware/CMake/releases/tag/v4.4.4)を確認。公開日時は2026-10-02 16:18:25 UTC。現在のmacOS配布はmacOS 12以降向けで、universal archiveを任意のフォルダへ展開して利用できる。

| 項目 | 値 |
| --- | --- |
| archive | `cmake-4.4.4-macos-universal.tar.gz` |
| bytes | 89,454,352 |
| SHA256 | `4b7b73704b1db9b374e5c9ab8e17ac6148b817b6396ee75cd94a852cbac9d305` |
| 配布 | [固定archive](https://github.com/Kitware/CMake/releases/download/v4.4.4/cmake-4.4.4-macos-universal.tar.gz) |
| 照合元 | [公式 SHA-256 list](https://github.com/Kitware/CMake/releases/download/v4.4.4/cmake-4.4.4-SHA-256.txt) とGitHub asset digest |

SHA listの該当行とGitHub APIのdigestは一致した。取得したSHA list自体は2,015 bytes、SHA256 `560231a0064d3f39c078d6b242dab4a93a8ed17a80e997a56851f338a91e9d65`。公開`.asc`署名の存在は確認したが、鍵の確認・署名検証はしていない。[CMAKE-RELEASE-METADATA-R1.json](CMAKE-RELEASE-METADATA-R1.json)へ原票を保存した。

展開後の想定実行位置は`cmake-4.4.4-macos-universal/CMake.app/Contents/bin/cmake`。この調査担当はarchiveを未取得なので、実際のtarメンバーを確認してから展開する。`/Applications`やシステムの`PATH`を変更せず、絶対パスで新しいbuild directoryだけを指定できる。

BitNet公式READMEのCMake前提は3.22以上、固定トップCMakeの最小宣言は3.14。CMake 4.4での全subdirectory互換は未検証であり、source上の宣言だけでconfigure成功を保証しない。手元のAppleClang 21という報告も、LLVM clang 18以上の条件と単純に数値比較せず、実際のconfigure/buildログで評価する。

## 実行担当へ渡す境界

- 既存runtime・旧版成果物を保持し、専用フォルダ内へ新しいsource/build/binaryを置く。
- metadata確認、取得後のSHA照合、configure/build、model load、HTTP schema、意味の正答、性能を別の段階として記録する。
- `setup_env.py`、pip、torch、モデル変換・再量子化、OSへの導入はこのCMake-only候補に含めない。
- 通常CPU、Prism PQ2_0、BitNet I2_Sは別群として比較する。この資料には未測定の速度やRAMの主張を加えない。
