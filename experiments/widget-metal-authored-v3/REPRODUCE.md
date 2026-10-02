# 出所と再現

既存ローカルのApple SDK/Swift/Metal/CoreTextとNodeのnative type strippingのみを使った。モデル、npm/Swift外部package、素材の新downloadはしていない。元はrepo内の作者実装である。

## 読んだ元の実装

| path | 用途 |
|---|---|
| prototypes/glyph-creature/src/word-surfaces.ts | 10形point式、ID→patch/material、central difference、closed set |
| prototypes/glyph-creature/src/surface-frame.ts | Gram–Schmidt、投影後v長さ<1e-10ならstable perpendicular |
| desktop/glyph-metal-lab-v2/Sources/SurfaceReference.swift | 球/箱/メビウスのDouble reference |
| desktop/glyph-metal-lab-v2/Sources/Glyphs.metal | 旧3形のGPU式、glyph plane、ink、depth light/coating |
| desktop/glyph-metal-lab-v2/Sources/CameraFraming.swift | R2既定framingと旧3半径 |
| desktop/glyph-metal-lab-v2/Sources/main.swift | window/input/pausehide/storeの土台 |

v2複製時の全file SHAは`BASELINE-V2.json`。元TSとfixture A/BのSHA・bytes・Node版は`REFERENCE.json`、`REFERENCE-B.json`。candidateごとのsourceは`stage-*-source.json`、runtime appのBuildInfoには実際にbuildしたSource/Info SHAを残す。

## 新しい人工run

repo rootから以下を実行する。既存outputを上書きせず未作成名を使う。

```sh
bash desktop/glyph-metal-lab-v3/test.sh "$PWD/experiments/widget-metal-authored-v3/work/cpu-new-run"
bash desktop/glyph-metal-lab-v3/gpu-test.sh "$PWD/experiments/widget-metal-authored-v3/work/gpu-new-run"
bash desktop/glyph-metal-lab-v3/build.sh --output "$PWD/experiments/widget-metal-authored-v3/work/Glyph Matter new-run.app"
```

testはbundleの保存先を使わず、人工stateを新しいtest directoryにだけ保存する。GPU testは実UIを開かず、MTKView/textureへ13形をoffscreen描画する。GPU reportのshader compile/submit時間はUIや単独資源測定ではない。

generatorは既に凍結fixtureを保持するため、再生成で原fileを上書きしない。再現確認する場合はgeneratorと元TSを含む別の作業copyから生成し、JSONの値とSHAを照合する。中央差分/phase候補は元fixtureを変えていない。

## 明るさの人工比較

geometry/ID/color/atlas/time/camera/countをそろえてfloorだけを替える。

```sh
bash experiments/widget-metal-authored-v3/lighting-test.sh "$PWD/experiments/widget-metal-authored-v3/work/lighting-new-run"
```

このhelperは旧floor .30のshaderを元に、ignored outputへbaseline/candidate shaderを作る。共有sourceや旧appを変えない。24画像の8bit code-value lumaは輝度・読みやすさの測定ではない。現sourceのfloorを後で採用変更する場合、旧候補の凍結copyから実行する。

rootの実窓対比較には、同一の人工`fixtures/blue261-mobius-t24.json`またはt100と、Stage Eの2つのimmutable appを使う。

```sh
"$APP_EXECUTABLE" --state-file "$PWD/experiments/widget-metal-authored-v3/fixtures/blue261-mobius-t24.json" --paused --metrics-file "$PWD/experiments/widget-metal-authored-v3/work/new-root-comparison-metrics.json"
```

APP_EXECUTABLEは目的のapp内の実行fileを指定する。実UI・プロセス操作はroot担当。人工state-file modeは通常snapshotを保存しない。--pausedは同じtimeで起動1描画、paused reopen時も1描画だけで、継続予約はoff。oldwhite/newblue、少数青glyph、emojiの見え方を別々に観察し、root資源計測のquiet区間にbuildを重ねない。

## scopeと容量

publicには相対path、人工fixture、source SHA、結果のみを置く。ignored work/appを公開用bundleに混ぜない。実ユーザー本文、root UI内部の端末path、snapshot内容を転載しない。新shapeは10作者形の局所移植であり、既定60形や6 Programの到達率とは比較しない。
