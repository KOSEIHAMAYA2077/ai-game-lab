# Native Static 長時間観測の独立監査 R1

この監査計画は root の 100 分実行が始まった後、最終結果と途中原票を読む前に固定する。実行前登録とは呼ばない。新しいモデル照会、OS 操作、独自プロセス観測、閾値調整はしない。

対象は native-static R5 の CPU CLI と人工入力の保持・返信・終了の観測。実ウィンドウ、描画、IME、全アプリ入力、16 GB PC、電力、意味理解、メモリリーク不在の評価ではない。過去の独立 20+4 配備 parity や 709 回帰件数と本件を合算しない。

## 固定する確認項目

1. root FREEZE の 8 入力ファイルの byte/SHA、RUN の開始 UTC・native PID・time wrapper PID・driver PID を保存し、完走後にも再検算する。数値 PID の保持だけで process start identity を独立証明したことにはしない。
2. 予定 ordinary 20 回（0..5700 秒、300 秒間隔）と long4000 4 回（0/1800/3600/5400 秒）をそれぞれ検算する。request JSONL の byte/SHA を人工 fixture から再計算し、返信は 1 項目ずつの順序・有限値・hold/空 rank の整合だけ確認する。形の意味正解は採点しない。
3. 入力送信時刻、予定からの遅れ、RPC wall、推定受信 elapsed=sent+rpc/1000、UTC と monotonic の差を分ける。15 秒 timeout、1 MiB driver reply guard と native 側 input framing 未実装を混同しない。
4. 10 秒標本は理想 600 回（0..5990 秒）だが、実順序は query 後の ps、各 loop 1 標本なので catch-up/jitter/欠落を数える。ps RSS、返信の charged footprint/maxRSS、time -l lifetime peak RSS は異なる母数。ps は source で PID/PPID を照合しているが原票に start identity を残さない。
5. ps TIME は丸め済み。先頭から末尾の差分 CPU と観測秒、time -l の native user+sys と native real を別々に再計算する。one-core CPU%=100*(user+sys)/real。driver、time wrapper、ps、他の app/GPU は分母・RAM に含まない。0 interval がゼロ負荷の証拠にはならない。
6. 6000 秒は driver monotonic の実行枠。/usr/bin/time real は Popen 起動から EOF 終了までで僅かに異なる。last query、last ps、stdin EOF、child exit の時点を同一視しない。正常 exit 0、failure null、末尾余分 JSONL 無し、最終 SHA 不変を完走に必要な条件として扱う。
7. 初期 PID 発見は try/finally 外、最終 verify_freeze は summary 保存より先、write_text は非 atomic、stdin FileIO write の戻り byte 未照合、終了時 numeric PID kill は start identity 未照合という source 境界を保留する。実際の失敗の有無は最終原票と区別する。実行中修正しない。
8. saved reply は人工 query の pieces/normalization/vector/rank を含む。ユーザー本文、clipboard、window title、個人絶対パスを公開しない。運転 source の runtime absolute paths と公開原票中の private path を分け、失敗 message に混入し得る点も確認する。
9. 中断・欠落・timeout・source drift・不正 JSON は隠さず separate outcome。以前の 30 分中断や他の 2 時間 offscreen を足さない。並行 CPU/Git/build がある limited host で、無負荷・因果比較として解釈しない。

固定期待は予定観測の照合用であり、実アプリ品質の採否 gate ではない。完成前の raw snapshot は interim と明記し、final が無ければ完走を報告しない。
