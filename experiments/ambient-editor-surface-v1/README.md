# Ambient editor → surface lab

採択候補は **surface R2**。独立した黒い空間に専用textareaを置き、凍結したadapter R2 / receiver R3の単一bodyから文字planeを描く。既存widget・60形の入口・共有sourceは変更しない。実OS連動、一般意味モデル、人体験の検証ではない。

作者の確認はCPU合成12/12と原式の算術不変量2304点まで。ブラウザ・GPU・実DOM・実IME・実CPU/GPU資源の確認は実施していない。実ブラウザの採否はroot所有のproduction QA後に決める。R1は15fps境界11/12の失敗を保持している。

## 構成

- `main-r2.ts` → `adapter-r2.mjs`（read-only）→ `receiver-r3.mjs`（read-only）が材料とIDの唯一の所有者。
- `SurfaceScene.draw(adapter.readBody(), presentedCount, shape, visualTime, dt)` はreadonly iteratorから描画metadataのみ派生。本文配列・再segment・Matter・材料allocator・別bodyは作らない。
- `projection-r2.mjs` は有限256の既存ID / ink / 初回表示時刻 / texture tileを保持。texture tileは重複文字を共有できるが、材料IDの重複排除には使わない。
- `surface.ts` とsceneは既存 `shapes.ts` の `composedPosition`、`surface-frame.ts` のanalytic basisをそのままimportする。文字planeのshaderは既存GlyphSceneのdynamic atlas有効枝と文字列一致。
- receiver候補sphere→condense、box→cube、ring→mobius。輪→メビウスは比較用の表示対応であり、普通の輪と意味・位相が等しいとの主張はしない。
- 空・表示待ちの `@` はDOM上の仮表示。body / ID / atlas entry / GPU material instanceは0。
- 色はreceiver unitのinkをそのまま読む。削除・undo・redo後もbodyと古い色を残す方針は暫定。
- 67ms timeoutで15fps以下。pause / document.hidden / pagehideではtimerを取り消し、描画・receiverの定期advance・GPU resizeを止める。復帰初回のvisual dtは0。入力callbackのbounded admissionとcontrolの一回処理は描画停止中も別に存在する。

## 再現（repo rootから）

既存packageにinstalled済みのVite / Threeをread-only reuseする。install不要。既存outputがあればbuildとrunnerは拒否するので、原票を消さず別評価version/outputへ進める。

```sh
node experiments/ambient-editor-surface-v1/build-surface-r2.mjs cpu
node experiments/ambient-editor-surface-v1/run-surface-r2.mjs
node experiments/ambient-editor-surface-v1/build-surface-r2.mjs production
```

CPUのgeometry bundleは `.runtime/cpu-surface-r2/surface.mjs`。productionは `.runtime/dist-surface-r2/` の3filesのみを配信し、`/index-r2.html` を開く。repo全体をVite dev serverや `@fs` で配信しない。作者はserverを起動していない。rootのQA例と採否項目は `QA.md`。

## 境界

DOMの専用fieldだけを読む。clipboardData / dataTransfer /他app / OS key監視は使わない。UAイベントguardの成立はOSやIME一般の証明ではない。本文 / glyph / ID列 /色順 /窓 /query /fingerprintの永続化なし。GPU atlas、textarea、body、projectionはvolatileであり、OS/browserが独自に保持する領域まで検査したとの主張はしない。

公開QAは `window.ambientSurfaceLab.inspect()`（aggregate）、`pause(boolean)`、`exportOff()`（R3のstrict aggregate off export）。`readBody`や本文・ID列のinspectは公開しない。CSPは `connect-src 'none'`。model / worker / storage /外部requestはアプリ側に存在しない。Threeのlibrary全体にnetwork APIが無いとの主張ではなく、アプリsourceの入口とCSPで境界を固定する。

データ上限、保存off、意味非同値、暫定削除方針は画面HELPのみで説明する。15fps以下が快適・集中向上・省資源の証拠になるとは言わない。モデルが答えない人工ケースでも追加はすぐbodyへ入るが、今回はmodelを接続していない。

`METHOD.json` / `CASES.json` は実装前の凍結。`SOURCE-FREEZE-R1.json` / `SOURCE-FREEZE-R2.json`、`results-r1-build-r2.json` / `results-r2.json`、`RUNTIME-GRAPH-R2.json` にsource、失敗、回帰、production hashを分けて残す。
