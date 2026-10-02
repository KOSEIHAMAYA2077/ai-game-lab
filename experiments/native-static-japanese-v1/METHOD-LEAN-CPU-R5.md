# Lean CLI CPU/footprint 計測 R5

R4 の最初の非 TTY 対話応答が返らなかった原票を残し、R5 では JSONL 回答ごとの明示 flush と autoreleasepool を追加する。前者は transport、後者は Foundation 一時 object の寿命管理であり、tokenizer・pooling・rank・閾値・期待値は変更しない。R4 blocked の原因は buffering を疑った段階で、変更後に応答するかを観測する。R4 と R5 の 709 件は同じ既知回帰であり、新しい意味精度評価ではない。

R5 の 709 件 parity 合格を確認してから、固定済み元 calibration 112 人工文を 200 warm call、112×10＝1120 timed call、4000 scalar の日本語・ASCII・emoji 反復を各 20 call、4001 scalar 拒否を 1 call。最初の cold call と合わせて 1382 call。旧 target は driver で読み取らず、shape registry の raw cosine ranking だけを実行する。query 内部時間は single-pass encode→rank、JSONL 往復時間は別指標。

各応答は 15 秒、全 batch は 300 秒を上限とする。失敗時にも status/error を新 JSON に残し、driver が作った専用 process group だけを終了する。stdin/stdout は人工文字列だけ。Python 標準 library は測定 driver であり native runtime に含まれない。time -l の測定対象は native 子 process だけで、親 Python のメモリとは分ける。

first response、200 warm 後、1120 timed 後、4000 scalar 各種後の task_info resident/physical footprint、高水位と time-l 終了 peak を保存する。mmap 8MiB は file/virtual の値であり、全常駐 page や process RAM の値ではない。caption index 175616B は Float32 payload だけ。709 全 output の parity harness は別 process、別メモリ母数。

この短い Mac CLI batch は、全 widget、Windows 16GB、電力、8 時間常駐、すべての 4000 scalar 文の最大時間を実証しない。CPU 競合は統制しない。モデル・元 tokenizer・343 caption・EXPECTED・比較 gate を変えず、追加の意味品質・UI・GPU・OS 取得・保存・アプリ既定への接続は行わない。
