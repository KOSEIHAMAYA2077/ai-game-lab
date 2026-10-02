# 返却と公開用コピーの注記

候補 source/runtime は **R5 のまま不変**。R6 は返却 QA の revision であり、tokenizer 修正や追加の model 評価ではない。

原票 FINAL-QA-R5.json の検査 pattern metadata 自体に端末の local user label が入ったため、ファイルを消さず保管し、公開用 copy から **FINAL-QA-R5.json と旧 RETURN-MANIFEST-R5.json を除外**することを推奨する。場所だけを示し、検査語はここに転載しない。ユーザー本文や絶対端末 path ではないが、公開文書に不要な端末識別子である。

修正版の [FINAL-QA-R6.json](FINAL-QA-R6.json) は pattern の symbolic label を使い、保存原票以外の source/binary/JSON/docs を再確認した。候補 source・709 expected・parity・lean 原票は変更していない。新 RETURN-MANIFEST-R6.json は全 artifact の SHA を持ち、上記 2 file を publicationEligible=false とする。

README/REPORT/REPRO/PROVENANCE、BUILD-R5、PARITY-R5、LEAN-CPU-R5 は R5 の成果を参照する。R1〜R4 の実装失敗・blocked 原票も保持する。709 known regression と独立担当の追加20は別母数で、この folder の作者は追加20本文も結果も見ていない。公開操作自体は本担当で行わない。
