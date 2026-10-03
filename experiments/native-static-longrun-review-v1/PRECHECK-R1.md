# 100 分観測の途中監査

監査計画は実行開始後、途中原票を読む前に固定した。最終結果を見て採否条件を作ったものではないが、実験開始前登録でもない。

root 固定入力 8 件は byte/SHA 全一致。保存済み原票だけの初回算術では ordinary 2 回、long4000 1 回、ps 58 回が有効。追加 native 照会・独自 ps・OS/UI/GPU 操作は 0。最終 SUMMARY が無いので完走は未判定である。

longText の「球」4000 Unicode scalars は 4001 tokens になり token_limit で保留された。mean/vector が無く ranks=[] である。予定の長文 4 回はトークン化と保留境界の観測であり、4000 文字 embedding/ranking が完了した 4 例とは扱わない。ordinary とこの経路を最終集計で分ける。

独立 helper 初稿 R1 は token count が常に 4000 以下という余分な仮定を置き、初回途中原票で 1 件構造 FAIL を記録した。METHOD にある hold/空 rank 整合へ合わせた R2 を別名で保存した。R1 source/result と失敗は保持し、root source・fixture・予定照会数・15 秒締切を変更していない。R2 の同途中照合は errors=[]。これは helper の訂正後の算術であり、fresh native 実行の成功件数に加算しない。

source review で残る境界:

- 初期 PID discovery は try/finally の外。RUN 保存がある今回の初期発見は成功済みだが、発見失敗時の cleanup は保証されない。
- 最終 verify_freeze が summary 保存より先なので、drift 例外では最終 SUMMARY が欠け得る。最終原票無しを成功としない。
- progress JSON は write_text で更新される。実行途中に一時的な部分 JSON を読む可能性があり、最終 byte/SHA 保存後に最終照合する。
- stdin FileIO write の戻り byte は照合されない。今回の返答確認と一般的な入力 transport 保証を分ける。
- sampled PID/PPID は source 内で照合されるが、原票は process start identity を保持しない。失敗 cleanup の numeric PID の再利用境界は独立証明していない。
- native JSONL outer input framing は未実装。driver の reply 1 MiB guard はその代替ではない。

CPU は native /usr/bin/time の user+sys/real と、丸めた ps TIME 差/標本区間を分ける。ps RSS、返信時 charged footprint、time -l lifetime peak RSS は同一メモリ指標ではない。driver・ps・他のアプリの CPU/RAM を native へ加算しない。6000 秒枠、最後の照会、最後の標本、EOF・終了は別時点である。

最終原票受領後の再現（repo root、モデル起動なし）:

```sh
python3 experiments/native-static-longrun-review-v1/audit_r2.py --output experiments/native-static-longrun-review-v1/FINAL-01.json
```

helper の completionChecksSatisfied は source 不変、予定返信、正常終了、time -l 存在という CLI 完走の照合である。標本区間と欠測は separate fields に残し、常駐ウィンドウ、全入力、描画 FPS、電力、16 GB PC、意味精度、リーク不在への合格判定には使わない。前の独立 20+4/709 parity と合算しない。
