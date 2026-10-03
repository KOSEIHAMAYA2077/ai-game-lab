# 無料小モデルの別比較 v1

2026-10-03、ユーザーの「BONSAI等を片っ端から入れて試す、2時間」の直接指示を受けた比較。開始13:52 JST、期限15:52 JST（UTC06:52）。15:42以降は新モデル・新機能に着手せず原票と結果を公開、今回の専用継続実行を止める。既存source・保存・URL・tag・app・モデルファイルを削除しない。

有限12形・色・個数・動きの提案JSONを、日本語人工文で比較する。無料・gateなしモデルの公式/信頼配布重みを新しいlocal folderへ取得し、固定revision/size/SHAとライセンスを確認。モデル提供のPython/シェルcodeは実行しない。一般ノートCPUの候補としてCPU4threads/GPUoffを共通基準、Metalは必要な別診断。M5/32GiBの測定は16GB Intel/AMD/iGPUの実証にしない。

fixture・prompt・schema・重み・driverを初回output前に固定し、比較途中で意味のprompt/期待値/閾値を調整しない。独立24人工文のbodyはprompt固定前に未読（相談代表2文は評価から除外）。JSON構造の成功と意味全一致、起動とquery、取得GBとRAMを別にする。失敗・timeout・互換不可も記録。画面表現の基準は維持し、モデル結果だけで既定へ採用しない。OS入力監視・本文外部送信・有料APIは追加しない。
