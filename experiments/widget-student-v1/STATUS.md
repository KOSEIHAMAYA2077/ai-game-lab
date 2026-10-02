# Tiny char student: status

2026-10-03。8時間の改良指示の一部として、巨大なencoderを常駐させずに有限6形Programを解釈する、独立比較実験を実装中。既存MiniLMとheadは変更しない。

- 所有: `experiments/widget-student-v1/` と新しい `src/widget-student*.ts` のみ。
- 人工文の意味・言い換えfamilyごとにtrain/devを分ける。最終の独立評価は別担当が新しく作成し、重み・閾値・データSHAを凍結するまで見ない。
- 文字1–5gram＋単語特徴のFNV-1aハッシュ、4096次元、sparse linear softmax。int16量子化済みのprimitive7class / relation4class。数値形状属性・否定・名詞範囲・親子順は規則。
- 自由なtext-to-mesh、LLM、Transformer、neural distillationではない。教師は作者定義の有限Program語彙から作る人工ラベル。
- 今はソフトへの統合前。精度・負荷・失敗を調べ、使える条件を決める。

## Freeze-1（2026-10-03 01:04 JST）

独立最終集合を未閲覧の状態で、データ・モデル・閾値・runtime・5unit・既存validatorのSHAを`FREEZE.json`へ固定した。初期学習1815例、family-held-out dev478例。raw top-1はprimitive315/368、relation97/110。受理はそれぞれ117、49で開発集合内の危険な受理0件。保留で既知文も取りこぼす。

モデル122601B、decoded重み＋既知率bitset91136B。Node単独の2000回でmedian0.030ms/p95.798ms、heap差1.08MiB/RSS差17.02MiB。全アプリ負荷、WKWebView、16GB一般ノートPCは未実証。モデル取得・外部入力送信なし。

5unitと型検査がpass。fresh90例の独立担当へ凍結manifestとruntimeの入口を通知した。作者本人は独立集合を見ず、最終評価後の変更は別版へ分岐する。rootによる統合判断待ち。
