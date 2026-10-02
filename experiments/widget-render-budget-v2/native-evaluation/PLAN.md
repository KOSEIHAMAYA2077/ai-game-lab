# 同じ身体での小窓描画比較

基準は保存済みv0.14.0-widget.1のR2 Web資産、候補は描画Candidate A。主担当が実UI、生成、起動、終了を所有し、評価担当は読み取り専用のmacOSプロセス計測と本フォルダの記録だけを所有する。

- 同じApple M5 / 32GB macOS、400×440窓、人工入力から保存された1,665文字、最大1,536描画、通常15fps。モデル推論は使用しない。
- 起動前後のプロセス差、プロセス名、同一coalition、実Quit後の終了から専用アプリとWebContent / GPU / Networkingの4PIDを帰属。他ブラウザのWebKitは加算しない。
- 静かな通常表示90秒、停止30秒、停止を解除して非表示30秒を測る。操作が終わった後、状態のテレメトリを確認してから各窓を開始する。切替中のサンプルを含める場合は別の状態として扱う。
- 同じ人工身体を復元したA/B、余裕があればA/B/A。アプリ2個を同時表示せず、モデル評価・ビルド等のCPU負荷は比較窓の間避ける。
- `proc_pid_rusage`のcharged footprint合計は、共有メモリを完全に重複除外したシステムRAM差分ではない。同時刻の合計ピーク・中央値・終点を記す。RSSとモデルダウンロード量は別の値。
- CPUは既存の校正済み[helper](../../widget-companion-v1/evaluation/native_metrics.c)でMach timebaseをナノ秒へ換算し、4PIDのCPU時間差÷実時間差×100で求める。100%は1論理コア。描画hookの経過時間とは別の測定。
- [既存サンプラー](../../widget-companion-v1/evaluation/sample_native.py)を明示PIDで使用し、各サンプルの保存/描画文字数、paused、nativeHidden、visible、Worker生存数を照合する。
- 原票には人工入力と数値だけを残し、私的パス、個人文、認証情報を含めない。16GB laptop CPU/iGPU・Windows・GPU使用率・電力は未測定。

90秒は短い比較窓であり、長時間の常駐・リークが無い証明ではない。計算上の配列削減だけで全体CPU/RAM削減が達成されたとは扱わない。
