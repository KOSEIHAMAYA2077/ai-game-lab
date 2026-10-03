# native-static wire 独立境界評価

固定R2へ手書き20 payload・予定21 replyを一回送り、20/20・21/21で事前gateに一致した。旧R5 oracle parity9件はrank完了6件とheld3件に分ける。言語意味精度・実IPC・常駐性能の評価ではない。

[REPORT](REPORT-R1.md)、[事前METHOD](METHOD-R1.md)、[fixture](CASES-R1.json)、[結果](evaluation-r2-first/RESULTS.json)、[SOURCE-PIN](SOURCE-PIN-R2.json)。本文はすべて評価用の人工文で、実ユーザーの文章は取得していない。

再現はrepo rootから行う。既存結果を上書きしない新output名にする。固定旧R5・model/tokenizer/table/captionが用意されている環境だけで実行可能。候補の改善や新fixtureとしては扱わず、同じ境界の既知回帰になる。

```sh
python3 experiments/native-static-wire-review-v1/evaluate_r1.py --candidate experiments/native-static-wire-v1/work/NativeStaticWireR2 --pins experiments/native-static-wire-review-v1/SOURCE-PIN-R2.json --run-dir experiments/native-static-wire-review-v1/evaluation-r2-replay-01
```

公開候補manifestはsource/docs/合成原票だけを選ぶ。実行binary/model tableは含めない。rootが公開と採否を所有する。
