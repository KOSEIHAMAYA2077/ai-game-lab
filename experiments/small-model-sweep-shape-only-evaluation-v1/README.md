# Shape-only R2の新しい36人工文

rootがR1診断から選ぶモデルを対象に、色・個数・動きの抽出をLLMから分けたR2の形/actionだけを検査する。担当はR1品質結果・R1評価文を読まず、日本語の新しい36文を作った。rootの最終prompt/schema/driver SHAを確認してから、private draftと同一byte列を[凍結fixture](cases-r1.json)へ置いた。モデル呼出・取得は0件。

| 群 | 件数 | 見ること |
| --- | --- | --- |
| named | 6 | 明示した対象へ変える要求 |
| appearance | 12 | 外見や構造から対応する形を選ぶ |
| mixed | 6 | 色・個数・動きを含む要求から、形だけを選ぶ |
| hold | 12 | 通常文、引用/code、否定、矛盾、未対応物体、普通の輪、範囲外個数を保留 |

正例24は12形を各2文で扱う。個数1..8の外を明示する2文もholdへ含む。相談に使った2文は除いた。[固定時刻・SHA・候補条件](FREEZE-R1.json)。実ユーザーの本文・資料の例文は使っていない。

契約はexact `{action: propose|hold, shape: supported_name|null}`。holdはshape=null、proposeは有限12形の名前。文章の残りの属性を決定的な規則で抽出する処理は、ここでは検証していない。形が合うことを色/個数/運動が正しく抽出されたことや任意3D生成としない。

## 採点

```sh
python3 experiments/small-model-sweep-shape-only-evaluation-v1/score_r1.py \
  --responses /path/to/original-responses.jsonl \
  --out /path/to/new-score.json
```

responsesは各行`{case_id, raw_text, status}`。raw_textはmessage.contentそのまま、statusはHTTP200の文字列取得ならok。全文をJSONとしてparseし、説明・Markdownを除去しない。重複key、NaN等、余分なkey、未対応shapeを拒否する。色等が付いた返信もこのR2契約では形式違反になる。

timeout・runtime_error・missing・重複case返信・JSON違反・契約違反・意味不一致を分ける。36という分母を保持し、未試行文は0点かつmissingへ残す。不明IDや壊れたJSONLがある場合はinput_integrity_ok=false。余分な不明IDを無視して既知36の正答数だけ報告する場合も、この整合性失敗を同じ表に添える。誤提案率だけでは壊れた返信を安全なholdとみなせないため、hold_exactと形式数を併記する。

R2モデルの選択はrootがR1診断を見た後に行う。このfixtureがR2モデルを見て選ばれたものではないことと、モデル自体がR1から選択されたことを区別する。R1の24文・5key契約と、今回36文・2key契約の正答率をそのまま改善率として引かない。繰返し使う場合は既知回帰であり、次の意味精度には別の未見文が必要になる。

## Scorerの検査

```sh
cd experiments/small-model-sweep-shape-only-evaluation-v1
python3 -m unittest test_score_r1 -v
```

11件成功。理想的な人工返信36件の集計は採点器の算術確認で、実モデル36/36という意味ではない。欠測の分母、意味の誤り、Markdown、重複key/case、timeout、holdへの誤提案、余分な属性、NaN、不明IDを検査した。[検査記録](TEST-RESULTS-R1.json)。まだ実モデルのscoreを作っていない。
