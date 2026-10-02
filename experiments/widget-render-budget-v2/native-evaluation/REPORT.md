# 描画Candidate Aの実macOS比較

配列容量と転送範囲を減らした候補Aでは、同じ1,665文字の身体で通常表示のcharged footprintが低い値になった。一方、**アプリ全体のCPU削減は再確認できなかった**。基準をもう一度測るとCPUが候補より低くなり、最初の差だけを改善率として採用できない。通常200MiB・CPU1コア換算5%の候補予算は、今回も未達である。

## 条件と帰属

2026-10-03、Apple M5 / 32GB、macOS 26.5.1。400×440の専用WKWebView小窓、通常15fpsを指定。人工入力から保存済みの同じ1,665文字／最大1,536描画を復元し、各版の間で文字を追加せず、モデルを起動しなかった。元の本文や色は共通だが、シーンの時刻は各起動で進むため、全サンプルを同じアニメーションの位相で止めた比較ではない。

**基準R2 → 候補A → 基準R2再測定**の順。最初の基準は起動約41秒後、候補と基準再測定は約70秒後から90秒を採取した。再測定は候補と近い暖機時間・同じ1,332フレームで、初回の起動条件差と順序の影響を見落とさないために行った。単一の短い探索比較で、複数PCや反復試験の統計的結論ではない。

起動前後の差、basename、同一のresource/jetsam coalition、主担当の実Quit後の4PID消滅から、専用アプリ・GPU・Networking・WebContentを帰属した。他のWebKitプロセスは加算しない。0.5秒間隔で採取し、成功窓の全サンプルに対して保存/描画文字数、停止/表示状態、Workerなし、同じPIDとcoalitionを[集計コード](summarize.py)で照合した。

メモリはプロセス別charged footprintの同時刻合計で、共有を完全に重複除外したシステムRAM差分ではない。CPUはMach timebase換算済みの[helper](../../widget-companion-v1/evaluation/native_metrics.c)と[サンプラー](../../widget-companion-v1/evaluation/sample_native.py)を用い、4PIDのCPU時間差÷実時間差×100で算出した。100%は1論理コア。JavaScriptで囲んだ描画処理の経過時間と区別する。

## 通常表示90秒

|測定順|1コア換算CPU|charged footprint中央値|同時刻ピーク|終了値|テレメトリによるフレーム差/実時間|
|---|---:|---:|---:|---:|---:|
|基準R2|13.278%|218.93MiB|223.83MiB|222.21MiB|1,258 / 90.001秒、約13.98fps|
|候補A|12.110%|207.60MiB|209.14MiB|207.50MiB|1,332 / 90.007秒、約14.80fps|
|基準R2再測定|11.798%|215.39MiB|215.55MiB|212.69MiB|1,332 / 90.010秒、約14.80fps|

候補Aの中央値は両基準より約7.8〜11.3MiB低い観測値になった。ただし各版1回の短窓であり、allocatorやOSによる変動を含む。長期の安定値・リーク解消や、16GBノートPCで同じ差を得る保証とは扱わない。

初回基準とのCPU差は8.8%減だったが、同じ暖機時間と同じフレーム数の基準再測定に対しては候補が約2.6%高い。**全体CPUの改善率は確定しない**。[描画だけの比較](../README.md)で得た24〜36%という経過時間削減を、専用アプリ全体のCPUへ換算しない。配列・転送を小さくする構造上の改善を保ち、次は別に曲面計算・描画頻度と全体負荷を比較する。

原票と配布物の識別: [最初の基準](baseline-r2-calm.json) / [候補](candidate-a-calm.json) / [基準再測定](baseline-r2-repeat-calm.json)、[基準manifest](baseline-r2-manifest.json) / [候補manifest](candidate-a-manifest.json) / [再測定manifest](baseline-r2-repeat-manifest.json)。基準は公開タグ`glyph-matter-v0.14.0-widget.1`のZIPを新しく展開したR2。候補は描画ソースを保存したcommit `6788869c79ae3fcda4777a81b4775ff6a6e363e6`から別アプリへ同梱した。manifestの38件のWeb資産hashが測った実行物を特定し、測定終了後も全資産のhashが変わっていないことを再確認した。

## 停止・非表示

|窓|状態と結果|1コア換算CPU|charged footprint中央値/ピーク|
|---|---|---:|---:|
|基準R2の停止30秒|表示中・paused=true、全61サンプルでframes=2,316固定|0.653%|176.74 / 178.39MiB|
|基準R2の実非表示30秒|停止を解除して実Hide、paused=false、frames=2,385固定|0.0099%|223.35 / 223.38MiB|
|候補Aの実非表示30秒|停止を解除して実Hide、paused=false、frames=3,549固定|0.0472%|163.57 / 163.63MiB|

実非表示では両版とも描画停止・低いCPUを確認した。非表示時のRAM差を描画の変更だけへ帰属しない。基準の非表示前は停止から再開した直後でWebContentのfootprintが増え、候補は操作・待機の経過も異なる。これらは通常表示の対照窓ではない。

候補Aの停止は2回採ったが、条件外として資源比較から除外した。[1回目](candidate-a-paused.json)は実UIの停止後も診断ファイルがpaused=falseを保持し、[検証](candidate-a-paused-stale-telemetry-validation.json)に失敗した。ネイティブの1秒の書き込み抑制が最後の状態変化を保存せず、その後描画停止で更新が来ない経路がある。主担当がnative「表示」で強制保存し、[2回目](candidate-a-paused-r2.json)ではpaused=true・フレーム固定を確認したが、途中から実窓が覆われてnativeVisible/webvisibleが変わり、[表示条件の検証](candidate-a-paused-mixed-visibility-validation.json)に失敗した。どちらも成功値で上書きしない。2回目はフレームが進まない証拠として残すが、「表示中停止30秒」のCPU値には採用しない。診断の保存修正は次版へ送り、この比較中のアプリは変えていない。

[基準の停止](baseline-r2-paused.json) / [基準の非表示](baseline-r2-hidden.json) / [候補の非表示](candidate-a-hidden.json)。元の基準をQuitした後のUI状態呼び出しが同じアプリを再起動した場面もあり、その再起動は採取しなかった。もう一度実メニューで終了し、全PIDが消えた後に候補を起動した。[最初の基準の終了](baseline-r2-exit.json) / [再起動分の終了](baseline-r2-relaunch-exit.json) / [候補の終了](candidate-a-exit.json) / [基準再測定の終了](baseline-r2-repeat-exit.json)。各帰属グループの4PID全ての退出を確認した。

## 次の測定へ残すこと

通常表示のRAMをさらに下げる候補は、常に2048×2048を持つ文字atlasを、必要な行数だけ確保して増やす方式。CPUは、まず低頻度の曲面更新＋描画時の補間を別案として調べ、表面の連続性と文字の同一性を検証する。局所ベンチで良くても、専用窓の対照計測で良くなるとは限らない。

16GB laptop CPU/iGPU、Windows、GPU使用率、電力、20分以上の連続安定表示、30分・2時間の常駐は、この記録では未測定。90秒を長期常駐と呼ばない。
