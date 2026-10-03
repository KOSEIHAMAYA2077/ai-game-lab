# 既存の成績が支える判断

結果は既公開原票・報告の読取である。今回モデルを呼び直したり、失敗のラベルを書き換えたりしていない。各 fixture は AI が人工文と仮の期待意図を付け、人間注釈・人間の好み評価は 0。

## 三つの課題を合算しない

| 保存済み評価 | 本来の対象・母数 | 主な観測 | この用途への制限 |
| --- | --- | --- | --- |
| [ambient retrieval R1](../../experiments/ambient-shape-retrieval-evaluation-v1/REPORT.md) | 60 authored shape。正例60、clear no-shape40、unresolved20。description36/narrative12/explicit12 | full 正例受理hit14/60、正例受理22中誤形8、clear誤反応2/40、曖昧保留18/20。説明3/36、物語1/12、明示10/12 | 名前を含まない説明の形選択が弱い。本文の対象と部品を区別しにくい。仮の芸術ラベルへの成績で、実仕事の文分布ではない |
| [static Japanese fresh140](../../experiments/static-japanese-fresh-evaluation-v1/REPORT.md) | 60 label の全文検索。明確要求80、clear hold40、曖昧20。JA/EN均等だが label・言い回しは非対照 | 128-float32 guarded は受理hit23/80、positive受理23/23、clear誤反応3/40、明確層 joint23/26。JA21/40、EN2/40 | 100%は positive 受理に条件付き。引用・取消・矛盾の残存誤発火。長い本文の関係理解や一般英語能力を示さない |
| [student guard-v2 fresh120](../../experiments/widget-student-v2-fresh/REPORT.md) | 6 primitives の有限 Program、最大2部位＋1関係。意味要求60、clear hold40、曖昧20。表現可能44、範囲外関係16 | 全体 strict79/120、意味要求21/60、表現可能21/44、clear誤発火2/40。v1との差15は正しい保留13＋寸法補正2 | 60形や任意 mesh ではない。改善は guard/寸法規則。正例60中52は実 primitive query に train exact overlap を含む。残り8の student strict は0/8 |

ambient R1 baseline の 19/60、20/40誤反応、10/20保留と、static fresh140 baseline の 40/80、25/40誤反応は同じ率として比べない。文の構成、採点、call interface と registry が異なる。

student の生成32/32 schema/compiler/有限検査通過は幾何が処理可能だった証拠であり、正しい文章意図の証拠ではない。意味だけを緩めても、文字ID/色の喪失、非有限な点、面の崩れ、private 原文の漏出は品質失敗のままである。

## 候補リストは別の材料になるか

ambient R1 full の guard 前 raw top1 は30/60、返された top3 は41/60。非0-scoreに限定した事後診断でも41/60であった。自動受理hit14/60と同じ指標ではなく、top3なら人が好きなものを選べるという実測でもない。ranking を候補提示の材料にできるかを別に検討する入口にはなる。

static128 の raw top1 は48/80（permitted family49/80）、guarded hit23/80。これは同じ candidate 内で ranking と固定受理の差があることを示すが、ambient R1 の41/60と優劣比較するための同一文試験ではない。6 primitive subset の5/27も60 label の率へ加算しない。

候補選択を人へ丸投げすると、仕事の主課題から選択の手間を奪う可能性がある。top-k は常時パネルや通知にせず、任意に覗く比較から始める案である。好み・操作負担・無関心をまだ測っていない。

## 既定不採用が意味すること

不採用は『これらの小型処理に研究価値が無い』ではない。現在の自由本文を標準で自動変更へ流す根拠が不足している、という判断を維持する。軽量な lookup と選択済み geometry の速度、配備 parity、原文/IDの保全、意味の品質、人の快適さはそれぞれ別の成果である。

指示通りに cube を要求したのに square が出れば command では誤りである。ambient の文章で箱の表面へ正方形を連想することが許容されるかは、本人の目的による。現在の人工ラベルからその許容を確認できない。逆に、『アートだから何が出てもよい』とすると、内容に関連した形という目標を検証できなくなる。

既知の引用/否定失敗は今後の回帰材料として残す。今回再読した120/140/student120へ合わせた候補や policy は別版の開発であり、この集合を新しい未見評価と再命名しない。全文 exact 新規性と、実query/語彙/同一文書由来の新規性も分ける。
