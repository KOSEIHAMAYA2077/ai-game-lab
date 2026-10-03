# 文章から文字の身体を選ぶ、小さな専用モデル

2026-10-03。旧版を残す `experiment/bonsai-task-student-v1` の比較。入力文字を材料へ追加し、60種類の作者定義曲面と長さ・幅・曲がりをCPUで選ぶ。文字表面・骨格・吸収の描画は既存の根性版を使う。新しい物体メッシュを自由生成するモデルではない。

[試遊版](https://koseihamaya2077.github.io/glyph-matter/task-student-v1/) / [承認範囲](BRIEF.md) / [評価プロトコルと原票](evaluation/) / [学習・実装の独立監査](training-review/) / [凍結記録](FREEZE.json)。公開用タグは `glyph-matter-v0.15.0-task-student.1`。既存URL・保存データは変更しない。

## 操作

黒い空間でEnterを押すと入力欄が開く。短い言葉や文章を入れ、Enterで加える。入力の文字そのものが形の表面へ流れる。`花瓶`、`剣`、`クラゲ`、`全体を細くして縦に伸ばした花瓶`などを試せる。これらは操作例で、独立評価の成功例として選んだものではない。

HELPで方式を選び、同じ入力の判断を比較する。既定は日本語の固定意味特徴＋専用head。Bonsaiの追加文を使う候補、文字n-gram候補、既存のルール方式も比較する。初回は同じサイトから選んだモデルを読み、その後は端末内CPUで判断する。Bonsai本体は試遊時に起動しない。入力本文の送信・保存は行わない。

判定が保留でも文字は追加し、以前の形を保つ。色指定はその入力の文字だけに効く。材料上限32,000文字、描画上限1,536文字。通常15fps、非表示では描画を止め、待機中に再推論しない。画面はモデルの実験用で、OS全アプリの入力連動は未実装。

## 何を学習したか

入力 `text` から次を選ぶ分類問題として限定した。

| 出力 | 範囲 | 描画への変換 |
| --- | --- | --- |
| shape | 既存60形＋hold | 既存曲面式と生物の骨格を選ぶ |
| length | short / neutral / long | 縦方向0.70 / 1.00 / 1.65 |
| width | narrow / neutral / wide | 横・奥行0.65 / 1.00 / 1.50 |
| bend | straight / curved | 全体の曲がり0 / 0.35 |

細い首など物体固有の局所形状は、全体を細くする指示と区別する。変形した面の接線も更新し、文字を平らな板として表面へ沿わせる。形が伸びたときはカメラの収まりも変える。任意の骨格・部品配置・表現の多様性はこの4headの範囲外。

比較した5学習器:

| 系統 | 特徴と学習 | 教師の追加文 |
| --- | --- | --- |
| seed | 文字1〜5-gram、8,192次元の疎な線形softmax | なし |
| bonsai4 | 同じ疎な4head | 4B由来18文をshapeだけへ追加 |
| bonsai8 | 同じ疎な4head | 8B由来48文をshapeだけへ追加 |
| static-seed | 固定日本語128次元＋学習する密な4head | なし |
| static-bonsai8 | 同じ固定特徴＋密な4head | 8B由来48文をshapeだけへ追加 |

`static-seed` の既定選択は独立評価前のdevで決めた。文字方式の比較用studentはbonsai8。全データ・候補・選択根拠のhashをFREEZE.jsonへ保存してから、別担当の244文で評価した。独立評価結果を見て、モデル・教師文・閾値を変更しない。

## Bonsaiを蒸留した、とはどこまで言えるか

今回Bonsaiに行わせたのは、**学習用の人工描写を言い換えること**。その文字列に元の形ラベルを付けて小さな専用headを学習する、教師補助のデータ追加である。Bonsaiの重み、logits、内部状態は移していない。Bonsaiの一般能力を1.5MBや8MBへ圧縮した実証ではない。

最初の4B run1は60要求のうち構造として読める配列35件。反復・他言語・切れた応答が多く、学習へ使わなかった。run2は120原文のうち非空71、別担当が受け入れた22文から原文の完全コピー4文を除き、作成担当との一致した18文を使った。8B run3は120非空、別担当受入57、原文コピー8、作成担当との不一致1を除き48文。

4B run2は英語system指示、8B run3は短い日本語指示に変えている。採用率の差を4B/8Bの大きさだけの効果として比較できない。モデルが別物を描写した例もあり、形名を指定すれば正しいデータが得られるとは限らない。レビューは複数のAI担当であり、人間による正解ラベル確認ではない。[rawと除外記録](teacher/) / [独立教師レビュー](teacher-review/)。失敗runも保持する。

## データと検証の境界

60形の形名・別名183、描写300文（train240/dev60）、保留72文（train60/dev12）、変形表現59（train43/dev16）をAI担当が作成。形名と本文の全文重複を防ぎ、描写・変形表現はfamilyでtrain/devを分けた。テンプレート展開した数を独立した自然文の数と呼ばない。特に名称付きdev960文が全体正答率を大きく押し上げる。

devでは文字方式seed/bonsai4が名称付き960/960、名称なし描写13/240（閾値後3/240）。bonsai8は名称付き960/960、描写16/240（閾値後7/240）。約81%という全体値で、文章の意味を理解したとは言えない。未知の変形表現ではこの文字方式は全てdefaultへ偏り、非defaultの各labelに正解0だった。

固定意味特徴のstatic-seedはdev名称付き955/960、描写77/240、保留9/12。static-bonsai8は951/960、73/240、9/12。このdevでは教師文追加が改善を示さなかった。意味特徴を使っても描写の多くを誤り、全体長さ・幅・曲がりにも誤反応が残る。[独立dev集計](training-review/)と独立244文は分けて読む。

### 独立244文の結果

次の件数は別AI担当が学習データを読まずに先に固定した人工文。候補を凍結して一度だけ処理した。実ユーザーの日常文章・人間の正解評価の代わりではない。

| 方式 | 名称なし描写120 | 名称付き60 | 否定・取消20への誤反応 ↓ | 無関係20への誤反応 ↓ |
| --- | ---: | ---: | ---: | ---: |
| 既存形ルール＋明示変形 | 5 | 60 | 20 | 0 |
| 文字seed | 28 | 10 | 3 | 0 |
| 文字Bonsai4 | 31 | 10 | 3 | 0 |
| 文字Bonsai8 | 33 | 10 | 3 | 0 |
| 意味seed | 90 | 58 | 19 | 2 |
| 意味Bonsai8 | 90 | 58 | 20 | 2 |

意味方式は描写への反応が増えたが、否定をほぼ区別できない。文字方式は名称を含んだ文章でさえ保留が多い。Bonsai追加による文字方式の小さな差は見えたが、意味方式の描写正解数は同じだった。この版を日常の入力から自動で形を変える既定エンジンに採用する判断は見送る。比較用の専用URLで試せるようにする。

24変形文では意味方式のlength19/24・width16/24・bend19/24、形＋3属性を全部満たしたのは10/24。非defaultの正解はそれぞれ6/11・6/13・6/9。文字方式は非defaultで全て0。属性の全体正答率はdefaultの割合に左右されるため、両方を記録した。

学習/devと評価に全文一致はなかったが、幾何の説明など部分語句の共有は残る。Bonsai8で改善した描写の1件には教師追加文との9文字一致がある。独立作成・全文重複なしは、未知の文章へ一般化できる証明ではない。[原票・許容集合・部分一致監査](evaluation/)を参照。devと独立評価の難しさも違うため、両者の正答率は直接同じ分布として比較しない。

## 軽さと未達成事項

文字方式のmodel JSONは約1.52MB、復号した重み約1.13MB。短い入力のCPU推論は単独Node processで1ms未満だった。モデル読込・文章判断・入力の吸収演出・画面表示を別に記録する。[CPU原票](artifacts/seed-benchmark.json)。

意味方式は128次元のF16表8,388,608B、tokenizer2,127,941B、専用4head約52KB。表は取得済みモデルの先頭128次元を切り、F16へ変換したもの。JSではONNX・Transformer・PyTorchを起動しない。これらの**配備bytesは小窓全体RAMではない**。ブラウザ・描画・文字atlas・trie・一時コピーの資源は別に必要。一般的な16GBノートPC/iGPU、Windows、長期常駐、消費電力は未検証。

文字方式ではPython3.9と新しいNodeのUnicodeデータ差により、特殊な新Unicode文字のNFKC/lowercaseが一致しない2例も保持している。[実装の照合](training-review/REPORT-R2.md)。通常の人工40例での一致は全Unicodeの一致ではない。

## 利用条件・一次資料

- [Bonsai 4B LICENSE](https://huggingface.co/prism-ml/Bonsai-4B-gguf/blob/main/LICENSE) / [NOTICE](https://huggingface.co/prism-ml/Bonsai-4B-gguf/blob/main/NOTICE.txt)、[Bonsai 8B LICENSE](https://huggingface.co/prism-ml/Bonsai-8B-gguf/blob/main/LICENSE) / [NOTICE](https://huggingface.co/prism-ml/Bonsai-8B-gguf/blob/main/NOTICE.txt): Apache 2.0。今回確認した公開条項に出力から別モデルを学習する禁止は見当たらない。生成物全ての権利保証、teacherライセンスの自動継承、第三者APIの利用条件とは別。教師重みは本PRに含めず、端末内で無料実行した。
- [hotchpotch/static-embedding-japanese](https://huggingface.co/hotchpotch/static-embedding-japanese): 作者は重み・学習コードをMITで公開と明記。Transformerのattentionを使わないtoken平均で、文脈や否定の理解に限界がある。固定revision `95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3`、変換とhashは[配備NOTICE](static-candidate/assets/NOTICE.md)。
- [fastText, EACL 2017](https://aclanthology.org/E17-2068/): 軽量な線形文章分類との近い基礎。本実装は文字ngram hashing＋softmaxで、fastTextライブラリをそのまま使ったものではない。
- [Model2Vec公式](https://github.com/MinishLab/model2vec): 固定token埋込みへ軽量化する方向の参考。本候補は別作者の取得済み日本語StaticEmbeddingを使い、BonsaiをModel2Vecで直接蒸留したものではない。
- [Text2CAD, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/0e5b96f97c1813bb75f6c28532c2ecc7-Abstract-Conference.html): 文章からparametric CAD sequenceへ出す研究。入力/出力を制約した形生成を考える参考。今回の60形選択とは出力の自由度・計算量が異なり、このPC条件での再現ではない。

次は、人が納得する描写・保留・変形の境界を確認すること、教師文の質と量を固定して効果を比較すること、局所部品・関係を増やすことが課題。holdoutの失敗へ同じ評価のまま語句を足して性能を主張しない。OS入力接続と常駐の省電力は、意味分類の改善とは別に測る。

## 再現

既存試作のlocked dependenciesでWeb版をbuildできる。Bonsai教師の再生成とPython学習は開発時のみ必要で、ブラウザ試遊には不要。

```sh
npm ci --ignore-scripts --prefix prototypes/glyph-creature
node experiments/bonsai-task-student-v1/build-preview.mjs
```

出力は `.local/bonsai-task-student-v1/web-build/preview.html`。配布時は同じファイルをindex.htmlとして置く。学習はPython3.9/numpy2.0.2/tokenizers0.22.1の使用済み環境、seed31003。固定特徴の元資料配置は `static-candidate/export_features.py` のmetadataに従う。

```sh
python train.py --kind seed
python train.py --kind bonsai4
python train.py --kind bonsai8
python train_static.py --kind static-seed
python train_static.py --kind static-bonsai8
```

これらはこのexperimentフォルダで実行する。保存済み凍結artifactを上書きしないよう、再現は別checkoutで行う。API鍵・ユーザー本文・参考本・画像・ローカル設定は公開物に含めない。
