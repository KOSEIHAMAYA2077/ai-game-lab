# 訓練・推論の独立照合 R2

2026-10-03。対象はseed候補とBonsai4B/r2追加候補。評価用フォルダの本文・予測は読んでいない。seed/train/dev、教師のraw/curated、訓練コード、推論コード、保存したモデルと訓練報告だけを使った。

修正後の通常40人工入力でPython/JavaScriptの特徴ID、4headのTop1、gate後のshape/attrsが一致した。学習/dev分離と教師sourceFamilyは保持され、教師追加候補は同じseed行・dev行・変形head・設定を使う比較になっている。一方、名称なしの形描写と未見変形phraseの性能は低い。全体dev件数を意味理解の成功と扱うことはできない。

## 先に伝えた問題と現在の状態

1. Pythonの `\s` とJavaScriptの `\s` の空白集合が違っていた。元の40fixtureでは37/40特徴一致、最大score差0.173289。U+0085、U+001C、U+FEFFを含む入力で再現した。rootがPythonの空白集合をJSへ明示し、trimをASCIIスペースに限る修正を行った。元の `seed-parity.json` / `seed-node-raw.json` を保持し、修正後を `*-parity-r2.json` / `*-node-raw-r2.json` へ保存した。
2. 当初のteacher corpus familyが全captionで `shape/teacher-r1` に集約されていた。rootがr2/r3のsourceFamilyを継承する方式へ修正した。r2の採用18件と、wrapperで増えた72行について、元のraw、形ID、train sourceFamily、sourceTextの一致を照合した。
3. Unicode版差は残る。Python3.9.6 / Unicode13とNode26.4.0でU+1E030のNFKC、U+1C89のlowerが違う。追加2probeは特徴不一致だった（今回の2文ではTop1は一致した）。一般Unicodeまで同一処理とする証明はない。この2文字は未対応の版差として明記する。

## 数値と量子化の照合

40通常fixtureは8形のname/train描写/dev描写24件と、空白、全角、結合文字、非BMP、case変換、空文、512/513字境界、全体変更、細い首、直接否定の人工probe16件。正解率を測る独立評価ではなく、両実装の一致を測る。

| 候補 | 通常features/Top1/出力一致 | 最大score差（独立f64基準） | 最大score差（trainer f32基準） |
| --- | --- | ---: | ---: |
| seed | 40/40 | 8.88e-16 | 3.05e-7 |
| bonsai4 | 40/40 | 1.33e-15 | 2.98e-7 |

little endianのsigned int16、配列レイアウト、bias、scale、known bitset、L2相当のfeature-count正規化、FNV-1a codepoint hashを別実装で照合した。4headの量子化係数数は499,712 / 24,576 / 24,576 / 16,384、絶対値最大32760でint16の範囲内。scoreは浮動小数点演算順のためbit同一ではない。

全dev予測を保存モデルから再計算し、報告とのscore差は0、margin差は最大2.98e-8、coverage差は0、Top1は全行一致した。headごとの計数は次の通り。

| head | seed train | bonsai4 train | dev | seed/bonsai4 Top1正解 |
| --- | ---: | ---: | ---: | ---: |
| shape | 4,332 | 4,404 | 1,212 | 985 |
| length | 2,883 | 2,883 | 1,032 | 792 |
| width | 2,883 | 2,883 | 1,032 | 792 |
| bend | 2,883 | 2,883 | 1,032 | 912 |

保存seed corpusを現在の訓練coreでメモリ内に再学習すると、4headすべてが既存seedモデルと完全一致した。coreのSHA-256は検証中に不変。書き出し先のモデルを置換せず、結果だけ `seed-reproduction.json` へ保存した。修正されたteacher読込/familyとJS空白の変更が、seedの重みを変えたという混同はない。

## 分割と属性ラベル

各headのnormalized textとfamilyにtrain/devの重複なし。保存predictionsは対応headのdev行だけに一致した。teacher r2 raw120件は120 sourceFamilyすべてtrainの原文に一致し、devの原文は0件。

原文・名称・別名・holdから作った1,845属性行は全体変更を指定しないため、neutral/neutral/straightが付いている。花瓶の細い首や蛇の既存の曲線など、形の同定用の部位特徴を全体width/bendへ転記していない。変形phraseのcross-productはcanonical nameだけに付け、対応headのみ指定値、ほかは既定値だった。全体変更phrase由来のshape/attrs行は13,200件で照合した。

shape devはcanonical名を含むmodifier文960件と、保留した名称なし描写のwrapper240件、hold12件から成る。名称＋modifierのdevは変形phraseの保留であり、形の名称を知らない条件ではない。元の単位は60描写family、480 modifier composite family、3 hold familyで、1,212行を独立した利用者1,212件と扱わない。

## gateの独立再計算

48候補（score6値×margin4値×coverage2値）を同じdev予測から独立に集計した。seed/bonsai4とも score=0.1、margin=0、coverage=0で保存結果と一致。positive exact accuracy=0.8025、hold accuracy=1、平均objective=0.90125。重み/epochsをdevに合わせて変えたり、評価用の本文や予測でgateを選ぶ処理は見つからなかった。最適という意味はこの事前定義したgrid内に限る。

## 教師追加の効果と性能限界

r2採用18captionがshape訓練だけに72行追加された。すべて採用原文とsourceFamilyへ一意に戻せた。seed由来corpus行、全dev行、3属性headの内容は基準候補と完全一致。dims/ngram/hash/seed/epochsも同じ。比較で変わるのは追加shape訓練caption、そこから学ぶshape重み、同じdev/gridで決めるgateである。LLMのlogitやsoft targetを蒸留した方式ではなく、AI採否付きのcaptionをhard labelで追加する方式。

seed/bonsai4は同じshape正解件数と同じgateだった。集計上の改善は確認できない。

| shape dev群 | 行数 | raw Top1正解 | gate後の正解 |
| --- | ---: | ---: | ---: |
| 名前＋未見modifier phrase | 960 | 960 | 960 |
| 名称なしの保留描写 | 240 | 13 | 3 |
| hold | 12 | 12 | 12 |

名称なし群のrawは13/240、gate後は3/240。全体の985/1,212は名称が既知の多数派に支えられている。曖昧な文章から形を理解する性能として81%を提示しない。

属性devではlength/widthが全行neutral、bendが全行straightだった。lengthのshort/long各120、widthのnarrow/wide各120、bendのcurved120は正解0。792/1,032と912/1,032は既定ラベル多数派の一致で、未見変形phraseへの汎化成功ではない。Bonsaicaptionをshapeだけに追加する実装のため、教師追加による属性改善も主張しない。

## 原票と再現用ファイル

- `check_parity.py` と `probe.mjs`: Python/Nodeのfeatures/scores/predict照合。`--kind seed|bonsai4|bonsai8 --round r2|r3`。
- `check_artifacts.py`: corpus分割、default/global属性ラベル、量子化配列、全dev score/Top1、48gate、教師r2 source照合。
- `check_candidate_effect.py`: seed行/dev行/config/属性headの同一性、採用teacherと追加行の由来。
- `check_reproduce.py`: 現在の訓練coreから既存seed全headをメモリ内に再現。
- `seed-parity.json`: 修正前の不一致を保存。
- `seed-parity-r2.json` / `bonsai4-parity-r2.json`: 修正後40通常caseと未対応Unicode2caseを区別して保存。
- `seed-artifact-audit.json` / `bonsai4-artifact-audit.json`: 全dev再計算、分割、ラベル、gateの原票。
- `candidate-effect-audit.json` / `dev-group-breakdown.json` / `seed-reproduction.json`: 追加効果の境界と再現。

既存numpy2.0.2環境と標準ライブラリ/Nodeだけを使用。新規download、Git操作、教師起動、評価本文/予測の閲覧、対象コードやモデルの変更は行っていない。
