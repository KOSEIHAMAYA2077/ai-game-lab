# Metal v3: authored word surfaces

開始: 2026-10-03。凍結v2を別v3へ複製し、まずWebの剣・花瓶・クラゲをDouble referenceとMSLへ移す。旧版・保存・既定Web版・Git・共有研究文書・OS/UIは変更しない。namespace `org.glyphmatter.metallab.v3`、version `0.3.0`。rootが実窓確認・資源計測を所有する。

## Stage Aの範囲

- 旧sphere/cube/mobiusの数式とR2 cameraの既存半径・FOV・framing式を保つ。
- 新形は`word-surfaces.ts`のpatch分岐・文字ID・material drift・傘pulseと遅れる8本の腕を優先。positionと接線を同じsurface関数から計算する。
- 本文、追加色、glyph ID、順序、snapshot容量、15fps／吸収中30fps、pause/hideの周期停止を引き継ぐ。
- 自由語から形を生成しない。作者の明示語彙に該当しない入力では現在形を保つ。形選択は素朴なpopupで増やし、Enter terminalは維持する。
- new shapesのcamera radius候補は剣1.65、花瓶1.75、クラゲ2.25。各式の成分上界から保守的に選び、CPU射影とoffscreen画像で検査する。3つの旧半径は不変。

## 数値確認の方針（実行前）

1. 実際のWeb TS関数をNodeのtype strippingで読み、人工ID/seed/timeとpatch境界のfixtureを生成する。TS source SHA、generator、Node版、fixture SHAを残す。別の似た式を書いて教師にしない。
2. Double Swiftのposition/du/dvをTS componentと照合。通常frameの最大成分差候補≤1e-8、境界のposition≤1e-8。中央差分接線は差分丸めを区別して記録する。
3. MSL Float positionをTS/Double referenceと照合。既存3形の位置<0.002、接線<0.01の検査を維持。新形の位置差候補≤0.002、tangent方向差≤0.03rad、normal方向差≤0.06rad。raw tangent成分差も隠さず記録する。
4. 初回のMSL差分幅はTSと同じ1e-5で試す。Float差分の退化やroundingが出た場合、その失敗原票とsource SHAを保持して数値安定性だけの別candidateを比較する。曲面式や腕の動きを結果に合わせて作り替えない。
5. finite／同じIDのpatch保持／閉面のbackfaceと非閉面の両面／time変化／旧glyph・色・本文保持を別に検査。数値合格だけで見た目合格としない。
6. build/CPU/GPU/offscreenを別記録。UIなしのoffscreen結果を通常窓のCPU/RAMや日本語IME検証へ読み替えない。

rootの旧R5 offscreen 2h試験が進行中との連絡を受けている。今回はbuild/短いGPU検査の並走が許可されたが、資源競合がある可能性を記録し、この区間のCPU/RAMを単独描画負荷とは報告しない。Web基準3形との描画容量は最大1,536、保存32,000、種類1,024。既定60形や6 Programの代替・全移植・モデル既定採用は範囲外。

後の段階で10 word formsへ広げる場合も、Stage Aの結果を保持し、式・fixture・camera・画像を追加した別candidateとして記録する。

## Stage Aで得た差（原票保持）

- `stage-a-fd1`: CPU 2,221 assertions合格。TS 3,552 frame＋3,400 patchで最大位置成分差7.77e-16、接線1.11e-11。MSLはfinite/退化0・位置範囲内だが、長いtimeのFloat差分でクラゲnormal方向差1.153radなどがあり不採用。
- `stage-a-phase-fd1`: 同じ曲面式の周期time/seedをCPUでdrawごとに縮約し、GPUの各文字更新を保持。位置差が改善したが、細い腕のu差分方向最大0.03949radが事前線0.03を超え不採用。
- `stage-a-phase-fd2`: GPU差分幅u=1e-4、v=min(1e-4,v,1-v)。閾値は緩めず同じsurfaceのcentral differentialを安定化。旧3形504 GPU frame、新3形6,952 TS case、6形offscreenとCoreText/inkが合格（590 assertions）。新形の位置L2最大3.52e-6、normal方向最大0.01009rad。pole付近のraw dv差は剣0.3882、クラゲ0.2281もあり、raw成分の完全一致は主張しない。

各candidate source SHAと不採用reportは別名で保存。Stage Aのinstance stride80B、uniform stride272Bはcomponentの実layoutで、アプリRAM削減率ではない。画面内・1draw・1,536instanceのoffscreen6形はt24の一条件で、全時刻の画素保証ではない。

## Stage Bと蝶の退化chart（再実行前）

全10形を位置変更なしで移植。最初の`stage-b-phase-fd2`では全11,840 material＋8,000 patchのGPU位置最大5.16e-6／finite 0だが、蝶のcentral differenceでnormal最大2.61rad、退化方向40検出を保持して不採用。蝶だけ同じ位置式の解析微分に替えた`stage-b-butterfly-analytic`ではmaterial normal最大0.002611radへ改善したが、u=.5・t=0の20 wing patchでdvとcrossが数学的にゼロ（Double TS dv≈1e-17/cross≈1e-25）。一意な法線は存在しないため「退化なし」の元検査はこのchartに適合しない。失敗を合格へ読み替えず原票を保持する。

次の`stage-b-singular-policy`は位置／事前の正則方向閾値を変えず、蝶の解析接線のu=.5対称点だけsin(pi)/sin(3pi)を厳密0にしてFloat残差による架空の法線を除く。参照方向長さ≤1e-12はundefinedとしてdu/dv/normal別母数へ記録し、向き一致の主張から外す。その20点も実renderのnormalized basisはWeb `surface-frame.ts`と同じGram–Schmidt／投影後v長さ<1e-10ならstable perpendicularで全8,000 patch比較する。正則position≤0.002・du/dv≤0.03rad・normal≤0.06radは不変。raw derivative差は境界も含め報告し、CPU固定h=1e-5とGPU解析微分／h=1e-4の成分同値は主張しない。これはchart特異点の扱いで、蝶の形を変更する採用判断ではない。
