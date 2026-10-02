# Glyph Matter — 文字表面の生き物を増やす独立比較 v4

元Webの作者60形を保持し、native比較の13形に魚・鳥・蛇を加えた16形候補。通常版を置き換えない。bundle org.glyphmatter.metallab.v4、version0.4.0、専用state version metal-lab-v4。黒い400×440、1popup、Enterで入力、停止／隠す／再表示はv3を継承する。

| raw code | 形 | 由来 |
|---|---|---|
| 0…2 | 球・箱・メビウス | v3の式とR2 framing不変 |
| 3…12 | 剣・花瓶・クラゲ・花・蝶・木・星・螺旋・砂時計・土星 | v3作者word surface不変 |
| 13 | 魚 | 原Web ellipsoid／尾triangle／fin＋4bone |
| 14 | 鳥 | 原Web body／首／beak／wing／tail＋7bone |
| 15 | 蛇 | 原Web tube／head＋9bone |

骨格は元creature-rig.tsのEuler XYZ／hierarchy／inverse bind／Float32 paletteを直接移した。restはtime=nullで、time0の動く姿勢とは別。CPUは最大2つの固定bone paletteを作り、過去paletteは形切替時刻で固定する。文字位置・重み・接線はGPU。GPU接線は元のrest面とLBS weight gradientを微分し、triangle seamでは元の中央u chartを保つ。fixed有限差分とはpoleのraw derivative magnitudeが異なることを実験資料へ明記した。

文字本文・ID・旧ink／atlas identityを保持。既定blue paletteとfloor30 lightingを変えない。作者語彙だけを照合し、未収録語では現在の形を保持する。語彙照合は否定／引用を理解するモデルではない。OS全入力取得、ambient接続、新モデル／依存downloadは含まない。

通常bodyは1draw／最大1536instance、instance80B／旧uniform336B、新fixed rig constant1200B。保存32000、字種1024、raw/input容量は従来と同じ。静穏15fps／吸収時30fps、pause／hideでは予約停止。成分byte数はwhole-process RAMの測定値ではない。

[固定method](../../experiments/widget-metal-authored-v4/METHOD.md)と[実験入口](../../experiments/widget-metal-authored-v4/README.md)から再現する。build／testは新しいignored work出力先を指定し、既存appを置き換えない。

```sh
bash desktop/glyph-metal-lab-v4/build.sh --output "$PWD/experiments/widget-metal-authored-v4/work/Glyph Matter fresh.app"
bash desktop/glyph-metal-lab-v4/test.sh "$PWD/experiments/widget-metal-authored-v4/work/cpu-fresh"
bash desktop/glyph-metal-lab-v4/gpu-test.sh "$PWD/experiments/widget-metal-authored-v4/work/gpu-fresh"
```

appはad-hoc署名で、notarization／Windows移植は未実施。数値とoffscreenが合格しても、実窓視認性、通常窓CPU/RSS／charged footprint、電力、8時間常用、快適性／生産性は別評価。rootが実UIと資源試験を所有する。
