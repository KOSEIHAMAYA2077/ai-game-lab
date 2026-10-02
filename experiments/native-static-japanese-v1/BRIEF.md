# Native Japanese StaticEmbedding CPU v1

2026-10-03現セッションで許可された独立Swift CLI。所有はこの新フォルダのみ。既存static実験/取得済みlocal模型はread-only、新download/再学習/品質再評価/GUI/OS入力/default変更なし。Pythonは既存venvのtokenizers0.22.1とNumPy2.0.2を比較oracleの生成にだけ使う。native runtimeにはPython/NumPy/Rust runtimeを入れない。10:17 JST新機能停止、10:37期限。

hotchpotch/static-embedding-japaneseの既存128dim F16 tableをread-only mmapし、token IDs→Float32 mean→L2 normalize→caption cosine rankの移植を検証する。Unigram Viterbiの近似greedyを同等としない。元455文と人工edge期待値・METHODをSwift結果を見る前にfreezeする。失敗はR1を残しR2別source/outputにする。
