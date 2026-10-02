# Metal 3形比較の現在地

2026-10-03 / 最終候補 R5 / `desktop/glyph-metal-lab-v1`の所有は実装担当からrootへ返却。

- 既存版・保存・tag・アプリを変更／削除せず、新AppKit/Metal/CoreTextの球・箱・メビウス比較を実装。
- macOS ARM64のRelease build、ad-hoc署名・strict verification PASS。R5のsourceと実行物SHAはevaluation/artifact-manifest.json。
- CPU 1,213 / GPU 581 assertions PASS。元TSの504数値fixture、8時間後の時刻も含むFloat GPU差、原文・旧色・Unicode・容量・保存・chart seamを確認。
- Offscreen人工文字1,536の3形PNGはqaに保存。実UIの画面ではない。
- rootへR3→R4→R5を別名で渡し、全て保持。R2は保存修正前でrelease候補にしない。
- MacロックでrootのCUA操作が出来ず、通常表示のUI・calm CPU/RAM、停止・unpausedHidden・復帰の実測を延期。occludedのまま得た値を通常表示と報告しない。
- コミット・PR・公開はroot担当。本人の文章やローカル個人情報を公開資料へ含めない。

次: ロック解除後R5を同じfixtureでrootが操作し、glyphの字体／面の品質と実frame数を確かめてから資源を測る。60形／Program／学習モデルへの展開は、この3形の比較の採否後。R5を軽量化成功として扱わない。
