# Frozen tiny interpreter: fresh 120-sentence evaluation

2026-10-03。**guard-v2を、保持したv1より保守的な実験選択肢として採用することは支持する。ただし、自由文の自動解釈へ一般化する成績ではない。** 全120文の厳密な意図一致はv1 64/120、guard-v2 79/120、明示語ルール58/120。guard-v2の改善15件は、追加規則による正しい保留13件と寸法の修正2件である。学習済み重み・分類閾値は変わっていない。

この文と意図ラベルは**評価担当AIが、実装を見る前に手書きした合成例**である。人間の注釈・二重確認は実施していない。文全体の学習/devとの完全一致は0/120だが、実際の分類器は明示名詞を短く切り出す。v1のprimitive分類クエリ150回のうち129回、guard-v2の132回のうち112回は、正規化後に学習例と完全一致した。**文全体が未見であることと、分類クエリが未見であることは異なる。** この制限を「独立120文」という呼称から除かない。

## 主結果

| 指標 | v1 frozen | guard-v2 frozen | ruleProgramResolution |
| --- | ---: | ---: | ---: |
| 厳密な意図一致 / 全120文 | 64/120 (53.3%) | 79/120 (65.8%) | 58/120 (48.3%) |
| 構造のみ一致 / 全120文 | 72/120 | 85/120 | 69/120 |
| 意味のある要求で生成した数 / 60文 | 32/60 | 30/60 | 35/60 |
| 意味のある要求の厳密一致 / 60文 | 19/60 | 21/60 | 19/60 |
| 表現可能な要求の構造一致 / 44文 | 27/44 | 27/44 | 30/44 |
| 表現可能な要求の厳密一致 / 44文 | 19/44 (43.2%) | 21/44 (47.7%) | 19/44 (43.2%) |
| 明確な保留での誤発火 / 40文 | 15/40 | 2/40 | 18/40 |
| 曖昧文での誤発火 / 20文 | 0/20 | 0/20 | 3/20 |
| 保留＋曖昧での誤発火 / 60文 | 15/60 (25.0%) | 2/60 (3.3%) | 21/60 (35.0%) |
| 表現範囲外の関係で生成した数 / 16文 | 4/16 | 2/16 | 3/16 |
| 全文での生成数 / 120文 | 47/120 | 32/120 | 56/120 |
| 生成Programのschema通過 | 47/47 | 32/32 | 56/56 |
| 生成Programのcompiler通過 | 47/47 | 32/32 | 56/56 |
| 生成Programの有限点検査通過 | 47/47 | 32/32 | 56/56 |

厳密一致は形の個数・種類・関係方向と、注釈した寸法を要求する。構造のみ一致は寸法を除く。保留・曖昧では`program: null`だけを正解とする。schema/geometry通過は、文の意図が正しいことを保証しない。

表現可能な44文は、単体36文とabove/below関係8文。厳密一致の内訳は単体v1 17/36、guard-v2 19/36、ルール17/36、関係は3方式とも2/8であった。今回のfixtureはschemaを知らずに作ったため、左右・内側・前後の関係16文を含む。これらの保留は適切な有限範囲の挙動だが、凍結した「生成を意図する」注釈は書き換えていない。全60文の意図達成率と、表現可能44文の率を別々に示す。この集合にend/through要求は含まれないため、その関係の新しい性能は検証していない。

## 作成と凍結の順序

1. 評価担当は`AGENTS.md`と依頼の範囲（6形・最大2部位＋1関係）だけを読み、既存のstudent source・重み・corpus・評価例を読まなかった。過去の90文の内容も見ていなかった。
2. 120文を記述し、期待する意味を同時に注釈した。日本語60・英語60、意味のある要求60・明確な保留40・曖昧20。6形はsphere/box/cylinder/torus/blade/vase。意味のある要求には単体36・二部位関係24を含む。
3. `fixture.frozen.json`と`SHA256SUMS`を保存し、runtimeを見る前に主担当へハッシュを通知した。その後fixtureは変更していない。
4. 既存のfreeze検査を通し、実装可能なschemaと採点adapterを確認した。採点基準を[SCORING.md](SCORING.md)へ保存してから予測した。
5. 3方式へ同じ120文を与え、出力をそのまま記録した。保留を他方式で救済しなかった。追加の学習・重み変更・分類閾値変更はしていない。

Fixture SHA256:

```text
df7105b2f8bd134944ca2029fcd215eed987bc3164d5e06cd32bc49fa3409f45
```

合成文には方向別の寸法、近い言い換え、文の断片、複数節、親子の言及順の逆転、形と無関係な否定、引用された提案、code、取消を含む。明確な保留40文の内訳は否定8・引用8・code6・非対応形8・矛盾6・取消4。曖昧20文は未決定の選択・関係・参照、比喩、曖昧な形容を含む。恣意的に成功を選んだ実入力の抜粋ではなく、評価担当の判断に基づく小規模な合成challengeである。

## 何が学習で、何が規則か

| 担当 | 実装 | この結果で言えること |
| --- | --- | --- |
| primitive label | 文字n-gram＋単語featureを4096次元へhashした量子化線形softmax | v1/guard-v2とも、全必要primitive headを得られた正例51件中48件でshape inventoryのraw top-1が一致。方向・寸法・閾値通過を意味しない |
| relation label | 名詞・色・属性を規則でマスクしたrelation head | v1は43文で呼び、4件を生成。guard-v2は41文で呼び、2件を生成。accepted 2部位の接続labelは学習済みheadだが、範囲・順は規則 |
| 名詞の切出し・句の範囲・親子順 | 明示aliasと構文規則 | 学習による一般的な構文理解ではない。同じ物体をtorus/ring等で言い換えて繰り返すと2部位と扱われる例がある |
| 寸法 | 明示語規則、guard-v2の局所補正 | strict改善2件は`円柱を低く、ずんぐり...`と`花瓶の胴を横に広く...`。学習の改善ではない |
| 保留 | v1否定/score/margin/coverage＋guard-v2の引用/取消/矛盾等 | strict改善13件は新しい正しい保留。未知のあらゆる文章での誤発火防止を証明しない |
| 作れるProgram | validator/compiler、有限の材料・表面検査 | このfixtureでは元v1の生成も全て通ったため、compiler guardによる新しい改善は観測しなかった |

v1とguard-v2で18文の出力が変わり、strict改善15・悪化0。残り3件は、既に正しかったsquat寸法の幅変更1件と、左右関係を誤ったendとして生成していた2件の保留化である。後者はschema方針として改善だが、元の生成意図が未達なのでstrict正答には加算しない。証拠kindの回数は[summary.json](summary.json)へ残した。これらはコード上の担当と出力差の説明であり、各処理を外して比較した独立の因果ablationではない。

## 重複と独立性の限界

元corpusはtrain1,815行、dev478行。全120文について原文完全一致・NFKC/lowercase/空白正規化後完全一致を検査し、train/dev双方0件だった。したがって全体文のexact train overlapを除外した成績は同じ分母120・同じ値である。[summary.json](summary.json)にfullとwithoutExactTrainOverlapを別項目で残した。

分類クエリの監査では、凍結sourceのalias spanを再構成し、公開score関数の出力が保存したcandidate配列と完全一致することを全primitive callで確認した。v1は150 call中129、guard-v2は132 call中112がtrainのprimitive文と正規化後一致した。devとの一致は双方0。正例60文のうち双方52文で少なくとも1つの実queryがtrainと一致した。同じ残り8正例（分類前の保留も含む）ではstudent v1/guard-v2のstrict成功は双方0/8、ルールは2/8であった。[query-overlap-exclusion-summary.json](query-overlap-exclusion-summary.json)。relation queryのexact overlapはこの追加監査で検査していない。

この評価は学習データの新しい語彙一般化、任意物体の生成、一般的な文章理解、実利用時の分布を証明しない。今回の人間annotation不在、評価担当が6形と二部位方式を知っていたこと、短い人工文中心であることも残る。guard-v2は過去の90文の失敗を見て設計された修正版であり、今回fixtureのfreezeより前にその変更は完了していた。今回の120文が以後の修正で参照された場合、この集合は回帰集合になり、新たな未見評価とは呼べない。

## 残った失敗

guard-v2の明確な保留誤発火は次の2件。両方ともcompiler・有限表面検査は通るので、数値的に作れることと正しい指示を受けたことを混同できない。

- `fresh-066`: `Please avoid making a box.` → boxを生成。英語avoidが取消・否定規則に入らない。
- `fresh-100`: `Stop the torus request; add nothing.` → ringを生成。英語stop/add nothingが保留規則に入らない。

正例でも`I don't care about the color; make a sphere.`、`説明はいらない、立方体を表示して。`、`No animation is needed. Please create one cube.`は文全体の否定規則で保留になる。`小ぶりな花器`、`doughnut`、`刀身`、`cylindrical column`の語彙・alias不足、奥行きの浅さ・little/oversized・横幅の表現の欠落がある。`円柱が下、トーラスが上...`や`刃を左、花器を右`は未認識の第二形を無視して単体を生成し、二部位意図を満たさない。全失敗・出力・candidate scoreは[raw-predictions.json](raw-predictions.json)と[failures.json](failures.json)へ保持した。

## 時間と幾何の範囲

このMacのNode v26.4.0 / arm64 / darwin、単一JS thread。短い120文を10周（方式ごと1,200 call）してwarmed時間を計測した。各cold値は新しいNode process3回の中央値。

| 時間（ms） | v1 | guard-v2 | 明示語ルール |
| --- | ---: | ---: | ---: |
| warmed complete resolution median | 0.029 | 0.064 | 0.0015 |
| warmed complete resolution p95 | 0.081 | 0.646 | 0.0025 |
| module import median | 1.081 | 1.315 | 0.247 |
| 最初の単体解釈 median | 2.047 | 5.524 | 0.815 |
| 続く最初の二部位解釈 median | 1.481 | 3.676 | 0.825 |

guard-v2の記録する`classifierMs`はv1全体（規則を含む）の時間で、median0.027/p95 0.072ms。`guardMs`はwrapper・規則・compilerを含み、median0.018/p95 0.619ms。分類・保留・コンパイルを一つの「純粋なモデル推論」にまとめない。別の公開score関数への全文cost probe（actual名詞/マスクqueryとは異なる）はprimitive median0.022/p95 0.053ms、relation median0.021/p95 0.050ms。

headのlazy decodeは最初の単体でprimitive、続く二部位でrelationを展開することをheadCount/bytesで確認した。展開後のint16＋known bitsetはprimitive57,856＋relation33,280＝91,136bytes。元と同じbase64/int16 decode loopのみを別途20回計測した補助値はprimitive median0.134ms、relation median0.387ms。これはmodule parse・feature生成・softmaxを含まず、cold totalへ加算するものではない。

各生成Programでschema・compilerを確認し、各部位でtimes0/10/100・seeds1/17/64・各64 IDs＝576点とdu/dvを検査した。計v1 29,376点、guard-v2 19,584点、ルール36,864点で非有限値は0。すべての時間、長期常駐、画面の視認、関係の見え方、文字吸収、実IME、native widget全体RAM/CPUを検証したものではない。解釈だけの時間を「入力から形と文字が形成される全工程」とは呼ばない。

## 採用判断と再実行

guard-v2はv1より誤発火を減らし、追加規則の役割も追えるため、**実験選択肢での比較に採用する候補**とする。表現可能な正例strict21/44、取消と否定の残存誤発火2/40、範囲外の第二名詞を落とす例があるため、任意の執筆文を無条件に自動生成へ渡す標準処理としては推奨しない。保留に他方式を自動でfallbackする変更も、この結果に含まれない。UI・標準形の変更・公開反映は主担当の別作業である。

凍結の検査後、実験専用runtimeへ同じsourceをstripして実行する。元のbuild scriptは共有`.local`へ出力するため、この担当は同等処理を自分のruntime内へ保存した。新しい依存・モデル取得・外部APIは使っていない。

```sh
python3 experiments/widget-student-guard-v2/verify_freeze.py
node experiments/widget-student-v2-fresh/build_runtime.mjs
node experiments/widget-student-v2-fresh/evaluate.mjs
node experiments/widget-student-v2-fresh/query_overlap.mjs
```

`author_fixture.py`は初回作成の記録であり、評価の再現時に再実行しない。再生成で日時やhashが変わる。runtime/source hashは[runtime-manifest.json](runtime-manifest.json)、全出力は[raw-predictions.json](raw-predictions.json)、集計は[summary.json](summary.json)、時間原票は[timing.json](timing.json)、primitive query監査は[primitive-query-overlap.json](primitive-query-overlap.json)。fixture・重み・閾値・元sourceを変更する追試は別版・別の未見fixtureへ分ける。
