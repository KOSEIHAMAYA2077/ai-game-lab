# Glyph Matterを作業の横へ置くための整理

2026-10-03。創作・プログラミング・仕事中の文章を材料に、文字が蓄積し、表面が流れ、姿が変わるサイドインテリアを目指す。入力連動・意味解釈・描画を別々に試し、作業への影響は評価案を整理した。既存のコード・保存・タグ・URL・アプリは保持し、比較は別版へ保存した。

## まず触れるもの

| 入口 | 今できること | 範囲 |
| --- | --- | --- |
| [60形Web](https://koseihamaya2077.github.io/glyph-matter/) | 自由入力、文字表面、用意した形と動き、定期的な形変更 | 既定の根性版。全アプリの入力ではない |
| [小窓Web](https://koseihamaya2077.github.io/glyph-matter/widget-v3/) | 黒い空間と文字表面、形の保持、実験用の小型解釈器 | 既定は根性版。小型解釈器は任意の実験機能 |
| [13形Mac比較アプリ](https://github.com/KOSEIHAMAYA2077/glyph-matter/releases/tag/glyph-matter-metal-v0.3.0) | Mac標準の小窓、作者定義の面と動き、停止・非表示 | Apple Silicon/macOS13以上、未公証。実窓を確認済みの配布版 |
| [16形のsource候補](../desktop/glyph-metal-lab-v4/README.md) | 魚・鳥・蛇を加えた面と骨格 | offscreen/数値検算。新16形の実窓は未確認、Releaseにしない |

専用編集欄から文字表面へつなぐ[Web比較の実操作](../experiments/ambient-editor-surface-root-ui-v1/README.md)も保存した。入力・削除・追加分の色・停止・入力欄の非表示を確認したが、ASCII中心の確認で、実日本語IME一般を検証済みとはしていない。

## 今回確かめた技術

| 処理 | 実装と結果 | まだ言えないこと |
| --- | --- | --- |
| 入力から文字材料へ | [専用編集欄のadapter](../experiments/ambient-editor-adapter-v1/README.md)、[統合R3](../experiments/ambient-integration-publication-v1/README.md)。材料を全体追加してからACK、取消・重複・保存offを人工eventで検算 | 全アプリ取得、実IME、日常量を失わず運ぶ完成版 |
| 同じ正本をnativeへ | [JavaScriptCore](../experiments/ambient-javascriptcore-v1/README.md)、[native入力比較](../experiments/widget-metal-ambient-v1/REPORT.md)。Mac標準runtimeでも同じ有限状態処理を使う | 実窓/IMEのcallback順序は人工callbackだけでは保証できない |
| 待機中の転送 | [cache R2](../experiments/widget-metal-ambient-cache-v1/REPORT-R2.md)。独立12セッション/66非reset stepの素材等が一致し、804 CPU描画用レコードの規定80B fieldsがbitwise一致。clock失敗を修正し同期待wire15 attempt/14条件の回帰が全PASS | 内部body走査0、全widgetのRAM/CPU改善、実GPU/窓の再評価 |
| 日本語の特徴 | [固定128F16表のSwift CPU候補](../experiments/native-static-japanese-v1/PUBLIC-README-R6.md)。表8MiB、既知709回帰・独立20・別特殊token4で配備を検算。tokenは厳密一致、浮動値は事前の許容誤差内 | 語順・否定・関係の理解や、新しい意味精度の達成 |
| 特徴処理の入口 | [本文なしCLI R2](../experiments/native-static-wire-publication-v1/README.md)。入力32,768B/返信2,048B、独立20入力/21返信。次行へ復帰し、返信に本文を含めない | 実IPC認証・取消・epoch・model寿命・全体RAM上限。本文は処理memoryに存在する |
| 長い待機 | [固定CLIの100分補足方法](../experiments/native-static-longrun-v1/METHOD-R1.md)。人工queryとidleを分けて単独native PIDを観測 | 8時間の実窓、仕事との共存、電力、16GB laptop実機 |

Macの13形の[実窓測定](../experiments/widget-metal-native-evaluation-v3/REPORT.md)は、M5/32GiB・4形各90秒でCPU約1.6〜2.0%（1コア基準）、charged peak約70〜72MiB。固定日本語CLIの短batch peak43.53MiBは別process・別workloadのRSSであり、この二つを足して全アプリの実測値とはしない。今回の新native入力/16形の実窓は、確認時にMacがロック状態だったため未確認のまま残した。

## 意味解釈の採否

[約200KiBの辞書・連想グラフ・疎な検索](../experiments/ambient-shape-retrieval-evaluation-v1/REPORT.md)は、独立人工120文の正例で正しい形を受理14/60、形を求めない文への誤反応2/40だった。正例60文は12代表family×5であり、60形の一様網羅ではない。説明文3/36、物語1/12に留まった。軽く動くことだけでは自然な文章の理解を主張できず、既定採用を見送った。

以前の固定日本語特徴や6 Program studentにも別の未達がある。異なる評価文・形の集合・受理policyの数字を合算しない。runtimeを小さく移した今回の配備一致は、モデルが新しい文章を理解するようになった証拠ではない。

作業中の文章では、必ずしも明示した形の命令だけを求めない。[連想policy](ambient-association-policy-v1/README.md)では「球を作れ」の実行精度と「文章から眺めて楽しめる球を連想する」価値を別にした。既存の失敗を後から連想の成功へ改名せず、次に人が見て許容できるかを比較する。人による正式評価は現在0人。

## 実装の次の順序

1. **専用編集欄で一日の量を扱う。** 人工契約の材料256単位（各operation内のgrapheme）・文書512 UTF-16単位は、実入力で上限全体を検証した値や日常の完成版ではない。全文保存をしない条件でも、追加を保留したこと・再試行・停止を明確にする。正本の文字量、意味の短い窓、描画1,536文字を分ける。
2. **同じ文字表面で、形の変更元だけを比較する。** 定期変更、辞書、固定特徴の低頻度提案を別条件にする。意味処理が保留しても文字の蓄積と現在の形を保ち、入力を勝手に形の命令として実行しない。
3. **少数の実入力経路を確認する。** Mac/Windowsの[一次API調査](ambient-input-platforms-v1/README.md)と[入力certaintyの設計](side-interior-current-decision-20261003.md)を基に、対応する編集APIから進める。キー活動はIME確定の本文ではなく、全アプリで同じ文章取得を保証するAPIはない。今回はOS監視を開始していない。
4. **同じアプリ全体を目標PCで測る。** 16GB laptop CPU/iGPUで、他の作業との同時利用、通常/入力/停止/非表示、初回/再解釈、全processの帰属を確認する。取得量と常駐RAMを別にする。
5. **作品としての評価を行う。** [人による評価案](ambient-study-questions-v1/README.md)で、邪魔にならなさ、変化の気付き、連想の楽しさ、文字が残る感覚を確認する。AI合成テストはその代替にしない。

## 研究としての入口

[技術・課題・一次先行研究の地図](widget-research-map-20261003.md)を基点にする。軽い特徴/用途限定student、制約付き形状Program、手続き面/骨格、文字履歴と表面の連続性、ambient display/作業影響を比較対象にできる。任意の言葉から新規meshを生成する汎用text-to-3Dは現版の達成ではない。

研究テーマを一つに絞るなら、**「低資源のサイドインテリアにおける、文章による形の連想と文字表面の連続表現」**を候補にする。具体的には、意味の提案頻度と保留、同じ文字履歴の連続性、作業への影響、全体資源を同じ入力列で比較する。組み合わせただけで新規性があるとはせず、既存方式との差と、未見入力・目標実機・人の評価を残る課題にする。
