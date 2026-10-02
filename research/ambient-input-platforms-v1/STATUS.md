# 調査の状態

2026-10-03。独立調査を完了し、この新しいresearchディレクトリの編集所有をrootへ返す。

- Apple/Windows/VS Code/Obsidian/CodeMirrorの一次資料とmacOS 26.5 SDK宣言を読み取り確認した。
- キー活動、IME確定、文書差分、snapshotの区別をまとめ、platform比較、権限、負荷、provider限界、低負荷の段階案をREADME/SOURCESへ記した。
- 公式型定義2件はcommitとSHA256で固定。SDK headers7件のSHAも保存。本文の転載、個人資料のコピーはない。
- 非監視のschemaと人工28ケースを設計。JSON構文・参照・必須／追加field等だけを確認。完全validator・semantic reducer・実IME試験は未実行。
- OS監視、権限要求、設定変更、IME変更、clip読み、実ユーザー本文取得、Git commit/publicationは行っていない。既存アプリ・保存・凍結soak source/recordは変更していない。

推奨順序は、人工replay→明示editor連携→許可された場合の活動量helper→対象appを限定したAX/UIA互換。普遍的な確定本文APIとして宣伝しない。VS Code公開eventにはIME確定状態が無い点を、今後の実装でも保つ。

既存Metal soakの監視はrootへ返却済みで、この調査中に走行や期限を変更していない。完了予定04:35:33 JST、通常window性能を証明する試験ではない。
