# Frozen student: independent development review

対象は AI が作成した同一の train/dev、教師の採用文、固定済み五候補のモデルと訓練ソース。現在の holdout 本文・予測は読んでいない。既存ソース、訓練データ、モデル、設定を変更せず、開発用の記録から再集計した。これは人間がラベルを付けた正解データではない。

## 形分類の dev

数値は正答件数。raw は形 head の Top1、gated は固定された判定条件を適用した結果。全五候補の dev は同一。

| 候補 | 全体 raw /1212 | 全体 gated /1212 | 形名あり raw /960 | 名称なし raw /240 | 名称なし gated /240 | hold raw/gated /12 | 3群均等平均 gated |
|---|---:|---:|---:|---:|---:|---:|---:|
| char seed | 985 | 975 | 960 | 13 | 3 | 12/12 | 0.670833 |
| char Bonsai4 | 985 | 975 | 960 | 13 | 3 | 12/12 | 0.670833 |
| char Bonsai8 | 988 | 979 | 960 | 16 | 7 | 12/12 | 0.676389 |
| static seed | 1041 | 1041 | 955 | 77 | 77 | 9/9 | 0.688542 |
| static Bonsai8 | 1033 | 1033 | 951 | 73 | 73 | 9/9 | 0.681597 |

1212行のうち960行（79.2%）が既知の形名を含む変形文で、名称なしは60個の独立した描写 family を四通りに包んだ240行。hold は3 family の12文。このため char の985/1212＝81.27%から、名称なしの意味理解が良好とは言えない。char seed/Bonsai4 の名称なしは raw 13/240＝5.42%、gated 3/240＝1.25%。同一 family の四つの言い回しは独立した意味例ではない。hold 12/12も広い安全性を立証する数ではない。

3群均等平均は「形名あり」「名称なし」「hold」の正答率の算術平均であり、61分類の class macro accuracy とは異なる。char の gate は dev の正の形と hold を二群で均等に扱って選び、static は上記三群を均等に扱って選んでいる。char は score=0.1/margin=0/coverage=0、static は score=0/margin=0を固定している。

## 変形 head の dev

形 gate を通す前の各属性 head の正答件数。長さ・幅は1032行中792行が neutral、曲がりは912行が straight。形が hold になった際の返却属性を含む end-to-end 指標ではない。

| 候補 | short /120 | long /120 | neutral length /792 | narrow /120 | wide /120 | neutral width /792 | curved /120 | straight /912 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| char seed / Bonsai4 / Bonsai8 | 0 | 0 | 792 | 0 | 0 | 792 | 0 | 912 |
| static seed / Bonsai8 | 9 | 90 | 598 | 31 | 35 | 631 | 58 | 727 |

char の長さ・幅792/1032、曲がり912/1032は、すべて既定値を返した結果で、非既定の正答は0。static は非既定が長さ99/240、幅66/240、曲がり58/120で、属性の class macro accuracy は順に0.526684、0.448906、0.640241。static の二候補の属性 head は byte-identical。

属性契約は、全体への長さ・幅・曲がりの指示がなければ neutral/neutral/straight。首が細い、脚が長い、もとの形が曲線であるなど、形の固有特徴を全体への変形指示に転記しない。教師文は shape train だけに追加し、属性への再ラベルを行っていない。

## 独立点検の範囲と結果

- 固定記録の全19ファイルの SHA-256 が一致。モデル5個、corpus5個、train/dev/教師/特徴ソースを特定した。正確なハッシュは [dev-grouped-all-five.json](dev-grouped-all-five.json) の `sha256`、`candidates` と [static-audit.json](static-audit.json) にある。現在の char 推論ソースのハッシュも別項に記録した。
- static は train/dev の文字列・family を分離し、train だけから `N/(K*classCount)` のクラス重みを計算する。各クラスの重み付き件数は同じになり、行平均の重みは約1。属性の train 件数は short/long 300ずつ、neutral 2283、curved 300、straight 2583。
- static の4設定（lr 0.02/0.06 × l2 0.0001/0.005、160 epochs、batch128）の選択は dev のみ。保存された4試行の最大値、選択されたモデルの dev 成績、24通りの gate 探索を再計算した。未採用の三設定を再訓練して値を独立再現したわけではない。
- static の1212種類の dev 特徴を再生成し、全4 head の Top1/score/margin が保存記録と一致。特徴・パラメータ・確率は全有限。行列演算が数値警告を出したため、別の float64 スカラー積でも確認し、全 Top1 が一致、最大確率誤差は8.55e-7以下だった。
- static seed/Bonsai8 の corpus は対応する char seed/Bonsai8 と同じ。教師追加前後で全 dev、元 seed、属性データと属性 head、固定特徴モデルが同じ。r3の採用48文からshape train192行を追加する。Bonsai4はr2の採用18文から72行。両教師の sourceFamily は train の描写だけに遡る。
- char の Python/JS は修正後の通常40例で特徴・Top1・属性・gateが一致。U+1C89/U+1E030の2例は Python/Node の Unicode 版差が残るため対象外として記録。旧差分も保存している。詳細は [REPORT-R2.md](REPORT-R2.md)。

教師の比較は同じ方式内の追加文による比較で、Bonsaiの重み・logits・hidden statesの転送ではない。char と static は特徴、クラス重み、学習設定、gate選択目的が異なるため、その差を教師追加の効果に帰属させない。Bonsai4/Bonsai8は採用文数も異なるのでモデルの大きさだけの比較でもない。

再集計: 既存 `.local/static-japanese-v1/venv/bin/python -B` で [dev_metrics.py](dev_metrics.py) と [audit_static.py](audit_static.py)。これらは review 内に結果を書き、訓練済み成果物には書き込まない。
