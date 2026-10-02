# 新rigのcamera上界

CAMERA-METHOD-R1.jsonは候補位置の実行結果を読む前に固定した。以下はsample fittingではなく、全時刻を覆う式の上界。Float丸めに対して最後のradiusを上に丸める。旧13のradiusとprojection式は不変。

LBSのweightは非負で和1なので、各influencing boneで囲めば混合も囲める。角度θの回転がrest jointから距離Lの点を動かす量は高々`2 sin(|θ|/2) L ≤ |θ| L`。祖先経路の回転を根から一つずつ導入する。後続が静止bindにある段階ではpointからそのjointへの距離はrestの距離、既に導入済みの祖先は剛体変換なので距離を変えない。この経路の各上界を足す。

魚はtail頂点のrest norm≤1.5041。Y角上限はroot .018/body .065/tail-base .21/tail-tip .09。各jointでweightがある最大leverを保守的に1.827/1.327/.937/.669と囲むと、変位は`.018×1.827 + .065×1.327 + .21×.937 + .09×.669 < .3764`。head/body/finは同じまたは短い経路に収まる。総量<1.881なのでR2.00。

鳥wingのshoulder bind norm=.282843。shoulder→wrist長は`sqrt(.52²+.08²)=.52612`。wing三角形とz波はshoulderから最大約1.263、wristから最大約.743。肩だけならnorm<1.546、肩＋手首なら<1.553、root bob .028込み<1.581。首/head/beak/body/tailはより小さい。R1.65。root Y回転は原点まわりでnormを変えない。

蛇joint jのweight支持は`v ∈ [max(0,(j−1)/8), min(1,(j+1)/8)]`。祖先kの量は`a=k/8`、XYZ角の絶対上限`(.008+.035a, .008+.070a, .008+.045a)`。XYZ quaternionのscalarについて`|w| ≥ Πcos(axis/2) − Πsin(axis/2)`を使い、`θk ≤ 2 acos(lower)`と囲む（この範囲でlower>0）。支持区間から祖先kまでの最大v距離dを取り、center横の楕円chordは`1.02 sin(π1.3d)`、`d≥1/2.6`なら1.02を使う。y差は2.3d、tube radius≤.15なのでlever `Lk ≤ hypot(chord,2.3d)+.15`。経路の`Σ 2sin(θk/2)Lk`が最大.709854。rest norm≤`sqrt(.51²+1.2²+.18²)+.15=1.466245`、総量2.176099。headはrootだけで、center norm+.28+root変位<1.544。R2.20。

有限fixtureがこの半径を超えないことは別の回帰検査であり、上の全時刻証明の代わりではない。manual zoomと到着軌道、実窓の見やすさは別評価。

独立read-only担当はrig/weight式との対応と支持区間を確認した。数式内訳が当初JSONだけでは不足していたため本文を追記したが、2.176099の独立実行認証を受けたとは書かない。
