# 比較方法 v1

2026-10-03 13:52–15:52 JSTの承認済み比較。候補は18個の新しい重みartifactと既存2個の対照。同系列の量子化差・蒸留差を別の基盤モデル数に数えない。計画は初回返信前の[EXECUTION-PLAN-R1.json](EXECUTION-PLAN-R1.json)に固定した。

## 入出力と凍結

日本語の人工文から、有限12形・色・個数・動きのJSONを提案する。新しいメッシュを自由生成する試験ではない。旧アプリの形辞書や輪っかの解釈は変更しない。比較contractでは一面性のあるねじれた帯をmobiusとし、単なる輪は未対応とする。

prompt/schemaを先に凍結し、独立担当が24人工文（名前、外見の比喩、属性、保持を各6文）を作って固定した。相談に使った2文は除外。rootはprompt確定前に独立fixtureの本文を読んでいない。出力を見てprompt・期待値・重み・閾値を調整しない。モデルに渡すのはcaseのtextだけで、期待値・解説・groupは送らない。評価は[固定方法](../small-model-sweep-evaluation-v1/METHOD-R1.md)と独立score.pyで行う。

JSON schemaによるgrammar制約は全候補共通。形式が正しくても意味の成功と扱わず、5属性の全一致を分ける。整形・修復後の得点を主結果にしない。

## 実行条件

Apple M5、32GiB RAMでCPUのみ。llama.cpp b11342 / `f1cee9941b0e843ea260bf8dd9a090fbd9711b6a`、4threads/4batch threads、GPU layers 0、device none、KV/operator offloadなし。context2048、batch256、ubatch128、parallel1。temperature0、seed17、max出力256tokens、thinking off、prompt cacheなし。固定driverは[run_r2.py](../small-model-sweep-runtime-v1/run_r2.py)。

一度に一つのモデルだけを起動。取得・ハッシュ処理の完了後に本測定を始める。各モデルの起動期限60秒、要求のHTTP往復全体30秒、batch900秒。タイムアウト時は当該モデルを終了し、未試行を記録する。起動・HTTP/grammar互換の失敗を意味解釈0点と同列にしない。source登録の確認は実ロード成功の代わりにしない。特殊runtimeは別群で条件を併記する。

fileのbytes/SHA256、runtime binary、driver、prompt、fixtureのSHAを記録する。起動前のhash読み出しはfile cacheを温めうるので、cold startupの実測とは言わない。毎回独立のserverを起動し、同じモデルの前caseは会話として残さない。

## 時間とメモリの境界

起動時間、各返信のHTTP全体時間、serverが報告したtoken速度、終了込みbatch時間、取得容量を分ける。RAMは250msごとのowned server RSSで、driver・描画・OSを含まず、短いpeakを見落とす可能性がある。重みfileサイズを常駐RAMやウィジェット全体負荷と扱わない。事前hash・ダウンロードは返信時間に含めない。

M5/32GiB上のCPU結果は、16GB Intel/AMD＋iGPUノートでの実証ではない。今回の24文は小さな固定probeで、日常文章全体や未知形一般の成功率を推定できない。旧5形・20文の複雑なprogram試験とは問題が異なるため得点を直接合算しない。

## 取得・公開

無料・gateなしの固定GGUFを取得し、配布元のbytes/SHAを照合する。モデル提供のremote code、pickle、install scriptは実行しない。宣言的な重みと公式配布の確認は、parserを含む完全な安全証明ではない。LFM系は独自licenseのため将来の商用配布条件を別途確認する。

私的な本文は使用せず、モデル推論はloopbackのローカルのみ。重み・server log・端末の絶対pathは.localへ保ち公開しない。公開は人工文の原返信、測定集計、model metadata、再現手順。既存版・app・save・tag・URL・モデルを削除しない。15:42以降は新モデルを始めず、記録の公開と今回の継続実行停止を行う。
