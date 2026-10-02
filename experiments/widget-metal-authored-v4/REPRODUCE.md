# v4再現

macOS／Xcode Swift／Metal／CoreTextのlocal環境で実行する。追加download不要。Node26.4.0、元Webに既存のThree0.186.1／Rolldown1.2.11は教師生成だけで使い、app runtimeへ含めない。Freezer後の教師結果はJSONとしてdesktop Testsに同梱され、CPU/GPU testでNodeは不要。

全出力は新しいignored work pathを使う。既存app／原票／教師fixtureを上書きしない。buildはbundle org.glyphmatter.metallab.v4／0.4.0、ad-hoc署名とstrict検査。notarization／配布権限／Windows実機は別。

```sh
bash desktop/glyph-metal-lab-v4/build.sh --output "$PWD/experiments/widget-metal-authored-v4/work/Glyph Matter new.app"
bash desktop/glyph-metal-lab-v4/test.sh "$PWD/experiments/widget-metal-authored-v4/work/cpu-new"
bash desktop/glyph-metal-lab-v4/gpu-test.sh "$PWD/experiments/widget-metal-authored-v4/work/gpu-new"
bash experiments/widget-metal-authored-v4/density-gpu.sh "$PWD/experiments/widget-metal-authored-v4/work/density-new"
```

通常app sourceとfixtureを複製せずに再生成する場合、generate-reference.mjsは既存fixtureを置き換えず拒否する。別の研究版へコピーし、教師出力先をその新folderに変えてからNodeで実行する。位置式を変更せず、元TS SHAとloader/package版を新manifestへ記録する。本R1 fixtureを調整や再生成で上書きしない。

Geometry R3 appのBuildInfoはapp Sources＋Info.plistのSHAを持つ。GEOMETRY-R3-SOURCE.jsonは別のfull source snapshotと教師／test／READMEも記録する。appにコピーされたMSL SHAはGPU-PREEXECUTION-R2.jsonと一致。付随metadata修正だけでgeometryが変わったと扱わない。

MSLのCreatureGeometry.metal.incは編集用fragmentで、runtimeはGlyphs.metalへ組み込まれたbodyを読む。assemble-creature-shader.pyの既定動作は両者の一致確認のみ。新しい出力fileへ再組立てする際にも既存source／appを置き換えない。

root実UI向けに人工fixtureの引数を用意した。`--fixture 1537 --shape 13 --fixture-time 24 --paused --metrics-file <new-owned-absolute-json>`など。14=鳥、15=蛇。`--state-file <new-artificial-v4-absolute-state>`も読める。fixture/state-file modeは通常保存を読まず書かない。本文／色の人工stateはv4 versionで、旧v3 storeを移行しない。通常入力の保存は専用v4 namespaceへ追記する。

pausehideの予約停止はrenderer継承sourceとCPU palette cacheで確認するが、Dock/open／CmdH／IME／実窓操作の成功はrootの実観察を別記録する。offscreen timing .76秒等はsuiteの壁時計であり、通常窓process CPUやGPU utilization、電力ではない。
