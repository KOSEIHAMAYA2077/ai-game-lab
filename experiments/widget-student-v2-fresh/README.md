# Fresh 120-sentence evaluation of frozen tiny interpreters

[方法・結果・失敗・採用判断](REPORT.md)。fixtureはstudent source・model・corpus・過去評価を見る前に固定し、v1/guard-v2/明示語ルールへ同じ120文を与えた。入力は評価担当AIが手書きした合成文だけで、人間annotation・実ユーザー文は含まれない。

| 指標 | v1 | guard-v2 | ルール |
| --- | ---: | ---: | ---: |
| 厳密意図一致 / 120 | 64 | 79 | 58 |
| 表現可能正例の厳密一致 / 44 | 19 | 21 | 19 |
| 明確な保留の誤発火 / 40 | 15 | 2 | 18 |
| 曖昧文の誤発火 / 20 | 0 | 0 | 3 |

文全体のexact train/dev overlapは0件。名詞の切出し後の実primitive queryは多くがtrainと一致し、文全体未見を分類query未見と呼べない。改善15件は追加規則の正しい保留13件と属性修正2件。重み・分類閾値は同一。guard-v2を実験選択肢として優先する根拠にはなるが、自由文の無条件自動解釈や任意のtext-to-meshを実証しない。

- [変更しないfixture](fixture.frozen.json) / [SHA256](SHA256SUMS)
- [予測前に固定した採点adapter](SCORING.md)
- [全予測とscore](raw-predictions.json) / [失敗](failures.json)
- [集計と出力差](summary.json) / [時間原票](timing.json)
- [primitive query重複監査](primitive-query-overlap.json) / [query重複除外の8正例](query-overlap-exclusion-summary.json)
- [runtime作成とsource hash](runtime-manifest.json)

再実行はREPORT末尾へ。初回作成の`author_fixture.py`を評価再現時に再実行しない。fixtureの旧schema識別子`fresh-human-intent-v1`は変更せず保持しているが、人間annotationを意味しない。
