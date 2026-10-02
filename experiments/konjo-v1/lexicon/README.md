# 根性版の語彙 — WordNetから名詞の同義語を選ぶ

2026-09-30。文章のあいまいな連想を広げる仕組みのうち、このデータは**既存の意味辞書から選んだ、同じ名詞の意味に属する別名**だけを受け持つ。広い連想や形への創作的な対応は別の手動グラフへ分ける。

## 生成物

- [ブラウザ向けJSON](../../../prototypes/glyph-creature/src/data/konjo-wordnet.json): 427行、404種類の語、60形。64,686バイト。
- [選択した意味と除外語](seeds.json): 名詞の意味ID、英語での元定義、対応形、除外理由。
- [生成結果・件数・ハッシュ](build-report.json)。同じ語が複数の選択意味に属する場合は、出典を残すため別行になっている。
- [人工の確認例50件](evaluation-examples.json)。制作中に見ながら使う例で、独立した未知データ・盲検・一般言語理解の成績ではない。

`concept` は `wn30:13875392-n` のようなWordNet 3.0の名詞意味ID。`relation` は全て `synonym`。語を同じsynsetから得たという意味で、どんな文でも完全に言い換え可能だと保証するものではない。上位語を辿る展開は行っていない。

## 元資料と固定した版

1. [Japanese WordNetの配布元](https://bond-lab.github.io/wnja/jpn/downloads.html)。日本語をPrinceton WordNetの意味単位へ結び付けた語彙。配布元自身も誤りが残ると説明しており、無選別に全語を使わない。
2. [OMWの日本語データ](https://github.com/omwn/omw-data/tree/406bf83b3c507a3d1f26e88252d5d66893fd36bf/wns/jpn)。このコミットを固定し、元の `wn-data-jpn.tab` とライセンスを取得した。現在の最新の日本語WordNet全体を収録したという主張ではない。
3. [Princeton WordNet 3.0名詞データの配布](https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz)から、対応する英語名詞の綴りと定義を得た。[配布元の利用条件](https://wordnet.princeton.edu/license-and-commercial-use)と原文ライセンスを同梱する。

日本語WordNet (OMW固定スナップショット) © 2009–2011 NICT, 2012–2015 Francis Bond, 2016–2024 Francis Bond, Takayuki Kuribayashi。[プロジェクト](https://bond-lab.github.io/wnja/)。WordNet 3.0 Copyright 2006 by Princeton University。

[再配布用の出典表示とライセンス](../../../prototypes/glyph-creature/public/licenses/wordnet-NOTICE.md)。原資料・抽出語の出典と、こちらが決めた形との対応を混同しない。

## 選別

球体・円環・螺旋などは幾何の名詞、蝶・木・くらげなどは生物そのもの、花瓶・剣・杯などは道具そのものの意味を選んだ。例えば `ring` の電話音・犯罪集団・ボクシング会場、`flower` の動詞や最盛期、`spider` の検索プログラム、`star` の有名人、`Saturn` の神、`shell` の砲弾を除く。

さらに選択済みsynsetにも多義語・旧訳がある。球の意味に紛れた「分野」、剣に対する `brand / steel`、洋梨の「ペア」、太陽の「日」、傘の「蝙蝠」、卵の「お玉」などを避けた。単語の削除は元データからではなく、今回生成する表だけから行う。元データはローカルに保存する。

初回の `bolt` は締結具の意味を誤って選んでいた。実際の形は稲妻なので、放電の意味へ訂正した。[採用しなかった初回のデータと評価例](initial/README.md)も残す。形IDだけから意味を推測せず、画面側の形名と対応を照合する。

幾何の `heart` は感情や心臓の意味へ広げない。花の `rose` は植物の意味で、色やワインは含めない。砂時計は `hourglass` と `sandglass`、卵は卵と卵形、月は地球の衛星と三日月形というように、一つの形へ複数の具体的な意味を選んだ場合も記録する。

## 再生成・取得時の扱い

リポジトリのルートで実行する。標準Pythonライブラリだけを使う。

```sh
python3 tools/build-konjo-lexicon.py --download
python3 tools/build-konjo-lexicon.py
python3 tools/build-konjo-lexicon.py --check
```

最初だけ固定HTTPS URLからデータを取得する。毎回SHA-256で固定内容と照合し、違った場合は採用しない。40 MiBの取得上限を設け、アーカイブ全体を展開せず `dict/data.noun` の通常ファイルだけを読む。ダウンロードしたプログラムを実行しない。生データは `.local/konjo-lexicon/` に保持し、Gitへ加えない。以後の生成と`--check`は通信不要。

ハッシュは同じ入力を再取得・再生成するための検証で、配布元の無謬性や最初の取得内容の正しさを保証するものではない。意味の選択は英語定義・日本語の候補を読んで別に確認した。

## アプリ側で必要な処理と限界

この表自体は文章の解釈器ではない。英単語の途中へ一致させないこと、短い仮名や漢字に強いあいまい一致を掛けないこと、長い候補を短い部分語より優先することはアプリ側で行う。カナ変換・編集距離・連想グラフはこの表に混ぜていない。

「春」を表す英語 `spring` とコイル、「シェル」の貝殻とソフトウェア、「クラウン」の王冠と固有名など、同じ綴りの曖昧さを単語表だけでは解けない。人工例にはそのような文脈を要する例を別分類で残した。通常文の全てで誤反応が起こらない、任意の文章を理解する、という主張はしない。

人工例の `expectedShapes` は必要な候補であり、排他的な正解ラベルではない。「マッシュルームの傘」のように別々の形の語を含む文では、複数の候補があってよい。`context_required` は合否から外して観察する。
