# GPU R2: 原位置を保つ解析接線

R1は位置／finiteには合格したが、同一Float座標の中央差分が小さい接線を失った。R1全648diagnosticを保持し、position/palette/weight式と教師fixture、position .002／du,dv .03rad／normal .06radの閾値を変えない。

R2は各rest surfaceの解析du/dvを計算し、`Σ[w Mlinear(dp) + (dw) M(restPoint)]`でLBS接線を得る。fish x anchors／bird tail y・wing abs(x)／snake vのsmooth weight derivativeを含める。位置は元creaturePointのまま。beak端・ellipsoid poleの微小接線にtranslationを足して引く操作を避ける。

triangle uはWebの固定h=1e-5中央差分が境界を跨いだ時の左右edge slopeを、距離に応じて混合する。解析片側edgeで勝手にWebのseam basisを変えない。vのsqrtとellipsoid poleは解析微分なので、Double固定hの有限差分とはraw magnitudeが異なり得る。raw derivative誤差、regular方向、basisを別々に全件報告する。魚finのabs(cos) kinkもh=1e-5を跨ぐ時だけ左右の中央差分を採る。これはsourceのsmooth/triangleの式から導出した候補で、fixtureから学習した係数を加えない。

R1のnormal.undefined=0、basis fallback=0はそのfixtureでの結果であって、全形・全時刻に特異点が無いという主張ではない。R2も同じ固定fixtureを回帰として使い、新しい教師holdoutや新語理解の評価とは呼ばない。各stageの最大値と診断を再度保持し、通らなければ次のcandidateへ分ける。
