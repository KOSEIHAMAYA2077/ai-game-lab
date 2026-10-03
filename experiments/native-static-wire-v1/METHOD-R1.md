# 固定日本語特徴の bounded・本文なし CLI 入口

2026-10-03。既定のbody/renderer/UI/OSには接続しない別CLI。元R5 core prefixをbyte同一で再利用し、tokenizer/128F16 table/mean/rank/captions/意味policyは変えない。Python/PyTorch/新modelをnative実行へ追加しない。

- JSONL 1行 content（LF除外・CR含む）32768 byte cap。4096 byte単位でstdinを読み、上限超過でbufferを捨て改行までdiscard、frame_limitを1 reply、次の行へ復帰する。EOFのunterminated最終lineを1件処理、空のEOFは追加replyなし。
- 3必須key requestId/text/registry、extra拒否。requestIdはBoolean以外・非負safe整数0..2^53-1。-0/1.0等も数値として整数ならcanonicalに返す。idはcorrelationだけでdedup/順序保証なし。textはString、registryはshape/primitive。UTF8/JSON不正、schema不正、未知registryを固定holdとして返し、未知文字列をechoしない。
- replyは固定5key requestId/registry/ranks/hold/elapsedMs。nullableはJSON null、ranks上位3 label/scoreのみ。token/piece/normalization/vector/本文/captionIndexを返さない。2048 byte cap（LF除外）を検査してからpartial-writeを処理する。diagnostic stderrも固定カテゴリのみ。
- 正常requestは元encoderのinput4000scalar/token4000/normalize262144byteとholdを保つ。空白・未知token・否定等の意味policyを変更せず、raw cosine rankをconfidence/受理にしない。
- 最初のvalid requestで固定model/captionを遅延初期化、同process内で保持。初回elapsedは初期化含む、後続と混ぜない。取得済みmodelとcaptionのSHAを検査。初期化失敗は固定stderrカテゴリで終了、pathや本文を返さない。
- 1行ずつ同期処理。request取消、epoch/stale、timeout、real IPC認証、OS監視、CPU制御、modelの寿命制御はこのCLIで未実装。本文は処理中のmemoryに存在し、text-free responseは匿名化や本文取得許可の証拠ではない。
- Foundation JSONSerializationの重複key解釈に従う。duplicate-key拒否の保証を追加しない。

実行前にsource/binary/旧core/model/captionと人工fixtureを固定。作者の少数known回帰は元R5のtop3/holdとの比較、独立担当は新source未読でwire期待を別固定する。失敗・修正は別版とし元原票を保持する。外側protocolの正しさと意味精度、全widget・16GB Windows・電力・human0を分ける。

算法は[tokenizersの固定Apache-2.0由来](../native-static-japanese-v1/PROVENANCE.md)、modelは旧pinのMIT。新sourceは元prefix＋新entrypointで構成し、[LICENSE](LICENSE)を保つ。model/codeを再取得・変更しない。
