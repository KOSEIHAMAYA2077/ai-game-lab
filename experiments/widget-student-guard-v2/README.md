# 固定分類器＋追加規則 v2

2026-10-03。**学習器・重み・閾値を変えず、保留と局所属性・親子順の規則を追加する比較版。** [元のstudent freeze-1](../widget-student-v1/)を保存する。元の最初の独立90例は意味64/86、render43/60、hold21/26、誤受理5件。throughのうち4出力は既存compilerでは形を作れなかった。

この結果を見て作った版で、同90例は以後**回帰評価**である。新しい未見testや、学習による意味精度向上とは呼ばない。用意した形の表面に文字を流す試作への保守的な解釈器で、任意のtext-to-meshではない。

## 何を足したか

| 規則 | 挙動 | 制限 |
| --- | --- | --- |
| 取消・除去 | cancel / undo / 取消 / 消去等を文全体で保留 | 意図して過去の文字を消す機能ではない。引用や話題でも保留される |
| 命令否定・欠如 | 描くな・出すな・のない・lacks等を保留 | 複雑な否定を学習で理解しない。否定的に見える文字列を保守的に扱う |
| 引用・code文脈 | 引用符・literal/string/variable等を保留 | `「球」を作る`のように肯定的に引用した指定も保留になる |
| 局所的矛盾 | 同じ部位の長い/短い・広い/細い等を保留 | 名詞前の句を分ける簡単な範囲だけ。後置属性、照応、長い文章は解けない |
| 明示的親子順 | tip/end・top/above・throughの明示構文で順を確認 | 関係labelは元の学習器のまま。規則のkindと食い違う時、構文不明の時は保留 |
| 縦・横の属性 | 縦長、横長、伸ばす、圧縮、扁平、ずんぐりを局所規則で補う | 手動で決めた数値。形状属性の学習改善ではない |
| 形状を作れる範囲 | validatorと既存compilerを通らないProgramは保留 | 貫通childに箱・球・花瓶は現在未対応。意味を当てても作れない場合がある |

`evidence`では`learned-char-*`と`explicit-v2-*`を分離する。元のevidenceも残すため、前の順序規則と追加規則の補正を追える。`classifierMs`と`guardMs`も分け、compiler込みの合計を`modelMs`へ返す。

元が保留した未知語・関係を、追加規則で無理に生成へ変えない。daggerなどの語彙不足や、離れた節の指示は残る。受理できる文を増やすだけを目的にせず、作れない形や誤発火を減らす。追加ガードは保留を増やすので、正例の成功数と危険な受理を一緒に比べる。

`compileScaffoldProgram`は材料の内外を有限の点・時刻で確認する。全時刻の保証、形が知覚できること、流れが綺麗なことを証明しない。表示品質、長時間常駐、Mac全体資源は別評価。

## 開発確認と凍結

90例とは異なる人工文で、取消/命令否定、引用、局所矛盾、縦横属性、英語の親子順、compiler不能の貫通、未知語の保留を確認する7単体テストが成功。型検査も成功。これらは実装時の開発確認で、独立testではない。

[新しい規則とテスト](../../prototypes/glyph-creature/src/widget-student-guard-v2.ts) / [Freeze manifest](FREEZE.json)。元の重み・ソースSHAも検査する。評価担当に同90例の回帰を渡し、受理数・意味・安全な形状・保留を別々に記録する。

```sh
python3 experiments/widget-student-guard-v2/verify_freeze.py
node experiments/widget-student-guard-v2/build_runtime.mjs
```

生成した`.local/widget-student-guard-v2-runtime/student-adapter.mjs`は、元と同じ`widgetStudentResolution` / `inspectWidgetStudent`を公開する評価専用入口。新しい依存やモデル取得はない。既存版やapp entrypointをこの実験で変更しない。

現時点では回帰成績・ブラウザ動作・ネイティブ資源は未測定。採用は主担当の統合・評価後に判断する。
