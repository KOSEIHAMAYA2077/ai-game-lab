# 一次資料との対照と読取範囲

確認日2026-10-03 JST。目的を絞った読取で、systematic review / 網羅的新規性調査ではない。今回のweb確認は公開論文名・公開URLだけを送り、利用者の本文を検索・送信していない。著者全文や図を転載・配布しない。既存 [HCI本文調査](../side-interior-hci-v1/READING_LOG.md) を入口として再確認し、今回読んだ範囲を以下に限定する。

| ID・一次資料 | 今回の確認範囲 | 研究案に使うこと / 使わないこと |
| --- | --- | --- |
| P1 Pousman / Stasko, *Ambient Information Systems: Evaluation in Two Paradigms*, 2007 | 著者PDFの冒頭〜評価枠組み、pp1–3を部分読取。workshop position paper、Pervasive正式出版ではないと冒頭が明記 | 妨げ・理解・生活への取り入れ方を別の問いとして立てる理由。数分の成績を長期利用の証拠にしない。実験による効果保証ではない。[本文](https://faculty.cc.gatech.edu/~john.stasko/papers/pervasive07-eval.pdf) |
| P2 Bakker / van den Hoven / Eggen, *Evaluating Peripheral Interaction Design*, HCI 2015 / online2014 | 機関PDFの参加者、映像符号化、§8.2と結論を部分確認 | FireFliesは教師6人・4教室・6週間。映像と面接から慣れを検討したが、正式な頻度 / 時間集計で明確な縦断傾向は出ていない。物理教室の操作とPC小窓は違う。6を人数の万能基準にしない。[本文](https://pure.tue.nl/ws/portalfiles/portal/17749128/07370024.2014.921531.pdf) |
| P3 Mankoff et al., *Heuristic Evaluation of Ambient Displays*, CHI2003 | 著者公開PDFの研究目的・参加者節を確認。結果の全再解析なし | 評価者16人を8人ずつの指針比較。目的は問題発見方法で、実作業の快適性試験ではない。少人数点検と人間比較を区別する。万能な5人則を採用しない。[本文](https://www.ocf.berkeley.edu/~morganya/research/chi2003-ambient.pdf) |
| P4 Odom, *Beyond Project Time*, DIS2026表記の著者版 | 著者PDF §3.2–3.3、§6、書誌を部分確認。全図 / corpus未確認 | 元の5人8か月研究とは別の1人・追加4.5年の記述研究。非使用、置き直し、故障と手入れを含む。断続corpusから参加者と改稿した年次vignetteで、一般利用率 / 生産性 / 効果量の試験ではない。[本文](https://www.homewarelab.com/assets/pdfs/beyondprojecttime_dis2026.pdf) |
| P5 Heitor / Moreira / Gonçalves, *Incidental Visualizations*, arXiv2608.07271v1、2026-08-07 | abstract / 版、HTML §3.2–3.4、§4.2–4.5を部分確認。原データ、図の目視、査読採択未確認 | Quest3 / 工学系18–24歳30人、Sudoku / Connect Four、None / ambient / periodic / incidentalの参加者内比較。理解 / 主課題 / 妨げを別測定。PC創作・文字痕跡・長期利用と条件が違い、最良scheduleや無害を転用しない。[v1本文](https://arxiv.org/html/2608.07271v1) |
| P6 Lakens, *Sample Size Justification*, Collabra2022 | 出版社のabstract、人数理由の表、resource constraints節をweb本文・出版社検索結果で確認。全論文精読ではない | 人数を推論目的・情報価値・資源と結びつける。6人を効果確認の既定数にしない。この案は問題発見の形成的pilotで、検出力計算を行ったとは言わない。[出版社本文](https://online.ucpress.edu/collabra/article/8/1/33267/120491/Sample-Size-Justification) |
| T1 NASA公式TLX | 現公式ページの説明・6尺度・manual参照指示を確認。manual読了 / 尺度実施なし | workloadを正式に測る場合の入口。独自3問をTLXと命名しない。[公式](https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/) |
| T2 Task Bar Hero開発元 | 公式overview / 底部配置説明を確認 | 作業窓を覆わない配置の参照。学術的比較、入力API、実CPU/RAM、日本語確定取得の根拠ではない。[公式紹介](https://www.nugemstudio.com/en/games/taskbar-hero) |

P1 / P4は効率だけでなく本人の意味づけや時間を扱う理由になる。P2は映像・面接と集計の食い違いを残す方法、P3は前段の点検方法を考える入口。P5は主課題 / 副情報理解 / 妨げを分離する実験例。これらから、このアプリの快適性・愛着・創作成果が得られたとは推論しない。人数、100units、8分、固定球、動き条件、TTLなどの具体値はrepo / 本案の未検証選択であり、文献の最適値ではない。

## 最新AR論文から採用しない推論

P5 §4.3の主課題差は著者報告でConnect Four `p=.157`、Sudoku `p=.451`。これを無害 / 同等性の証明にしない。§4.2.1の中央値は5-point妨げ尺度の説明に対して `0.953` 等の小数で、正答率と同じ値が載る。尺度変換・誤植の説明を確認できていないため、この中央値を比較案の根拠に採用しない。また§4.2 / 表2注の「分散0群との比較を自動的に有意」とする扱いを、われわれの検定仕様へ移さない。[該当v1本文](https://arxiv.org/html/2608.07271v1)

既存HCI担当はPDF図6を目視し尺度不整合を報告したが、今回担当はHTMLを部分確認しただけで、独立に図を見たとはしない。原データ再解析、periodic秒間隔 / 継続時間、査読採択は未確認。ambientとincidentalの普遍的順位をこの資料から選ばない。

2026年の長期P4も1事例の解釈的年次場面であり、4.5年ぶんの均一time-seriesや一般的採用率ではない。8時間の工学計画や数十分pilotを、同じ種類の長期関係の検証と呼ばない。[P4方法](https://www.homewarelab.com/assets/pdfs/beyondprojecttime_dis2026.pdf)

## 新規性と次の読取

今回の文献確認は、有限入力契約・素材の一意所有・意味と表示の時間分離をどう評価するかの設計に限定。Taskbarゲーム、ambient情報表示、slow technology、3D文字表現を網羅比較していない。「初めて」「新規性を証明」「先行例なし」は主張しない。将来の研究中心と対応source能力を決めた後、明確な検索式と採否記録を持つ別調査を行う。
