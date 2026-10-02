# 事前固定 METHOD R1

2026-10-03。独立120文の本文・ラベルを未閲覧。既存fresh120/static140の失敗は開発に使用しない。本資料と実装・weight・dev・依存をFREEZE-R1.jsonで固定してから、独立担当が初回評価する。評価後このfixtureへ調整しない。既定版/native13/16への接続・採用は行わない。

## 問いと単位

任意の仕事/創作文の一つの512 UTF-16 code unit以下の窓から、既知60形の一つを保守的に提案できるか。形を変える命令の解釈器ではない。全入力の文字を身体へ蓄積する仕組みとは別。現在形を引数で受け、保留時nextShapeを保持するだけでrenderer/body/saveを触らない。独立窓単位であり、履歴の蓄積・低頻度scheduler・文書diff・IME・OS入力・undoは未接続。曖昧な芸術的連想には唯一正解を主張しない。

## 固定資料、fitと開発の区分

- 60形enum/日本語名/作者alias（inventory.json）。追加したのは既存language.tsの正規表現に明記されたbase22 aliasの有限文字列化。部分形名の一般展開や学習は行わない。
- 選別WordNet427行/404 unique terms/74 noun synsets（dictionary.json）。同synsetのsynonymのみ。shape対応とsense選択は作者判断で、WordNetの形推薦ではない。OMW commit 406bf83b3c507a3d1f26e88252d5d66893fd36bf。元licenseをlicenses/へ同梱。
- 作者VISUAL_GRAPH20node（graph.json）。重みは既存の芸術的選択。最大3nodeのcycle-free pathで .9×edge×form、形ごとの最大を前計算する。hypernym/外部知識/learned relationは増やさない。
- 74選別synsetのEnglish definition/lemma（profiles-source.json）。全alias/同義語/graph語/definitionを各60shape profileのfeature集合へfitする。binary TF、IDF=ln(61/(df+1))+1、各profileをL2正規化。統計fitはこれだけ。分類器・dense embedding・勾配学習なし。資料に完全に含まれるqueryは新語理解ではない。
- DEV114文（canonical60＋作者positive24、hold20、ambiguous10）と最初のpilot8を保持。作者＝実装担当、Human0、未見評価ではない。数値閾値は最初のweight buildで定め、dev/pilotを見ての閾値探索はしていない。実装前半で同spanの異なるchannelが混ざる問題を修正。pilot8初回はR0weight。R0からR1はalias/graphをjoinしたため生じた人工English bigramを除き、各term/definitionを別々に特徴化する修正のみ。両weight・全pilot出力を保存。

## query、特徴、ranking

生入力とNFKC/lowercase後の入力をそれぞれ512 UTF-16以下と検査し、超過は切り詰めずhold。型がstring以外、空、引用だけもhold。surrogate pairを文字長1と換算しない。固有表現/係り受け/意図の解析はない。

全queryに対し845 termを有限走査。ASCII termは[a-z0-9_]境界、alias/同義語の日本語は前後が日本語字でないか限定particle「のはがとをにでへやも」の境界を要求する作者heuristic。形態素解析ではない。graph句の日本語は既存の緩いsubstring。最長overlapが先、同長はstart→kind辞書順（alias, graph, synonym）。同じspan/term/kindのみshape集合を合併。他channelが同じspanなら先勝ち。直接名score1、synonym .96、graph前述score。複数独立alias/synonymのshapeが競合すればhold。

疎fallbackはEnglish filtered unigram＋隣接filtered word bigram（固定stop words）、日本語の連続字runのcharacter bigram。bag主体でorder/否定を理解しない。各入力featureはbinary、未知featureは無視。60profile cosineを計算しscore=.8×cosine。各shape scoreはchannel最大、加算しない。非ゼロargmaxをrawTop1とし、全60rankingを返す。tieはcosine→inventory順。

保留guardは全queryのtechnical markers/否定取消句に対する保守的hard hold、対になった「」『』“”ASCII double/single quote spanは同長空白へmask。unclosed Japanese/double quoteはhold。具体regexはretriever.jsが規範。広い「ない/なく」は記述文でもholdし得る。technical語が引用内でもhard guardにかかる。英語apostrophe・自然文コード・多義語を完全に処理するparserではない。masked queryは返すが、本文から最良名詞だけを抽出する機能はない。

閾値（全mode同値、初回weightから変更なし）：anchor score≥.85 / top1-top2 score≥.10。sparseのみがtop channelなら cosine≥.32 / cosine margin≥.10 / matched features≥3 / df≤6のfeature≥2。score/cosineは確率ではない。語彙にない物体、抽象・混合はhold優先。実世界でfalse activation率を保証しない。

## 比較と報告

同一の全文を全条件へ渡す。alias（guardあり）、alias_wordnet、alias_wordnet_graph、sparse_only、unguarded（full機能でguardなし）、full（選択候補）の6固定条件。baselineは現sourceのshapeChoices/shapeEvidence＋interpret(DEFAULT_SPEC、random選択なし)。Vite import.meta.glob式だけ同一JSONのcompile-time展開に置換しOxcでTS構文変換する。関数bodyは変更しない。baseline acceptedはshapeChoices.length>0、first shapeを予測とし、interpret.spec.shapeとrecognizedも別記。baselineのmode/count/motionだけの認識をshape正解へ数えない。

positive: rawTop1 exact/60、accepted coverage、accepted-positive exact precisionを別々に数える。hold: false activation/hold母数。ambiguous: accepted/ambiguous母数、hard正解へ混ぜない。joint precisionはcorrect accepted positive / (accepted positive + accepted clear hold)、曖昧層を含めない。保留/誤形を別記。familyがある場合もexactとは別。class/言語/明確さ層別、positive:hold prevalenceを開示する。閾値gridの事後risk-vs-coverageは診断に限り選択閾値を動かさない。

全文NFKC exact重複と、actual masked query NFKC exact重複をfit資料/dev/pilotと比較し別記。alias/同synset term/graph句の完全一致cueを持つcase数とchannelを出し、そのcaseをfresh語彙一般化と呼ばない。未知語を特定できるpretraining corpusはない（学習modelなし）。本文の独立著作と、資料語彙からの独立性は違う。

## 制約とCPU測定

runtime pure retriever.jsはJSC/Nodeで実行、I/O/clock/network/Intl.Segmenter/cacheなし。Node adapterのみlocal JSONを読む。weight-R1は8MiB以下、最大845 term/1937 features/60 profiles、入力512以下。serialized bytesとretained JS heapとprocess RSSを区別する。JSONより全app RAMが同率で減るとは言わない。独立pure candidate processでinitialization、warm per-query p50/p95/p99/max、512 worst length、peak/steady RSSとheapを記録。JSCは同じ人工文の数値/判定parityと小さいCPU timingを別記。Mac結果で16GB Windows/iGPU、全app常駐、省電力を達成したとしない。

## integration未確認

候補は1窓proposalのみ。動作命令/ambient reflection/文字蓄積・形保持時間・姿の品質は別の設計。60形inventoryは60Programやnative16実装を意味しない。評価がよくてもdefault採用は保留、未知語理解/任意text-to-meshは主張しない。
