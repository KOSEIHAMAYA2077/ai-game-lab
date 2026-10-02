# 独立レビュー：文字・色・中断・公開版の保持

2026-10-02 10:44 UTC。`experiment/physical-twist-v1` の作業中の版を読み取り専用で確認した。モデル担当が追加の調整をせず、操作と境界条件を点検した記録であり、別担当の独立意味評価・62 操作の時間測定とは別に扱う。この記録以外のソースは変更していない。

## 普通の操作

実際の Chrome で `program.html` を開き、入力を 1 回だけ追加する設定で、人工例 `赤い棒の先に球` → `青い箱の上に球` → `今日は文章だけを残す` を送信した。

- 最初の 2 入力はそれぞれ tube＋sphere＋end、box＋sphere＋above になった。
- batch に保持された本文は入力と同じで、赤と青はそれぞれの batch に付いた。後の入力によって、既存 batch の本文・色・seed は変わらなかった。
- 通常の文章では、新しい文字だけを追加して、直前の Program を保持した。
- ページの実行エラーはなかった。

ソースでも、文字へ渡す本文と、モデルへ渡す色を除いたコピーが分かれていることを確認した。対応していない構造や geometry の場合は、新しい Program を描画へ反映せず、以前の形を維持する。これは未知の文章すべてを正しく判定するという保証ではない。

## 中断の確認：意図的に遅らせた場合

以下は異常時の確認のための遅延であり、普通の処理時間の測定ではない。

1. 実モデルの最初の取得だけを 1,500 ms 遅らせ、`黄色い球の上に箱` を送信した処理中に「最初へ」を押した。背景のモデル準備が完了した後も、文字数 1、Program なし、batch と timings は空、busy は false だった。モデルが準備済みになることはあっても、古い入力は反映されなかった。
2. モデルの準備後、ローカル Worker への interpret メッセージだけを 1,500 ms 遅らせた。`白い棒の先に大きな球` を送信した直後に、方式を「規則」に切り替えた。遅れた Worker の結果を待っても、文字数 1、Program なし、batch と timings は空、busy は false、方式は rules のままだった。

ソース上の sequence と AbortSignal による無効化、および client が中断済みの request ID を処理しない仕組みも確認した。上の 2 操作で、遅れて完了した結果の反映は見つからなかった。

## 通信

実モデル準備中の外部通信は、固定された公式モデルの tokenizer と ONNX 資産、およびその公式キャッシュ/CDN へのリダイレクトの GET だけだった。全リクエストの body はなく、入力本文を送る通信は観測しなかった。期限つき CDN URL はこの記録へ保存しない。

Worker の fetch は固定 URL を使い、本文はローカル Worker のメッセージとして渡される。入力を URL や送信 body に加える処理、sendBeacon、入力送信用の WebSocket は対象ソースになかった。この確認は今回のソースと操作に限る。

## 公開版の分離

公開 workflow は、それぞれ別の固定タグを checkout し、別の出力先へ構築する。

| 出力先 | 参照 |
| --- | --- |
| root | `glyph-creature-p0-v0.11.0-rigs.1` |
| `skeleton-v1/` | `glyph-matter-v0.12.0-skeleton.1` |
| `program-v1/` | `glyph-matter-v0.13.0-program.1` |
| `twist-v1/` | `glyph-matter-v0.13.1-twist.1` |

既存 3 版のコードを新しい twist のコードで置換する構成にはなっていない。相対 asset base と各版の version.json も確認した。twist タグの作成と実際の公開後の Web 動作は、この読み取りレビューの時点では完了判定していない。主担当が公開時に確認する。

## 判定と範囲

確認した条件では、原文文字と batch 色の破壊、未知入力による旧形の消失、中断後の古い結果の反映、本文の外部送信、既存公開版の置換という重大な破綻は見つからなかった。任意の文章への一般化、全 geometry の見た目、一般的な PC での速度は、このレビューの判定対象ではない。

記録時の SHA-256（geometry は別担当による最終 guard 修正が続くため、公開タグの hash とは別）：

| 対象 | SHA-256 |
| --- | --- |
| `program-main.ts` | `5073bdd2e8bc22d2941cd1af1ea39bf3226c30b35adf1643e600ffbeb1eedc17` |
| `scene.ts` | `06421363c9542865d4d44c46959185b331bc11b31ac167cdcea328901de0b566` |
| `scaffold-program.ts` | `699e0ec1d3f5ec16b8ab19a8b5fe498d09a625395b3a739052aa9d542a5e6aa8` |
| `scaffold-model.worker.ts` | `7c3984d6ef9ac84b7af9ea1aa196ebe4d143cae984589019b7e679c1ff3e2db3` |
| `scaffold-model-client.ts` | `3115ec5e0698ef4e960ec4d916d9ec8bd6777372120ac07bcfea9207690f18e6` |
| `playable-pages.yml` | `df05a39211437574fe619022963e09336da039552dbc8048dd8c82d4ab36a7c4` |
