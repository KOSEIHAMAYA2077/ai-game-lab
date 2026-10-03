# Bonsai task student v1 の人工seed

2026-10-03。60形の分類と、全体の長さ・幅・追加曲げの分類を試すための入力例。形のIDと日本語名は `prototypes/glyph-creature/src/language.ts` と `prototypes/glyph-creature/src/shape-catalog.ts` の現在の定義に合わせた。

このデータの文章、別名、ラベル、分割、関連ID、注意点はCodexが設計した。人間が採点した正解、実利用者の入力、Bonsaiの出力、独立した最終評価とは呼ばない。教師による合成と点検はこのデータ作成とは別に行う。部品グラフは含めない。

| ファイル | 内容 | train | dev |
| --- | --- | ---: | ---: |
| shapes.json | 60形、名称・別名、各5個の描写family | 描写240 | 描写60 |
| holds.json | 見送りの人工文、15 family | 60 | 12 |
| transforms.json | length/width各3値、bend2値、計8組の辞書 | phrase43 | phrase16 |

各形の名称は1個、別名は3〜4個（合計183個）。名称・別名自体はtrain専用で、そこから作る入力もtrainにだけ入れる。各形の描写は4 train familyと1 dev family。dev描写はその形自身の名称・別名の文字列を含まない。すべてのshape描写familyは形ID付きで、異なるshapeと共用しない。

## 分割を保つ契約

- `split: train` の文章と名称・別名のみをstudent学習や教師の訓練用合成へ渡す。
- `split: dev` の本文、意味的な手掛かり、それらの言い換えを学習用へ混入させない。教師にdevの新しい言い換えを生成させ、trainへ戻すこともしない。
- train原文の教師による言い換えは、元のshape ID、family、split、原文のIDを引き継ぐ。生成物だから別familyとして無作為に再分割することはしない。
- familyは同じ意味を持つ派生入力をまとめる単位。名前/別名からの派生入力は各形の `shape_id.name_aliases` というtrain familyへまとめる。
- devはこの作者によるfamilyを保留した調整用資料で、一般日本語への汎化や人間による意味判断を保証する最終評価ではない。

現在の文章では、train/dev間の完全な文字列重複とfamilyの共有がないことを照合した。意味の近さや共通する自然言語の単語まで消せたという主張ではない。人工的に語を避けただけで意味理解を達成したとも扱わない。

## 形の範囲と曖昧さ

`shape` は60形のexact ID、`name` は実装のcanonical Japanese name。`aliases` は今回選んだ作者の別名で、既存の検索辞書をそのまま写したものではない。`descriptions` の各要素は `{ family, text, split }`。

各形の `relatedIds` と `notes` は、描写の競合や実装の近似を示す。形の正解ラベルとして関連IDを無条件に追加する意味ではない。名称なしの花瓶/瓶、一般の花/蓮/薔薇などは文脈だけでは一意に決まらない場合があり、exact IDの一致と関連形を許容した評価は区別する。

特に `square` は名称が四角形でも等辺直角の平面、`star` は恒星一般でなく五つの尖りを持つ記号、`shell` は二枚貝一般でなく巻いた殻、`diamond` は多面にカットした近似形、`knot` は閉じた三葉結び目、`ribbon` は蝶結びを基準とする。`orbit` は複数の周回路を持つ古典的な原子模型の図式で、量子力学的な電子の実際の道という主張ではない。`droplet` は尖りを持つ涙型の図式。

## 見送りの範囲

holdsの人工文は日常の予定/進捗、抽象的な感情/判断、別語に含まれる名称の部分文字、直接の否定、取消、現状維持を対象とした。ドラゴンや城などの未知の具体物を見送りラベルにしていない。知らない具体物を近い既知形へ連想できる余地を残すためである。

直接の依頼を否定/取消する文はholdとした。引用、報告、物語で形を言及する文を一律holdにはしていない。今回はquoted否定文を収録しない。意味連想用途では、引用内の否定が自動的に全文の見送りを決めるわけではない。

抽象語や比喩の文をholdにしたのも、この作者の訓練用設計。五つ星評価/星取り/三角関係などから視覚的な連想が可能であることを否定するものではない。サービス全体の自然言語契約や人間の好みは別途確認する必要がある。

## 変形の範囲

transformsは `{ head, value, phrases: [{ family, text, split }], notes }` の配列。

- length: short / neutral / long
- width: narrow / neutral / wide
- bend: straight / curved

変更の指定がない場合はlength=neutral、width=neutral、bend=straight。`普通の` と `標準の` は全headを基準状態へするtrain phraseとして共通に含めた。phraseを含まない入力のデフォルトはこの契約で決め、空文字を学習用phraseとして追加していない。

変形ラベルは既存形の標準寸法に対する全体の変更を表す。『花瓶の首が細い』『蜘蛛の足が長い』『傘の持ち手が曲がった』などの固有特徴や一部位の寸法を、全体width/length/bendへ機械的に転記しない。螺旋、蛇、メビウスなどの同定に必要な既存の曲線があるだけでは、追加bend=curvedとはしない。straightは基準形へ追加の曲げがない意味で、既存の曲面を一直線へ潰すことではない。

形の原文をそのまま使う場合は基準変形が出発点。phraseを組み合わせた派生例では、明示された全体変更に対応するheadだけを変更する。部位を指定した変形や複数の矛盾した全体変更はこのseedの対象外。

## 保存時のSHA-256

| ファイル | SHA-256 |
| --- | --- |
| shapes.json | 9890b0cc751455a4e895cd4c60e8a9e3a574d3b42d227248151b80f211d9de51 |
| holds.json | 9def20d665f1fbca5dcbb0a73b5900a7d078027b8042dfa70944644fecf0c963 |
| transforms.json | d0d10d5f5f2e2cf61ad6e2f03e6bebebce14718755ae97b2e0095a5bddc9e96e |
