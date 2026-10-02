# 読取・取得記録

2026-10-03 JST。一次本文を確認したことと、論文全体・参考文献・全図を読了したことは同じではない。次の範囲を根拠にした。[主張の対応表](LITERATURE.md)と[SOURCES.json](SOURCES.json)を合わせて読む。

| ID | 使用した版・本文読取範囲 | 図表を目で照合した範囲 | 未確認 |
|---|---|---|---|
| S1 Informative Art | Johan Redström博士論文 *Designing Everyday Computational Things*, Report20, 2001-05の著者再録。印刷pp125〜156 / PDF物理pp133〜164の要旨と§1〜7を読了。参考文献は選択確認 | 図のcaption/周辺本文を読取。原図の全視覚精読ではない | 原ACM組版12ページとの逐語差分、参照されたChatterBox評価の原データ |
| S2 Slow Technology | 同じ大学PDFの出版前稿。印刷pp161〜187 / PDF物理pp169〜195の要旨と§1〜7を読了。本文の©2000/To be publishedを確認。出版社の最終書誌は2001-08, pp201〜212 | 例のcaption/説明を読取 | 最終出版版との逐語差分。博士論文全254ページを読了とはしていない |
| S3 Heuristics | 著者Morgan Ames公開8ページPDF。要旨、指針設計・比較方法、結果、discussion/conclusionを確認。特にPDF pp5〜8を本文で精読 | 表2・結果の検定文・結論を抽出テキストで照合 | 背景の全精読、評価者/既知問題の生データ、実作業での効果 |
| S4 FireFlies | TU/e公式公開PDF、publisher組版＋repository cover。本文§5〜9（印刷pp483〜503）の方法・分析・結果・限界・結論を読了。§1〜4は部分確認 | 図5/6/11/13/14の数表をテキストで確認 | 背景の全精読、映像原本、実験参加者への独立確認。本文の視方向分類をeye trackerとしない |
| S5 Slow qualities 2024 | 著者lab公開16ページPDF。本文/注釈pp1〜12読了、参考文献は選択確認 | PDF p5の時間粒度/密度の図を画像として視認 | 全ページの図面視認、新規被験者実験、設計数値の最適性 |
| S6 NoticeLight | arXiv v1のHTML本文を導入〜結論まで読了。PDF第一ページのworkshop/権利/対象場面を照合 | 第一ページのcaptionを読取 | 実装・参加者実験は報告されていない。想定効果を達成値にしない |
| S7 Beyond Project Time | 著者lab公開16ページPDF。§3〜6（PDF pp4〜14）の方法・年次場面・discussion・限界を読了。序論/関連は部分確認。公式DIS2026目次で収録を照合 | 年次場面はテキスト読取。写真の全視覚精読ではない | raw corpus、一般化、効果量。元の5人8か月論文を今回本文読了とはしない |
| S8 Incidental Visualizations | arXiv 2608.07271 v1、2026-08-07。HTMLの導入〜結論を読了し、PDF pp7〜9の方法/結果/表を再確認 | PDF p8の図5/6を実画像で照合。図6の1〜5尺度と4.2.1の小数値の不一致を確認 | 生データ再解析、査読採択、periodic秒間隔/継続時間、長期PCへの適用 |

原論文の全文・図・長い翻訳をここへ転載していない。要旨から入った資料についても、上の本文確認後に結論を修正した。S8では要旨の印象だけでincidentalを採用しない。S4では面接上の慣れと、記述集計の縦断傾向を区別した。S3では要旨の「改善」を個人平均の有意差と同一視しない。

## 探索範囲と入口

親担当が提示したInformative Art、Slow Technology、FireFlies、Mankoff2003、Incidental Visualizationsを入口に、著者/大学/公式会議で関連本文を辿った。Homeware LabのOlo Radioページから2024/2026の著者PDFへ到達した。2025のNoticeLightは著者のarXiv本文とworkshop情報を確認した。検索は公開論文名・著者・ambient/peripheral/slow technology等の公開語だけで、ユーザーの作業本文を送っていない。

網羅的検索、重複除外の全記録、全2024〜2026論文の採否審査ではない。「新しい研究が存在しない」「この研究が初めて」とは結論しない。追加の新規性調査は、具体的な入力取得・痕跡保存・3D文字面・安定した有限形の仕様を確定してから別に行う。

## 到達できなかった資料と回避しなかった制限

| 資料・取得先 | 状態 | 扱い |
|---|---|---|
| redstrom.seのInfoArt/SlowTech著者ページ/PDF | timeout、502、TLS hostname mismatch等。httpも失敗 | TLS検証を解除しない。大学公開博士論文の再録を使用。最終版差分は未確認 |
| FireFliesのresearch.tue.nl/files URL | 403 | 同じ公式機関のpure.tue.nl公開ファイルへ到達。権限回避ではない |
| *Designing Smart Home Technology For Passive Co-Presence Over Distance*, DIS2024、著者lab候補PDF | 取得応答がPDFでなく保存を拒否。論文名/DOIは探索したが本文未確認 | 本表の結果根拠に使わない。CHI EAの博士研究提案とDIS本論文を混同しない |
| Springer Slow Technology最終出版版 | 書誌/要旨のみ公開、本文購入案内 | 課金・機関認証を試みない。大学再録と区別 |
| ACM本文ページ | 一部403/到達不可 | 著者lab/公式会議の公開資料のみ使用 |

本文未確認資料は設計効果の根拠に加えていない。検索結果の混成要旨や第三者の要約は結果の根拠にしない。

## 取得と再確認の方法

PDFはHTTPSの公式/著者公開URLから、20MiB以下、先頭`%PDF-`を確認して読取用に取得した。リモートコード・モデル・依存を実行せず、既存のPDFテキスト抽出と画像レンダリングで読んだ。TLS検証を維持した。合計7ファイル約8.45MiB（2章は同じ博士論文PDF）で、原本のURL・取得時刻・bytes・SHA256をSOURCES.jsonへ残す。新しい原本ファイルの同名上書きを拒否した。

`.cache/` はこのフォルダの.gitignoreで除外しており、取得した本文・抽出テキスト・図の検査画像を配布に含めない。著者/機関の原URLを案内する。権利表記はSOURCES.jsonに原本に見えた範囲を記録し、二次配布許諾を推定しない。S3/S4/博士論文等は著作権のある研究資料として扱う。

この調査はローカルの文献読取・日本語資料作成のみ。Macの画面/他アプリ/ユーザー入力を取得せず、モデル追加ダウンロード、課金、連絡、公開操作はしていない。
