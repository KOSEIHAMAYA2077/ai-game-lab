# 公開用の入口

候補実装は R5、返却監査は R6。実験の説明は [README](README.md)、結果は [REPORT](REPORT.md)、CLI は [REPRO](REPRO.md)、一次根拠は [PROVENANCE](PROVENANCE.md) を参照する。

公開対象は PUBLIC-MANIFEST-R6.json の `publicFiles` だけ。私的 audit pattern を含んだ旧 QA と、その legacy return index は `excluded` の path/SHA/reason として記録し、公開対象には入れない。原票は保存し、本文を転載しない。

- [公開可能 artifact の QA](FINAL-QA-R6.json)
- [公開除外と返却の注記](RETURN-NOTES-R6.md)
- [固定 candidate build](BUILD-R5.json)
- [作者709の既知回帰](PARITY-R5.json)
- [native CLI の短期 CPU 原票](LEAN-CPU-R5.json)

この実装は新しい意味品質や未見語理解を示さず、default/UI/body/OS 入力へ接続していない。独立担当の追加20は別 fixture、別母数である。candidate author はその本文/結果を読まず、R5 を変更しない。
