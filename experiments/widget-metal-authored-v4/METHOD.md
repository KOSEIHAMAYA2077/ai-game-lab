# Metal v4 — 少数の生き物を元の面と動きから移す

2026-10-03。**実行前の設計固定**。rootの通常窓資源計測中に、sourceを読むだけで検討した。現時点でv3 copy、実装、TS教師実行、build、GPU、UI、OS入力取得を行っていない。編集所有は本folderと新`desktop/glyph-metal-lab-v4/`のみ。v3・旧Web・Git・共有文書・既存保存を変更しない。

## 目的と段階

既存60作者形は元Webに保持する。独立native比較の13形を保ち、文字の面と生き物の動きを忠実に再現できる少数形を追加する。数を増やすだけの全移植、未知語から新メッシュ、モデル/全入力取得は対象外。

| stage | 追加候補 | 意図 | bone数／最終raw code |
|---|---|---|---|
| A | 魚 | 最小の4bone・Y回転chainでpalette/skin/接線の移植方法をまず検証 | 4／13 |
| B | 鳥 | 翼/手首/首/尾と6秒flap、patchとweightの境界を追加 | 7／14 |
| C | 蛇 | 9bone・XYZ回転とv沿いの滑らかなweight、7.6秒の遅れる波 | 9／15 |

Aが成立すれば14形、Bなら15形、Cまでなら16形。段階ごと別source/app/reportを保持する。不合格stageを数合わせで合流しない。魚の尾は4.8秒周期。既存13のraw code0…12、palette/depth floor .30、位置式・R2 framingを変更しない。

新namespaceは`org.glyphmatter.metallab.v4`、version`0.4.0`、state version`metal-lab-v4`。保存はv4専用へ追記し、旧snapshotを削除・移行・置換しない。UI名Glyph Matter、既存の1popup/入力/停止/隠す/再表示を維持する。

## 直接確認した経路

```text
expandedSurface: ID/seed/time → stable part=id%64, material u/v
    ↓
expandedSurfacePoint: authoredSurfacePoint(rig shape, u, v, t=0)
    ↓
skinCreaturePoint: rest pointに current world × inverse bind を適用
    ↓
expandedSurface: ±hで同じskinned pointを再評価 → raw du/dv
    ↓
surface-frame: Gram–Schmidt / singular perpendicular fallback
    ↓
1文字のplane、body全体の従来rotation/growth/arrival
```

重要な境界を固定する。

- rig対象のbase shapeはt=0。bird branchのbase flap、snake branchのbase waveをtimeで再度動かさない。動きはrig poseから来る。
- `pose(0)`は静止bindではない。魚の位相遅れ、鳥のwrist/tail、蛇の各jointに0でない回転がある。rest paletteは`pose(null)`。
- definitions.positionはabsolute bind joint。local translationはparentとの差。fish rootの.35、bird wristのparent差などを省かない。
- Threeの既存版0.186.1はEuler XYZ→quaternion→matrix compose、column-major。paletteはcurrent world×inverse bindをFloat32Arrayへ書く。native Double referenceも同じ順序で計算してpalette Float32量子化を区別する。
- ±hごとにrest pointとcreatureInfluencesを再計算する。同じtime/part/paletteを使い、中心で計算したweightを周辺点に流用しない。fish x anchors、bird attachment/tip、snake v区間のweight gradientを接線に含める。
- bird tail part>=58をwing>=28より先に判定。snake head part>=58はrootのみ。bodyはclamp(v)*8、floor/min7の2joint blend。最大3weight、非負・合計1・joint index範囲内。
- fish/bird/snakeはWebのCLOSED_EXPANDED_SURFACESに含まれない。nativeでもmultipartの両面を保ち、球のclosed coatingへまとめない。
- expandedSurfaceのmaterial driftはwordSurfaceと別（uのtime係数.018、wave.071、v.083）。既存13のphase fieldを使い回して式を変えない。

独立担当がread-onlyで、この経路・bind/local・weight再評価・time0/null・column-majorを確認した。式の実行や精度/速度の検証ではない。出所のfile SHAは`SOURCE-REVIEW.json`。

## native案と資源の境界

CPUは1bodyにつき4/7/9boneの階層poseをdrawごとに一度だけ更新し、paletteを送る。glyphのposition/weight/差分接線はGPU。現在形paletteと1.6秒morph用の過去時刻paletteの最大2bankだけとし、Webの16時刻cacheをそのまま増設しない。previous paletteはswitch時刻で固定し、currentがrigでない時にはpose更新しない。

候補layoutは既存instance80Bを不変、旧uniform336Bを保持し、別のfixed vertex constantとして現在/過去9matrix×64B＝1,152B、expanded phase2×16Bとcount/flags16B＝合計1,200B以内を送る。実layoutはbuild後にstrideを確認する。これはGPU/host component payloadの候補で、whole-process RAMを1,200Bしか増やさないという主張ではない。

1body draw、最大1,536instance、保存32,000、文字種1,024、入力/raw容量、旧文字/ID/ink/batch保持、静穏15fps・吸収時30fps・pause/hideの予約停止を継承。追加compute pass、glyph全数のCPU再構築、背景pose timer、新WebView/Three runtimeは入れない。Threeは既存のTS教師を実行するローカル検証だけで、native runtime依存にしない。

## 実行gate

1. rootの短い通常窓資源計測終了通知まで、docs/read以外を実行しない。CPU/GPU/build/教師生成は未実行。
2. 旧R5 GPU soak終了予定6:25JSTまではGPU試験を並走させない。終了を時刻だけで成功と仮定せず、rootの状態通知に従う。CPU準備の許可とGPU再開の許可を分ける。
3. gate後にv3凍結sourceを新v4へcopyし、namespace/versionのみ変えたbaseline SHAを残す。v3/oldWeb/旧app/snapshotの上書きは禁止。
4. TS教師のloaderを最初に検証する。現在Threeは既存local dependency、esbuild/tsxはその直下に無い。追加downloadはせず、既存loaderまたはNodeの解決hookで実sourceを直接読む。相対importの解決変更が必要ならimport/exportだけと位置式/bodyのSHA同値を明示する。実行していないloaderを検証済みとしない。
5. stageごとのsource SHA、教師fixture SHA、閾値、code mappingを結果前に固定。数値失敗は原票を残して新candidateで直す。fixtureを候補結果へ合わせて書き換えない。

## 数値と品質gate（結果前）

基準はv3の正則位置/方向と同等にする。Double CPU対実TSのposition最大成分差≤1e-8。Double pose→Float32 paletteの同値はmatrix成分≤1e-6、差の母数をposition/weights/matrix/raw tangentで分ける。GPU position L2≤0.002、正則du/dv方向≤0.03rad、normal≤0.06rad。raw derivative成分差も全て保持し、poleやtriangle edgeでの不一致を方向一致へ読み替えない。

新fixtureは各stageについて以下を含め、生成後に凍結する。

- time0、周期の1/4・1/2・3/4・1周、24/100/3600/28800秒。別途rest=null palette。
- seed1/42/123456/UInt32.max、ID0…63と旧端/最新ID385/1535/31999。
- 全part0…63、u=0,1/3,2/3,1等のtriangle seam、vの内部境界1e-5/.1/.5/.9/.99999。
- fishのx anchors .35/-.20/-.68/-1.18、birdのattachment .13/.43、tip .64/1.09、snakeのv=k/8を跨ぐpoint/weight（必要なら直接Influences fixture）。
- jitter±1e-5の短いtime差、raw/frame finite、skin weight非負/和/範囲、parentから子へのpose伝播、rest保持。

退化条件は元expandedSurfaceのraw tangent長さ<1e-9 fallbackと、その後surface-frameの投影後v長さ<1e-10 fallbackを区別する。v3と同様、undefinedな方向を正則normalの母数へ入れず、fallbackの有限/単位/直交と元の代替軸を別検査する。triangle edgeは位置連続でも微分が一意とは限らないことを先に記録する。

cameraはsample最大値だけにfitせず、rest面＋rig変形の上界から候補を定める。一般的なLBS boundとして、bone経路jの各rotation差の上界とrest pointからbind jointへの距離を足した変位boundを使う。birdはroot bob＋肩/手首のpath長とpatch頂点からの距離で保守上界を導ける。snakeは長いchainを角度制限無しで囲むと過大になり、小窓の文字を縮めすぎるため、XYZ角度上限とinfluenceのv区間で上界を絞る。候補radiusは証明表を別に固定してから、v3同様のfrustum/quad検査へ進む。

offscreenは固定時刻/正面・斜め・背面、文字数1/2/385/1536、白と旧白＋新青、known same IDsで確認。sphere/cube/mobius/既存10word形のgeometryと既定framingを退行させない。新形の尾・翼・頭が面として見えるか、穏やかな周期と文字の読みやすさはroot実UIで別に判定する。動く部位が見えない/clip/極端に小さい場合、数値合格だけでstageを採用しない。

## 資源と採用の判定

v3のresource結果は本設計時点で未読。比較は同じ400×440/人工1537stored・1536drawn/white/静穏15fps、同じ観察者/quiet/時間窓で揃える。現native母数とWeb60/Program6を混ぜない。新rigの4/7/9固定更新とGPU differentialの費用を、component bytes、pose更新回数、submit elapsed、process CPU/RSS、GPU/energyという別指標で示す。CPU/RSS/電力の推測値は実測にしない。

採用の最低gateは固定cap・1draw・pausehide予約停止・前形/旧本文保持を崩さず、同条件のv3基準形に予期しない増加がないこと。新rigの追加費用は実測して記録し、budgetを超える／通常作業の反応を妨げる場合はstageを保留し、閾値を結果に合わせて緩めない。Windows16GB laptop/iGPUの予算は未測定で、M5の合格から達成を主張しない。必要な絶対予算と比較基準はrootの研究METHODとの整合を取って、資源結果を読む前に別METHODへ固定する。
