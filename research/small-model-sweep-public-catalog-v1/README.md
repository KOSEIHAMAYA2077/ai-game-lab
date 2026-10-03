# 小型モデル比較・公開カタログ

Glyph Matterの文章から形・色・数・動きを選ぶ実験で使った、候補と取得条件の入口。モデルの宣伝用ベンチマーク、source上の対応、実際の応答を分けて記録している。これらは有限の形や手続き的パラメータへ文章を対応させるLLM候補であり、任意の3Dメッシュを直接生成するモデルではない。

| 資料 | 内容 |
| --- | --- |
| [初期候補 CANDIDATES-R2](../small-model-sweep-20261003/CANDIDATES-R2.json) | 最初の18 artifact。固定revision・filename・bytes・SHA・download URL。現在の候補確認はこちらを使う |
| [旧候補 CANDIDATES](../small-model-sweep-20261003/CANDIDATES.json) | 修正前の履歴。Ternaryの旧group128表記などがあり、R2と取り違えない |
| [公開metadata](PUBLIC-HF-METADATA-R2.json) | 探索時に読んだ23 repo records。template本文を取り除き、UTF-8 bytesとSHAだけを残した |
| [元モデルのmetadata](../small-model-sweep-20261003/UPSTREAM-METADATA-R1.json) | 元モデル16 repoのrevision・license・gate・言語タグ・API hash |
| [説明・licenseの読取原票](../small-model-sweep-20261003/SOURCE-READS-R1.json) | 固定URL・取得サイズ・SHA。本文を再掲載しない |
| [runtime sourceの読取原票](../small-model-sweep-20261003/RUNTIME-SOURCE-READS-R1.json) | 通常型とPrism型のsource pin、確認箇所 |
| [実験用runtimeのsource pin](../small-model-sweep-20261003/ROOT-RUNTIME-SOURCE-R1.json) | `b11342 / f1cee9941`の固定source。source確認とbinary実行を区別 |
| [runtimeと元モデルの照合メモ](../small-model-sweep-20261003/RUNTIME-AND-UPSTREAM-NOTES-R2.md) | 通常CPU・PQ2_0・I2_Sを別群とする根拠 |
| [取得・実行台帳](../small-model-sweep-ledger-20261003/INVENTORY-R1.json) | 重み23 artifactと、再試行を含む26 execution labelの対応 |
| [計画後の追加候補](../small-model-sweep-extra-20261003/CANDIDATES-EXTRA-R1.json) | Phi-3.5、Phi-4-mini、SmolLM3。最初18件を置換しない追加群 |

## 最初の候補と利用条件

初期群はBonsai/Ternary-Bonsai、Qwen、Liquid LFM、SmolLM2、IBM Granite、Microsoft BitNetを含む。実際のBonsai候補は1.7B・4B・8Bであり、重みの保存容量をparameter数と混同しない。Bonsai-8B Q1_0は約1.16GBのartifactだが、0.8Bモデルという意味ではない。Qwen3.5には別の0.8B候補がある。

初期候補18件のmetadata上のgateはfalse。Apache-2.0が13、MITが1、独自のLFM Open License v1.0が4。無料の個人研究比較と将来の製品同梱は分ける。LFMはApache/MITではなく、[固定LICENSE](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/blob/8ed288026e23958ad9dfa92d53ed773a8eee7125/LICENSE)にCommercial Useの年商10百万米ドルthresholdと配布条件がある。通知保持など各licenseの条件は引き続き適用される。[追加群の元license確認](../small-model-sweep-extra-20261003/README.md)も参照。

探索原票は採用した候補より広い。23 repo recordsには未選択の配布や取得失敗も含むため、選択artifact数や推論成功数に数えない。候補表の固定URL・サイズ・SHAと、取得後の照合結果も別の段階である。

## template本文を公開しない整理

元のAPI原票は143,498 bytes、SHA256 `618de915c6c3e5fde27965c1f6fd0f1415447d5fc0688a40126b1d0d291afc24`。原票は変更せずローカルに保管した。新しい公開metadataでは20個のtemplate文字列、UTF-8合計60,996 bytesを、それぞれのサイズとSHAへ置き換えた。architecture、gate、license、artifact metadata、取得失敗の状態を保持した。

templateのSHAは観測したAPI文字列の値であり、各GGUFから今回再抽出した値ではない。公開metadataに追加した固定revision API URLは導出した参照先で、この整理作業では再取得していない。既存の候補JSONにある`source_snapshot`は当時の私有原票を指す歴史的なfieldなので、元JSONを改変せず[REFERENCE-MAP-R1](REFERENCE-MAP-R1.json)で公開代替を示した。

## 検証の境界

sourceに型やarchitectureがあること、重みがloadできること、HTTPで応答すること、形式に合うこと、文章に合う形を選べることを分ける。固定SHAの一致は配布元と取得物の整合確認であり、malwareやparser安全性の証明ではない。

通常CPU、Prism PQ2_0、BitNet I2_Sは別runtime群で、再試行は同じ重みとして保持する。実験機はApple M5 / 32GiB RAMであり、16GBのIntel/AMD laptopやwidget全体での負荷を検証した結果ではない。このカタログ整理は新しい取得・build・推論・アプリ採用を行わない。

## 公開範囲

[明示allowlist](SUGGESTED-INITIAL-ALLOWLIST-R1.json)は初期フォルダから公開する8ファイルと、ローカルに保持する6ファイルを列挙する。古い入口、raw API原票、raw原票を必要とする取得・生成script、当時の広いmanifestは、新しい公開入口からリンクしない。削除や上書きはしていない。

[初期AUDIT](../small-model-sweep-20261003/AUDIT-R1.json)は整理前のローカル検査の履歴であり、現在の公開リンクを保証する一覧ではない。新しい[AUDIT-R1](AUDIT-R1.json)で、公開版のtemplate除去、structured field保持、原票不変、リンク先の公開予定範囲を確認する。
