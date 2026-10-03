# JavaScript実装と保存済みPython返信の一致

凍結した人工244文について、static-seedとstatic-Bonsai8のJavaScript実装を、保存済みのPython返信と比較した。両候補とも形、hold判断、length/width/bendが244/244一致した。最大score絶対誤差はそれぞれ約3.23e-7・3.62e-7だった。モデル・データ・閾値・期待値を変更していない。

これは実装移植の整合性確認。新しい意味評価や評価文追加、候補選択、精度調整ではない。元のPython評価を再実行せず、既存の全返信から対象2方式を取り出した。

| 比較対象 | static-seed | static-Bonsai8 |
| --- | ---: | ---: |
| 比較文数 | 244 | 244 |
| 形ラベル一致 | 244/244 | 244/244 |
| hold判断一致 | 244/244 | 244/244 |
| hold件数 Python / JS | 19 / 19 | 18 / 18 |
| length一致 | 244/244 | 244/244 |
| width一致 | 244/244 | 244/244 |
| bend一致 | 244/244 | 244/244 |
| 形＋3head全一致 | 244/244 | 244/244 |
| top3候補ラベル・順序一致 | 244/244 | 244/244 |
| reason一致 | 244/244 | 244/244 |
| 最大score絶対誤差 | 3.228462531756904e-7 | 3.621006855469844e-7 |
| 最大margin絶対誤差 | 3.79849340648164e-7 | 5.536771666703189e-7 |
| 最大coverage絶対誤差 | 0 | 0 |

ブラウザ用の`createStaticEncoder`と`loadDenseModel`/`predictDense`をNodeから直接呼んだ。同じtokenizer JSONとF16表をローカルファイルから読み、外部リクエストは行っていない。encoderを一度作成し、候補ごとに同じ244文を順番に入力した。表とtokenizerは公開されたpinのSHAと一致。JSコード・表・tokenizerのハッシュを開始時に記録し、全返信の取得後に不変を確認した。全FREEZE対象のモデル・学習/devデータ・設定、および元の評価文・Python返信についても開始時と終了時のSHA一致を確認した。

[全488比較原票](predictions.jsonl)には元のPython返信とJS返信、ラベル一致、score/margin/coverageの差を保存した。[summary](summary.json)にはJSコード、各モデルとデータ、表とtokenizer、元返信、今回の原票のSHAを記録した。[比較入口](check.mjs)は既存の今回の返信を上書きしない。

この確認はNode上の同じJS関数の一致であり、実ブラウザの読み込み、入力経路、UI、描画、IME、常駐資源を検証したものではない。244文の範囲で出力が一致した結果であり、全てのUnicode・長文・未知入力へ一致を保証しない。微小なscore差は残っており、浮動小数点値のビット単位の一致ではない。

## READMEとの数値照合

rootの`README.md`および`experiments/bonsai-task-student-v1/README.md`を、保存済み`evaluation/metrics.json`と照合した。現在の比較について21項目を確認し、不一致0。root文書を編集していない。

- 全6方式の描写120・明示名60・否定20/無関係20の誤反応数が一致。
- 冒頭のstatic-seed描写90/120、否定誤反応19/20が一致。
- static2方式の変形19/24・16/24・19/24、全head同時10/24、非default6/11・6/13・6/9が一致。
- 文字3方式の非default正解0が一致。
- 固定表は8,388,608 bytesで8MiB、static-seedモデルJSONは51,721 bytesで約52KBという記述に合う。tokenizerは別ファイルであり、これらをアプリ全体のRAMとは扱わない。

[照合原票](document-check.json)に文書とmetricsのSHA、各比較値、確認範囲を保存した。[照合入口](check-docs.py)。以前の別実験、devの数値、ライセンス、公開URLの到達可否、製品の動作はこの文書照合の対象外。
