# v4 pilot保持

- 教師loader 1: Node 26.4.0のnative type strippingはCreatureRig constructor parameter propertyを実行できず、fixture未生成。
- 教師loader 2: `--experimental-transform-types`はこのNodeに無い。fixture未生成。
- 教師loader 3: 既存TypeScript 7.0.2には旧transpileModule入口が無く、fixture未生成。
- 教師loader 4: 既存Rolldown 1.2.11/OxcのtransformSyncでTS syntaxのみ変換、既存Three 0.186.1と原TS未変更。REFERENCE.jsonに教師SHAと件数を固定。
- CPU candidate R1: 原v3の語彙回帰で停止。新fish部分文字照合を先頭へ入れたため、既存`jellyfish`が魚に吸収された。位置/rig数値判定はまだ実行されていない。旧作者語彙の優先順を保持して修正し、R2で再実行。R1 source manifestとignored実行folderを保持。
- GPU R1: finite0、position最大4.043e-6。Floatの中央差分はtriangle seam／bird beak端／ellipsoid poleで648方向診断を出し不合格。GPU-R1-FAIL.jsonを保持。
- GPU R2: 元position／palette／weightsは不変。GPU-METHOD-R2.mdの解析rest＋LBS weight勾配で固定閾値に合格。rawdv magnitudeは固定h=1e-5の有限差分と解析式の違いにより最大123.461。regular方向／basisは最大.004230radで合格。これをrawdvそのものの完全一致とは書かない。
- GPU R2 report metadata: `rawDerivativeStepGPU:.0001`はR1から残った欄で、R2には該当しない。原票は変更せず、この訂正を添える。R2は解析接線とtriangle seam h=1e-5で、以後のharnessはそのmetadataを出す。geometry／閾値の変更なし。
- bundle Candidate R1: namespaceはv4だがplist shortVersionが0.3.0のまま。Candidate R2で0.4.0へ修正した。各古いappは置換しない。
- 密度／姿勢R1: 288runs中2つのfish count2／t1.2 frontが下端clip。ただし元fixtureが出生0なのに描画timeを周期内へ戻したため、事前のsettled-only METHODに反し、吸収の飛行軌道を測っていた。suiteをinvalidとして原票と観察を保持。R2はharness人工glyphのbornをtime−20に指定し、同じshader／gate／seed／ID／density／timeでsettled条件を満たす。通常source／R3appは変更しない。到着軌道の収まりを合格にしない。
