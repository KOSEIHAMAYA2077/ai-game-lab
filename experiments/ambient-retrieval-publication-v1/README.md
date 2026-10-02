# 既知形検索R1の公開確認

WordNetの元LICENSE 2件は取得時の空白を含めて保持し、SHAを変更していない。その他の公開差分は空白検査で問題0。

約200KiB候補は既定不採用。独立人工120文で正例受理22/60のうち14正解・8誤形、明確な保留への誤反応2/40。説明3/36・物語1/12であり、サイドインテリアに必要な自然文の理解は未達である。

[候補と採否](../ambient-shape-retrieval-v1/REPORT.md) / [独立した凍結・全原票](../ambient-shape-retrieval-evaluation-v1/REPORT.md) / [root公開検査](AUDIT-R1.json)。

作者44ファイル・独立26ファイルの返却SHAに差0。candidate/原source/依存の初回41pinと、追加supportの後付け3pinは別に確認した。候補・閾値は変更せず、この公開作業で候補を再呼出していない。返却manifest自身と共有文書5件を含む選択77ファイルについて、41 JSONの解析、相対リンク220件、具体的な個人パス・認証文字列の検査を行った。ここで追加した公開記録2ファイルはこの77件に含まれない。

成果はCPUの有限形候補で、未知meshの生成、OSの入力取得、実IME、全widget資源、一般16GB機、人の快適性を確認したものではない。従来60形Web・native13/16のsource、URL、保存、Releaseを変更していない。作者のCLI検証executableは配布アプリではなく、Swift sourceと再作成手順も残した。
