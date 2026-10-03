# 小型モデル比較の取得・実行台帳

2026-10-03。凍結した候補表、実験担当の取得・SHA照合記録、公開の実行summaryを独立に突き合わせた。新しい推論やダウンロードは行わず、既存資料を変更していない。[INVENTORY-R1.json](INVENTORY-R1.json)に、この照合時点のartifactと実行labelの対応を保存した。

| 数える対象 | 件数 | 重みの正確なbytes |
| --- | ---: | ---: |
| 最初の計画から新規取得 | 18 | 12,313,259,360 |
| 計画後の追加群から新規取得 | 3 | 6,800,412,256 |
| 今回の新規取得合計 | **21** | **19,113,671,616** |
| 既存cacheを再評価 | 2 | 1,843,871,904 |
| 異なるSHAの重み合計 | **23** | **20,957,543,520** |

bytesは取得後に保持されたGGUF artifactの大きさ。失敗・再試行を含む通信量、runtime・CMake・sourceの取得量、RAM、常駐負荷は含めない。23は量子化や蒸留variantを分けた重みファイル数であり、独立したモデル系列が23あるという意味ではない。

21件すべてで、実験担当の`downloaded-and-verified`記録のbytes・SHAが固定候補と一致した。公開の最初18件の取得記録とも一致。cache2件は今回のpreflight SHAに加え、[CACHED-BASELINE-METADATA-R1.json](CACHED-BASELINE-METADATA-R1.json)で固定revisionの公開APIからサイズ・SHA・gate・licenseを照合した。この台帳担当が約21GBの全ファイルを再度読み込んでhashを計算したわけではない。

## 重みと実行labelは別に数える

公開summaryは**26 label**、異なる重みSHAは23。labelごとの状態は`completed`23件、`startup_failed`2件、`query_timeout`1件。

- stock runtimeのPQ2_0とI2_Sは起動失敗の記録を保持している。品質の誤答に数えない。
- 同じPQ2_0重みを公式Prism runtimeで再試行し、別labelで24応答を得た。
- Phi-3.5の初回は処理が完走しても24件すべて`invalid_response`。templateの互換修正後の別labelでは24応答があり、同じ重みSHAのままである。
- BitNetは同じI2_S重みを修正runtimeでも試したが、最初のqueryがtimeoutで、有効な応答を取得していない。weightとruntimeが存在することだけで推論成功に数えない。

ケース状態は`reply`528件、`invalid_response`24件、`timeout`1件。これらは再試行を含む実行イベント数。22個の異なる重みartifactで少なくとも1件の`reply`があった。`reply`は意味の正答、`completed`は形式適合や成功率を意味しない。意味の評価は別の評価資料へ委ね、この台帳では採点していない。

## 無料利用と配布条件

23 artifactのlicense内訳はApache-2.0が16、MITが3、LFM Open License v1.0が4。固定配布metadataのgateは全候補falseで、ログインやゲートの迂回を必要とする候補を台帳へ追加していない。

無料の個人研究比較と、製品への同梱・再配布は分ける。Apache/MITの通知保持などの条件、[LFMの独自条件とcommercial threshold](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/blob/8ed288026e23958ad9dfa92d53ed773a8eee7125/LICENSE)を同じ許諾として扱わない。LFMはCommercial Useに年商10百万米ドルのthresholdを持つ。将来の配布版へ重みを同梱する承認や無条件の商用利用をこの台帳で与えているわけではない。[初期調査の利用条件](../small-model-sweep-public-catalog-v1/README.md)と[追加群のlicense全文確認](../small-model-sweep-extra-20261003/README.md)を参照。

Gemma3-270M-it / Gemma3-1B-itは公式repoが利用条件への同意を求めるmanual gateのため、gate無しの追加群から除外。別配布経由での同意の迂回はしていない。古いgroup128のQ2_0も、現Q2_0 group64やPQ2_0と名前だけで混同せず、実取得・実行した固定SHAだけを数えた。

## 照合範囲

各artifactはcanonical ID、配布repo、revision、filename、bytes、SHA256、固定download URL、license出典、対応する公開実行labelを持つ。各labelはweight SHAとruntime・prompt・fixture・driverのSHA、公開summaryのhashを持つ。取得元が公式か変換配布かも保存した。元モデルの固定revisionを確認できても、そのrevisionが変換者の実際の入力だったと証明できない場合は、先行調査の限界を引き継ぐ。

試行機はApple M5 / 32GiB RAMのCPU serverであり、16GBのIntel/AMD laptopや描画を含むwidget全体の実用性を検証した結果ではない。公開metadataとSHA照合は完全なparser安全性の証明でもない。個人のパス、非公開log、本文、raw modelcard sourceは台帳へコピーしていない。
