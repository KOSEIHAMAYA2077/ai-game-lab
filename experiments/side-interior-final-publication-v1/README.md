# 100分原票と研究の入口の公開確認

保存済みmanifestのbyte/SHA、JSON、localリンク、具体的なprivate絶対pathを確認した。[照合原票](AUDIT-R1.json)。図は実際に開き、軸・母数・UI/GPU除外・CPU丸めの注記を確認した。

対象は人工入力の単独CPU観測と、既存資料を照合した研究の入口。source/fixture/rawを変更せず、model/UI/OS/GPUの新しい実行は0。100分runのdriver/time/nativeは正常終了後に不在を確認。heartbeatと期限付きcaffeinateの終了は、この時点では未実施なので別の終了記録へ残す。

凍結したMatplotlib SVGにはpath-dataの行末空白が1016件あった。元のSHAを保持し、この生成画像だけblank-at-eolの属性例外を指定した。[元の検査記録](WHITESPACE-R1.json)。通常sourceの空白違反は0。追加後の[公開集合の最終照合](AUDIT-R2.json)も保存した。
