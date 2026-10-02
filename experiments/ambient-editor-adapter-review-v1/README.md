# 専用編集欄の独立レビュー

人工イベントの確定 / 取り消し / 再送と、文字の唯一のbody / IDを検算した。実DOM / 実日本語IME / OS全体入力連動の完成を示すものではない。

- [初回R1:17件中15一致・追加0/1](REPORT-R1.md)。blur待機、二重所有、破棄後の再送という不一致を保持。
- [修正R2:17/17・追加1/1](REPORT-R2.md)。破棄callback10/10と古いshape回答1/1は別の補足回帰。
- [source未読で固定したMETHOD](METHOD-R1.json) / [17抽象ケース](CASES-R1.json) / [一次仕様のメモ](SOURCE-NOTES.md)。
- [初回source hash](SOURCE-FREEZE-R1.json) / [修正版hash](SOURCE-FREEZE-R2.json)。依存の同一性を記録し、byte-identical snapshotを保持。
- [状態](STATUS.md)。共有source / UI / Gitの所有はroot。独立領域の作成だけを行った。

R2をrootの自作編集欄・実DOM比較へ進める候補とする。未知イベント0素材化、原文を保存offへ出さないことのmodule検算を、実ブラウザ由来の認証や全アプリの確定本文取得へ拡張しない。
