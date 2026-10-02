# 一次資料と研究計画の主張の対応

確認日2026-10-03。以下は著者または会議・出版社・公式提供元の一次資料。読んだ範囲と、本計画が自分で提案した数値を分ける。公開例文・失敗例を調整するための検索ではない。

| 資料と公開日 | URLと確認範囲 | 支持する記述 | 本計画で支持されない記述 |
| --- | --- | --- | --- |
| Yonatan Geifman, Ran El-Yaniv, Selective Classification for Deep Neural Networks、2017-05-23、v2 2017-06-01 | [著者arXiv](https://arxiv.org/abs/1705.08500)。abstractと版情報を確認 | 保留によってcoverageとriskを調整する問題設定 | 今回のcosine閾値に論文の保証があること、5%/60%が一般的な推奨値であること |
| Yonatan Geifman, Ran El-Yaniv, SelectiveNet、ICML2019、2019-06-09〜15 | [PMLR97](https://proceedings.mlr.press/v97/geifman19a.html)。abstract・書誌を確認 | 分類とrejectを統合して学習する方式がある。現方式との差を識別する入口 | 今回のtinyやstaticがSelectiveNetであること。再学習や共同学習を今回実装したこと |
| Chuan Guo et al., On Calibration of Modern Neural Networks、ICML2017、2017-08-06〜11 | [PMLR70](https://proceedings.mlr.press/v70/guo17a.html)。abstract・書誌を確認 | confidenceと実際の正解確率の一致は独立の評価課題 | cosineや未校正softmaxを、そのまま正解確率と呼ぶこと。今回temperature scalingを実施したこと |
| Zachary Pousman, John Stasko, Ambient Information Systems: Evaluation in Two Paradigms、2007-05-13 | [著者PDF](https://faculty.cc.gatech.edu/~john.stasko/papers/pervasive07-eval.pdf)。全5ページの本文を確認、特にpp.1〜3 | ambientの評価には日常の状況、時間経過、妨げ、本人の意味づけが関わるという方法論上の議論 | 数分の命令成功率で長期のambient体験を証明すること。6人5日が十分とすること。ストレス軽減の実証を今回得たこと |
| Daniël Lakens, Sample Size Justification、2022-03-22、Collabra: Psychology8(1):33267 | [出版社本文](https://online.ucpress.edu/collabra/article/8/1/33267/120491/Sample-Size-Justification)、[DOI](https://doi.org/10.1525/collabra.33267)。abstractと人数・資源制約・推論目的の節を確認 | 人数を、目的、資源、必要な情報・精度等に照らして説明する | 6人がすべてのHCI研究に十分であること。今回の合成360文や6人の統計的検出力を保証すること |
| Apple, Energy Efficiency Guide for Mac Apps、Documentation Archive、更新表示2016-09-13 | [Monitor Usage Regularly](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/MonitoringEnergyUsage.html)。本文と更新表示を確認 | 繰返しの資源測定、CPU以外の要因も含むEnergy Impact、複数の計測手段 | Energy ImpactがWであること。Appleが5%/200MiBをウィジェットの標準に定めたこと。Windowsの同じ計測意味 |

Pousman/Staskoの資料はPervasive2007 workshopの**著者position paper**で、冒頭にPervasiveの正式publicationではないと明記されている。査読済みの本会議論文や本研究の実験結果として扱わない。長期ambientの追加本文調査は別の研究調査に分ける。

主RQの誤発火5%、正しい受理60%、受理精度95%、新しいデータの件数、6人の約50分試遊、ambientの60秒窓/120秒保持、メモリ増分20MiBは**本計画の未検証の設計選択**である。15〜20fps/5%/200MiB/512MiB/30秒はrepoの候補予算を受け継ぐ値で、研究一次資料が一般的に保証した値ではない。

staticのモデル・tokenizer・mean pooling・MIT記述の一次出所、revision、hash、NumPy検査とPyTorch未実施の範囲は、[独立実装のREADME](../../experiments/static-japanese-retrieval-v1/README.md)と同フォルダの研究記録に保持されている。この文書作成でHFモデルやプログラムを追加取得していない。

## repo内の確認済み資料

- [fresh120](../../experiments/widget-student-v2-fresh/REPORT.md): 正例60、schema内44、明確な保留40、曖昧20、実query重複の限界。
- [fresh140](../../experiments/static-japanese-fresh-evaluation-v1/REPORT.md): 60形の正例80と、6primitiveに対応する27を分離。受理精度とhold誤発火。
- [Candidate A](../../experiments/widget-render-budget-v2/native-evaluation/REPORT.md): 4PID帰属、状態照合、通常窓の短いCPU/footprint比較、無効窓の保持。
- [Metal](../../experiments/widget-metal-lab-v1/STATUS.md): 3形、数値/保存検査、offscreenと実窓未確認の差。
- [Metal通常窓](../../experiments/widget-metal-native-evaluation-v1/STATUS.md): ロック中で実測未開始。
- [soak](../../experiments/widget-metal-soak-v1/STATUS.md): 進行中。文書時点で完了結果0件。
- [候補予算](../widget-first-20261002.md): 単に16GBへ収まることと、widget程度の常駐負荷の違い。
- [既存研究map](../widget-research-map-20261003.md): 将来の局所編集head等の案。今回の実装済み範囲とは分ける。

既存の研究map、共有README/STATUS、実装、例文、重み、閾値、保存状態はこの担当の編集対象ではない。ここでは新しい独立資料だけを保存した。
