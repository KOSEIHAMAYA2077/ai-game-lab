# Glyph Matter · Metal 3形比較版

macOS標準のAppKit・MetalKit・Core Textで作った独立した比較アプリ。**球・箱・メビウスの3形だけ**で、文字の面をGPUで計算する。WKWebView版、60形の根性版、学習モデル、以前のアプリと保存は変更しない。採否と原票は[実験記録](../../experiments/widget-metal-framing-v2/README.md)。

## 作成と操作

macOS 13以上、Metal対応GPUとCommand Line Toolsが必要。実際のビルドとGPU試験はApple M5 / ARM64で確認した。Intel Mac・Windowsは未確認。

リポジトリのルートで、**まだ存在しない出力名**を指定する。

```sh
desktop/glyph-metal-lab-v2/build.sh --output "$PWD/.local/Glyph Matter Metal Lab 0.2.0.app"
open "$PWD/.local/Glyph Matter Metal Lab 0.2.0.app"
```

アドホック署名のローカル試作で、notarizationは行っていない。ビルドは既存のアプリを置き換えない。出力の`Contents/Resources/BuildInfo.json`に、同梱shaderとSwift各ファイルのSHA-256が入る。AppleのframeworkとOSのフォントを使い、Webページ、モデル重み、ユーザーの保存をアプリ内へコピーしない。

- 最初は黒い空間の`@`。Enterで入力欄を開く。自由な日本語・英字・記号を明示的に貼り付け／入力し、Enterで加える。
- `青い表面 メビウスの輪`、`黄色い立方体`、`赤い球`など。形の解釈は作者が定義した短い語彙だけ。機械学習や一般的な意味理解ではない。
- 色指定は、その入力で加えた文字だけに残る。指定のない新しい文字は赤から白へ移る。
- 下の「球」「箱」「メビウス」で形を選ぶ。「止める／動かす」で流れを停止・再開。文字のID・原文・過去の色は形の変更で変わらない。
- ドラッグで視点、スクロールで距離。Enterまたは「入力」で再び入力。Escで入力を閉じる。
- メニューに表示・隠す・常に手前・終了。閉じる操作は非表示、Cmd+Qは終了。通常15fps、吸収中は30fpsを要求し、停止・非表示では周期描画を停止する。

新R2アプリで、初期の近い`@`、Enterで入力欄、日本語paste→送信、球/箱/メビウスの切替、以前の白と追加文字の青、停止・再開後の実Hideを確認した。停止と非表示ではframes/timeが変わらず、予約も停止した。fixtureモードで履歴の読取/保存はoff。別の新しい試験保存先では人工入力→実Quit→再起動で261文字/20種類/青いbatch/メビウスを復元した。[原票](../../experiments/widget-metal-framing-v2/evaluation/normal-restore-r1/RESULT.json)。pause状態は復元しない。pasteの確認を日本語IME変換の検証とはしない。容量・破損・実日常履歴は実窓で網羅していない。

## 保存

通常はApplication Support内の`org.glyphmatter.metallab.v2/snapshots-v1`だけを使う。入力・形の変更・非表示・終了時に、原文バッチ、受け入れた文字数、色、seed、時刻、形を新しいsnapshotへ保存する。前のファイルを上書き・削除しない。フレームごとの保存はしない。

書き終わった新しいpendingファイルを`renamex_np(..., RENAME_EXCL)`で公開し、既存の宛先を置き換えない。新しいsnapshotが壊れていれば、前の検証済みsnapshotから復元する。失敗時は「保存に失敗」と表示する。旧WK版のlocalStorage、ポート、cacheは読まない。

本文は1入力16,384 UTF-16単位、合計原文1MiB、身体32,000文字・1,024種類、描画最大1,536文字、snapshot 2MiB以内。容量を超える入力は本文を切り取らず拒否し、前の履歴を保つ。身体容量で一部だけ加わった場合も、その入力の原文全体と実際の追加数を別々に記録する。

入力の外部送信、Webアクセス、OS全体のキー取得、clipboardの常時監視、ログイン起動、OS設定の変更はない。

## 再現可能な試験

CPUのみの状態・Unicode・有限幾何と、Metalのoffscreen描画を別々に試す。出力は新しいテスト用ディレクトリ。前の試験出力は保持される。

```sh
desktop/glyph-metal-lab-v2/test.sh "$PWD/.local/metal-cpu-check-new"
desktop/glyph-metal-lab-v2/gpu-test.sh "$PWD/.local/metal-gpu-check-new"
```

`Tests/surface-reference.json`は元の`prototypes/glyph-creature/src/surface-flow.ts`から生成した504地点の数値fixture。DoubleのSwift移植との照合と、FloatのGPUとの差を分けて報告する。Sphereの描画には元`shapes.ts`と同じ1.2倍も適用する。GPU試験はAppKitの窓を開かず、GPU kernel・glyph plane・Core Text atlasを検証する。

数値だけの任意の診断ファイルを指定できる。本文・文字種類一覧・原文バッチは診断へ書かない。診断は描画中1秒ごとと状態変更時で、非表示時の別poll timerはない。

```sh
"$PWD/.local/Glyph Matter Metal Lab 0.2.0.app/Contents/MacOS/GlyphMatterMetalLab" \
  --fixture 1536 --shape 0 --metrics-file "$PWD/.local/metal-metrics-new.json"
```

`--fixture-time`は人工モードの表示時刻を0〜28,800秒で指定する診断用で、8時間の実走行とは違う。通常履歴モードへ適用しない。`--fixture`は1〜32,000文字、`--shape`は0=球、1=箱、2=メビウス。この人工モードは通常の履歴を読み書きしない。`--state-directory`は新規の試験保存先、`--state-file`はこの比較版の検証済みschemaを持つ人工stateの読取用。WK版のstateをそのまま読む形式ではない。

主要な診断値は`cameraDistance`、`framingMinimum`、`manualZoom`、`frustumFar`、`frames`、`time`、`storedGlyphs`、`drawnGlyphs`、`shape`、`paused`、`hidden`、`scheduled`、`preferredFPS`、`atlasRGBABytes`、`instanceBytes`、`uniformBytes`、`metalErrorCount`。`submitElapsedP95MS`はCPU処理からcommand送信までの**壁時計時間**で、OSが計上するCPU使用時間ではない。`shaderCompileMS`は当該プロセスの同期library／pipeline準備の時間で、OSのcompiler cacheを空にした測定ではない。

## 画面から切れにくくする変更

旧R5はゆっくり回転するメビウスが端で切れる姿勢があった。v2は曲面半径・文字quad・FOV・窓の比率から距離の下限とfar面を計算し、毎文字CPU更新を追加せず身体が収まる距離へ引く。初期の`@`は元の近い距離を保つ。

[独立CPU射影](../../experiments/widget-metal-framing-v2/evaluation-independent/README.md)は35,667主条件＋96縦長条件でR2の画面外/near/far/非有限値0。R1で見つかったfar=100の縦長切断も、R1原票を保持して別R2で修正した。定着bodyと既定zoomの数値確認であり、全時刻の数学的証明、実字形の画素保証、好みの改善ではない。遠くする交換で文字が小さくなる。入力元からの吸収、手動で近づくzoom<1は保証範囲に入れない。

## 既存版との差と未確認

60形、骨格の生きもの、部位のProgram、軽量分類モデル、執筆・日記は移植していない。入力の吸収は入力欄の代表点からのseed付き渦で、元Web版の各文字の画面位置を取る方法と同じではない。形変更は前の面の位置から現在の面へ混ぜるが、連続して形を変えた時の完全な旧pose保存と回転の補間は今後の比較対象。

Core Textの文字のalphaを指定色で描くため、emojiも形の輪郭として扱う。ブラウザとは字体・rasterizer・色管理が異なり、WebGL画素の完全一致は主張しない。Metal APIはmacOS向けで、16GB WindowsノートPCへの移植やその実機の資源予算は別に必要。

現在は**GPUの表面写像と文字表示を保った3形の比較候補**。[実小窓90秒](../../experiments/widget-metal-native-evaluation-v2/REPORT.md)では1,536描画・白い球のCPU2.661%／charged peak68.298MiB。停止・Hideでcounter停止も確認した。60形版との機能・字体・カメラ等の差、反復WKの診断鮮度によるgate失敗があり、全体の目標達成・方式だけの因果・16GB laptop性能は主張しない。既定版は保持する。
