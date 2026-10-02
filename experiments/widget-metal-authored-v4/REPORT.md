# Metal v4: 魚・鳥・蛇の段階拡張

2026-10-03。元Webの60作者形を残し、独立native比較13形へ既存の魚・鳥・蛇を追加した**16形候補**。原TSの面・骨格・重みをCPU参照とMSLへ移した。数値／offscreen gateは通過した。実窓操作・視認性と通常窓資源の採否はroot所有の別評価であり、本報告だけで採用済みにしない。

## 固定した範囲

新raw codeは魚13・鳥14・蛇15。0…12の形を保ち、sphere／cube／mobiusと10word surfaceの位置式、camera radius、palette／floor30 lightingを変えない。旧v3の21filesはcopy時のSHAからdrift0。既存10word reference sourceとMSLの10関数bodyが同一。**旧13形の白1536／time24／400×440 offscreen PNGは全13がbyte完全一致**した。WebGL pixel完全一致や全60形のnative代替という意味ではない。

骨は魚4／鳥7／蛇9。absolute bind→parent local差分、Euler XYZ quaternion、world×inverse bind、元ThreeのFloat32 palette量子化を保持。rest=nullとpose(0)を分けた。rest surfaceはt=0で作り、原rig motionだけをかける。birdのbase flapやsnake base waveを二重適用しない。

CPUは現在／前形の最大2paletteだけを保持する。前形はswitch時刻に固定し、停止した同timeではposeを再計算しない。文字位置・weight・接線はGPU。原時刻／ID／part／seedを維持し、本文・旧ink・atlas tileのidentityを変えない。material phaseはword形と別のexpanded式。1.6秒の旧／新中心補間は継承した。

## 数値の結果

元TS／既存Three0.186.1を直接教師にした。追加downloadなし。既存Rolldown1.2.11/Oxcによるsyntax変換で原sourceを編集せず実行した。fixtureは12,060 material frames、5,559 patch points、48palette、1,656influence、rest9。source／fixture／candidate／methodをSHAで固定した。全体CPU 6,045 assertions、GPU R2 792 assertions。

| 段階／形 | CPU position最大成分差 | GPU position最大L2 | GPU du最大角 | GPU dv／basis／normalの最大角 |
|---|---:|---:|---:|---:|
| A 魚 | 8.05e-16 | 4.043e-6 | 1.24e-6 rad | .002560 rad |
| B 鳥 | 6.66e-16 | 1.160e-6 | 5.67e-5 rad | .004230 rad |
| C 蛇 | 6.66e-16 | 1.255e-6 | 2.33e-7 rad | .001548 rad |

CPU Float32 palette／joint／weight／rest差は0、rawdu／dv成分差の最大は3.33e-11。finite／influence／radius違反0。GPUのposition許容L2≤.002、du/dv角≤.03rad、normal≤.06radを結果前に固定し、失敗後も変えていない。

GPU R1ではFloat中央差分が微小な接線を失い、648方向診断で不合格。位置式とpaletteは保ったまま、R2はrest面の解析微分とLBSのweight勾配へ変更した。triangle seamは元h=1e-5の左右edge混合を再現する。魚x anchors／鳥tail yとwing abs(x)／蛇vのweight勾配を省かない。

**poleのrawdv値は原固定有限差分と完全一致しない**。R2のrawdv L2差は最大123.461（魚）、52.364（鳥）、36.737（蛇）。解析微分と固定h=1e-5のpole近傍での倍率差を、正則方向／Gram–Schmidt basisの一致から分けて記録した。今回の新3形fixtureはundefined direction0、basis fallback0だが、全時刻の特異点不存在を証明しない。vはruntimeの1e-5…1−1e-5、partは0…63（実呼出id%64）の範囲。旧蝶20特異fallbackは別の既存word評価に残る。

鳥の6秒は主なwing flap周期。root Y／neckには別時間係数があり、全姿勢が6秒で厳密反復するとは書かない。魚4.8秒／蛇7.6秒と、0／cycle fraction／24／100／3600／28800、±1e-5 jitterを教師照合に含めた。

## cameraと描画の結果

sampleにfitせず、bind pointからのleverと各rotation角上限、非負和1のLBSから魚R2.00／鳥R1.65／蛇R2.20を結果前に固定。蛇tube上界2.176099、headはそれより小さい。計算の内訳はCAMERA-PROOF.md。魚の初期説明に丸め不足のleverがあったため、全leverを上へ丸めた補足を保存した。選択radiusとgateは不変。

16×16遷移／4文字数／5補間phase／4窓／3formationの61,440bound条件で違反0。新TS 12,060frameから4窓×4姿勢×4quad頂点の771,840projectionでも違反0。旧TS 757,760verticesも別に保持。default zoomのsettled条件で、吸収中の飛行軌道や意図的な近接zoomの保証ではない。

offscreen R2は全16形の白1536／time24を1drawで描き、black marginとvisible ink gateを通過。追加の密度R2は新3形×4文字数（1／2／385／1536）×4主周期時刻×3姿勢×白／旧白＋新青の**288runs、違反0**。最小lit427pixels、count≥385の混色条件の青pixel最小1117。これはpixel presence／clip検査であり、人間の読みやすさや快適性ではない。原paletteとdark-blueの視認性課題を保持する。

密度R1はfixture出生0のままtimeを周期内へ戻し、settled-only METHODに反する吸収軌道になっていた。魚count2／t1.2 frontの2条件で下端clipを観察し、suiteをinvalidとして原票保持。R2は人工glyph born=time−20でsettled条件を満たす。通常source／appを直したことにはしないし、到着軌道のclipを解決済みにはしない。

## runtime／採否の境界

instance80B／旧uniform336B不変。追加rig fixed constantは1200B（最大18matrix＋2phase＋count）。1body draw、1536表示上限、保存32000、字種1024、raw/input容量、静穏15fps／吸収30fps／pausehide予約停止は継承する。これをwhole-process RAMが1200Bしか増えないという主張にしない。

作者語彙のみで魚／鳥／蛇を選ぶ。既存jellyfishがfish部分語へ吸収される回帰をCPU R1で検出し、旧語彙の優先順を保持して修正。未収録語は現在形を保持する。未知語理解、否定／引用／ambient意図判定、新mesh生成は達成していない。OS全入力取得／adapter接続／モデル追加は含まない。

通常窓CPU／charged footprint／resident／電力はここでは測っていない。rootの資源METHODとの整合を結果前に固定し、CPUmean≤5%（100%=1論理core）、charged≤200MiB、submit wall-time p95≤3msを別gateにした。Windows16GB/iGPU未測定、8時間v4実使用も未検証。旧R5 soakはrootから正常終了通知を受けてからGPUを始めたが、その成功をv4 soakと呼ばない。

## 返却物

Geometry R3 appとsource snapshotはGEOMETRY-R3-APP.json／GEOMETRY-R3-SOURCE.json。BuildInfo source drift0、bundled MSLはGPU R2合格sourceと同SHA。通常タイトルGlyph Matter、bundle org.glyphmatter.metallab.v4／0.4.0。source／appはimmutableにしてroot実UI用へ渡した。root記録はroot所有folderを読み取り参照し、ここから変更しない。

数値gate A/B/Cは全て通過。表面と元の動きを再現する少数形の拡張として、実UI／資源確認へ進められる。全60形採用、軽量ML、一般Windows予算、快適性／生産性の主張は別の未完了課題。

rootから、native16 CUA実操作の時点でMac lockedとなり、解除しなかったとの通知を受けた。R3 copyのopen attemptがあっても実UI成功とは数えず、relative metrics引数で原票が出なかった初回attemptもrootが保持している。本返却時点で**native16実UI／通常窓資源は未確認**。旧13のsource／offscreen完全一致と、新3形の数値／offscreen合格だけを実証済みの採否根拠にする。
