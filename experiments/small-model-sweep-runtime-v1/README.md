# 小モデル比較のCPU実行器 R2

固定したpromptと独立した人工文を、単独のllama-serverへ順番に渡す実行器。既存のゲーム・モデル・実行器は変更しない。モデルのダウンロードやモデル付属Pythonの実行はしない。ここで行った確認は人工HTTPサーバーだけで、実モデルの精度・性能はroot担当の別原票へ記録する。

## 固定条件

- CPU、`--device none --gpu-layers 0 --no-op-offload --no-kv-offload`。
- thread 4 / batch thread 4、context 2,048、parallel 1、batch 256 / ubatch 128。
- reasoning off、prompt cache off、temperature 0、seed 17、output上限256token、stream false。
- 起動のhealth確認は60秒以内。入力ごとのHTTP要求・全返信は30秒以内。`--batch-seconds`の全体期限が先ならそちらを採る。
- timeout・応答4MiB超・通信故障では原票と状態を保存し、自分の子サーバーを終了して、そのモデルの残りの文は未試行のまま残す。
- SIGTERMから5秒待って終わらなければ、その子だけへSIGKILL。別のport所有者や他のモデルサーバーは停止しない。

既存の`consumer-16gb-20261002/run.py`のCPU条件を引き継ぎ、最大出力は今回の256へ変更した。1モデルずつ実行すること。driverはプロセス間での全体排他を実装していないため、同時に複数起動した測定は比較に使わない。

## 外部入力

`--prompt`はJSON object。`messages`を必須とし、`response_format`と`chat_template_kwargs`をそのまま保持する。実行器は本文を改変しない。`--fixture`はlistまたは`{cases:[...]}`。各文の`case_id`（旧形式の`id`も可）と`text`だけを使う。`expected`・`rationale`・`group`はモデル要求へ渡さない。IDは英数字、`_.-`の80字以内。driver作者は独立fixtureの本文・正解を読まずに実装した。

12形の`action/shape/color/count/motion`契約への形式検査を行う。`contract_ok`は有限契約に収まることのみで、文章を正しく解釈した意味精度ではない。JSON全体を厳密にparseし、説明やMarkdownを除去して修復しない。NaN等の非JSON数を拒否する。

## 実行

```sh
python3 experiments/small-model-sweep-runtime-v1/run_r2.py \
  --server /path/to/verified/llama-server \
  --model /path/to/verified/model.gguf \
  --label model-cpu-r1 \
  --prompt experiments/small-model-sweep-v1/prompt-r1.json \
  --fixture experiments/small-model-sweep-evaluation-v1/cases-r1.json \
  --port 4220 --batch-seconds 900
```

既存labelへ上書きしない。defaultでは公開候補の安定した統計を`results/<label>/`、要求・原返信・stderr・owned PID・端末固有pathを`.local/<label>/`へ分離する。`.local/`はGit除外。rootは人工文のみであることを確認してから原返信を公開・採点してよい。

`.local/<label>/responses.jsonl`は各行`{case_id, raw_text, status}`。`raw_text`はHTTPの`choices[0].message.content`そのまま。`status=ok`はHTTP200と文字列contentの受信を表し、契約・意味PASSを表さない。timeoutは`timeout`、他の取得失敗は`error`。未試行の文は行を作らず、summaryの`unattempted_case_ids`へ残す。

## 時間・RAMの読み方

`model_file_bytes`は取得済みファイルのbyte数で、RAMではない。初回ダウンロード時間はrootが別記録する。事前hash読取は`preflight_hash_seconds`で起動計時から分離する。この読取によってfile cacheが温まり得るため、起動時間をcold-loadと呼ばない。

`startup_seconds`は子起動からowned portのhealth成功までのwall time。caseの`seconds`はHTTP要求開始から全返信を得るまでで、返信ファイルの保存や意味採点は含めない。server自身が報告したprompt/predicted時間とtoken数は別欄。client token/sは返信token数を要求全時間で割った値で、純decode速度とは異なる。初回queryにも特別なwarm-upは足さない。

`peak_server_rss_bytes_sampled`は自分の子のRSSを約250ms周期で観測した最大値。瞬間peak、driver、OS、小窓、全体RAM、消費電力は含まない。サーバーを止める待ち時間は`elapsed_seconds_including_shutdown`へ含む。形成・描画の時間はこのdriverで測っていないため、入力から完成まで30秒の達成とは言わない。

## 実行器の人工検証

```sh
cd experiments/small-model-sweep-runtime-v1
python3 -m unittest test_r1 test_lifecycle_r1 -v
```

人工19件を最終R2で再確認し、19/19成功した。R1の最終再検査ではtrickle timeoutにおけるHTTP closeの競合1件が出たため、R1 sourceを保持し、watchdogはsocket shutdownだけ、closeは要求threadのfinallyだけへ変更したR2を作った。JSON契約、説明/Markdown/NaN拒否、chunked HTTP、ヘッダーと本文のtrickle deadline、SSE拒否、応答上限、owned終了、timeout保存、既存listenerの保持、expectedを要求へ混ぜないこと、原contentのJSONL保存を対象にした。実モデルの起動・推論は0件。最初のsandbox内試行はloopback bindの権限不足でtransport開始不可、同じ人工試験を許可された実行環境で実施した。詳細は[テスト記録](TEST-RESULTS-R1.json)。

## Bonsaiのruntime確認

[公式b11342のggml.h](https://raw.githubusercontent.com/ggml-org/llama.cpp/b11342/ggml/include/ggml.h)のenumには`GGML_TYPE_Q1_0 = 41`と`GGML_TYPE_Q2_0 = 42`が存在する。したがって、型名だけを根拠にb11342非対応と断定しない。これはCPUで実際のGGUFが動く証明ではなく、モデルのarchitecture・metadata・quant配置との互換はrootの起動原票で判断する。

[PrismML fork](https://github.com/PrismML-Eng/llama.cpp)の現default branchは`prism`。[そのggml.h](https://raw.githubusercontent.com/PrismML-Eng/llama.cpp/prism/ggml/include/ggml.h)には同じQ1/Q2と私有PQ2/PTQ1がある。stockとforkの共有libraryを混ぜず、forkが必要な場合は公式の固定commit・対応library一式を別folderへ取得する案。取得・build・実行はここでは行っていない。公式raw CPUquant source取得はcache missで未確認。`master`は別枝なので現在のdefaultと混同しない。
