# 人工統合契約の公開確認

2026-10-03。専用編集欄へ接続する前の人工契約候補R3を公開する。OSの本文取得、実IME、既存小窓への接続、快適性、一般PCの性能はこの結果に含めない。

受信器は一つの材料bodyとIDを所有し、全体の追加後にACKする。形の判断は別の有限処理とし、モデル待ちで材料追加を止めない。保存offは本文、文字ID列、色順、検索文を出さない集計allowlistである。これは現在の小窓の保存仕様とは別の候補。

- [作者の結果・失敗履歴](../ambient-integration-contract-v1/REPORT.md)：元20ケース、補助8件、追加gap4件を修正後回帰として確認。実コードmutant6件を検出。
- [独立review](../ambient-integration-review-v1/README.md)：behavioral11件と追加5件を別に検算。並列producerとactivity gapのR1/R2失敗、review自身のharness不足も保持。
- [将来の専用textarea境界](../ambient-integration-contract-v1/PROTOTYPE-BOUNDARY.md)：入力元がACKまでpayloadを再帰的に凍結する条件。metadataだけでは本文の同一性を認証できない。

rootは返却された59・42ファイルのSHAを突合した。最初の公開候補103ファイルではJSON52個、相対リンク37個、限定した個人パス・credential patternを確認。root再現原票5ファイルを追加した再検査は108ファイル・JSON57個で、不一致・壊れたリンク・該当patternは0だった。これは網羅的な秘密検査ではない。[公開チェック](CHECK.json)。元のmanifestと原票は変更しない。

rootも同じR3の20ケースを再実行し、20/20、2,431 assertions、receive120、実字句検索18を確認した。原票の時刻・保存境界auditは110活動記録と20exportで違反0。独立runnerも11/11と追加5/5を再実行した。これらは同じ既知ケースの再現で、独立した未知課題の件数へ足さない。

[rootの20ケース原票](../ambient-integration-contract-v1/results-root-r3-replay/summary.json)、[audit](../ambient-integration-contract-v1/results-root-r3-replay/audit.json)、[独立11件の再現](../ambient-integration-review-v1/root-r3-replay.json)、[追加5件の再現](../ambient-integration-review-v1/root-r3-supplementary-replay.json)を保存した。

次の接続は新しい専用編集欄のadapterだけで行う。composition/input/paste/undoの実DOM順序、原文保存off、唯一のbody/IDを実操作で確認する。全アプリ取得へ広げず、既定の60形Web版を置き換えない。削除後も材料を残す方式は比較用の暫定案であり、製品仕様の確定ではない。
