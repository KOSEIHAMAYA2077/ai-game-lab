# 独立120文: 形候補検索の比較

文章から既存60形を選ぶR1 retrievalの、作者に本文を渡す前に固定した人工120文による比較。Human0。既定採用は見送り。fullは正例14/60、clear誤反応2/40、曖昧保留18/20。説明3/36、物語1/12で、意味から自然に形を選ぶ品質は不足していた。

[結果と限界](REPORT.md) / [事前METHOD](METHOD-R1.json) / [固定fixture](FIXTURES-R1.json) / [層別集計](SUMMARY-R1.json) / [全840 API原票](RESULTS-R1.json) / [独立算術](AUDIT-R1.json)

repo rootから保存原票の算術を再現:

```sh
node experiments/ambient-shape-retrieval-evaluation-v1/replay-r1.mjs
```

model呼出し0・出力変更0。APIの受理とraw rank、全文と実query overlap、初回source pinと事後SUPPORT補足を分けた。ユーザー本文・OS入力・GPU・実UI・常駐負荷の実験ではない。元版/source/threshold/原票/Gitを変更していない。
