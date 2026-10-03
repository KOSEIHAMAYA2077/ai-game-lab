# 小モデル比較・26実行の独立評価

2026-10-03。元の [README](README.md)・[REPORT-R1](REPORT-R1.md)・R1manifestは保持。追加3重み、BitNetのpatched runtime、Phi3.5のtemplate互換診断を別labelで追加した。

- [追加結果・全26実行と未評価の境界](REPORT-R2.md)
- [主採点の全26実行](results-r1/CHECKPOINT-R5.json) / [追加診断](results-r1/CHECKPOINT-R5-diagnostics.json)
- [raw入力・元HTTP出力の照合](results-r1/CHECKPOINT-R5-export-audits.json)
- [公開人工exportの一覧・SHA](PUBLIC-EXPORT-AUDIT-R2.json)
- [人工24文と期待値](cases-r1.json) / [固定した採点器](score.py) / [凍結SHA](FREEZE-R1.json)
- [BitNet sourceのread-only確認](BITNET-PATCH-SOURCE-REVIEW-R1.json) / [metadata名とSHAの追認](BITNET-PATCH-METADATA-REVIEW-R2.json)

23種類の重み・26実行。22種類が各24件のmodel返信を返し、528返信を独立採点した。共有loader失敗2実行、Phi3.5 defaultのHTTP400×24、BitNet patchedのquery timeout×1は、意味誤答と分けて記録する。最高全項目一致はBonsai4B Q1 / Phi4-miniの17/24で、標準widget採用の検証ではない。

## 原返信から主採点を再現する

`raw-public-r2/` に各labelの元exportを公開する。人工fixtureからの出力だけを対象に、キー・私的path等のパターンを確認してから、**元bytesを変更せず**コピーした。SHAは元の評価rawと同一。全553行のうち528がmodel本文、残り25はHTTP400またはtimeoutで本文が空の失敗record。起動失敗2labelは空ファイルとして保持する。

標準Pythonで `score.py --cases cases-r1.json --raw raw-public-r2/<label>.jsonl --output <新しい結果JSON>` を実行できる。保存先は既存ファイルと重ならない名前にする。必要なfixture、採点器、原返信はこのfolder内にある。downloadやmodel実行なしで主採点を再現できる。

score JSONの単独フィールド一致は形式違反も0点とする固定指標。結果後に依頼されたdiagnostics JSONは、厳密5キーJSONの元のフィールドを他の属性エラーから分ける原因分析で、返信の修復や再採点ではない。

別担当の新しいshape-only評価216返信は別のfixture・契約であり、ここでの528返信へ合算していない。
