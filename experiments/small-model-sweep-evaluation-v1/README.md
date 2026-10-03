# 新小モデルの独立24文評価

2026-10-03。モデル返信の前に新しい人工日本語24文・期待値・厳密JSON採点器を固定した。既存の試作、モデル、評価は変更しない。有限12形の候補を選ぶ契約であり、任意3D生成やwidgetの完成検証ではない。

- [21保存実行の結果と限界](REPORT-R1.md)
- [事前固定の方法](METHOD-R1.md) / [人工24文と期待値](cases-r1.json) / [凍結SHA](FREEZE-R1.json)
- [採点器](score.py) / [人工自己検査16件](SELF-CHECK-R1.json)
- [実行driverのsource境界確認](RUNNER-SOURCE-REVIEW-R1.md)
- [主採点の集計](results-r1/CHECKPOINT-R3.json)
- [結果後に依頼された部品別診断](results-r1/CHECKPOINT-R3-diagnostics.json)
- [保存HTTPと未修復exportの照合](results-r1/CHECKPOINT-R3-export-audits.json)

主指標は全5項目一致 /固定24件。最高値はこの21実行ではBonsai4B Q1の17/24。形式の成功、shapeだけの一致、処理速度を意味全体の成功へ読み替えない。共有runtimeで起動失敗した2実行は未試行として別に残す。

ここでの採点担当はmodel起動・download・GUI操作を行っていない。実行はrootが所有する。sourceと原票を再読した機械的な集計・追加診断のhelperは、最初の保存結果を見た後の作成として明記し、固定した採点器や期待値を変更していない。
