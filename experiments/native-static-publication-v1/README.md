# 日本語native CPU候補の公開確認

作者のR5候補、既知709の回帰、独立手書き20、artifact-informed特殊token4を別母数のまま公開する。8MiBは固定F16表で、作者CLIのpeak43.53MiBは1382人工callの短い観測。全widget、一般16GB機、Windows、意味精度、3D生成の証拠ではない。

- [候補の公開入口](../native-static-japanese-v1/PUBLIC-README-R6.md)
- [独立配備レビュー](../native-static-japanese-review-v1/REPORT.md)
- [root保存資料の確認](AUDIT-R1.json)

rootはこの公開監査ではモデルを追加実行せず、保存値の独立再計算、43固定参照、作者65publicFilesとmanifest自身・RETURN-R7、review33ファイルとmanifest自身のSHA/bytes、JSONと相対リンク、具体的な個人パスを確認した。作者の私的旧監査3ファイルは原票をローカルに保持し公開対象から除いた。source・binary・expected・gateを変更せず、初回失敗と既知修正回帰を残した。

独立reviewの20はcandidate source/709未読で固定したが、空文字1件は709と完全一致し、既知Unicode機能との重なりもある。4はtokenizer artifactを読んだ後の補助。新しい意味品質に合算しない。保存709の算術は別709件、追加native call0。

外側入力frame制限、本文を含まない応答、形の受理・否定・曖昧のpolicyは未整備なので、既定body/OS/UIへ接続しない。長期CPU CLI補足は別experiment・別workloadで進行中であり、この短batchの値に足さない。旧Web60形、旧URL・アプリ・保存を維持する。
