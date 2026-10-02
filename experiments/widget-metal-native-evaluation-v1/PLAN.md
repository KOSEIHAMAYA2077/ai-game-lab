# Metal小窓とWK小窓の資源比較・準備

状態: **準備のみ、通常表示の実測は未開始**。主担当がMacのロックを実UIで確認したため、解除可能になるまで表示中の比較を始めない。ロック・遮蔽中の低いCPUや描画停止を、通常表示の性能として採用しない。OSの設定変更や解除操作は行わない。

## 比べる対象

- Metal: 別アプリの3形比較版。`--fixture 1536 --shape 0 --metrics-file /absolute/new.json`で人工白球を生成。fixtureは元のhistoryを読む・保存する処理を両方スキップする。1,536には最初の@を含む。人工本文は`文字のかたちABCDあいうえお12345@?`を繰り返し、時刻24秒へ進めて吸収後にする。
- WK: 保存したCandidate Aの描画ソースを使い、別の人工fixtureの白球／1,536描画で比較する。既存の本人の保存を変更しない。保存文字数・文字種・色・seed・入力履歴・カメラ・atlas容量と実viewportを記録する。Metalと一致しない要素は明記する。
- 外窓400×440、pixelRatio相当1、15fps。Metalはdrawableをviewの論理pointの大きさへ設定し、WKは既存のpixelRatio1を使う。文字の見え方が全pixel同一、60形と3形の全機能が等価であるとは扱わない。
- 機種はApple M5 / 32GB macOS。16GB laptop CPU/iGPU、Windows、GPU使用率と電力は別の未測定事項。

## プロセス帰属と窓

主担当がアプリ生成・実起動・入力・停止・Hide・Quitを所有する。評価担当は新しい本フォルダと無視.localだけを編集し、UI・既存ソース・Gitを変更しない。

1. 起動前のPID/basenameを無視.localへ保存。起動後の主PIDから同じcoalitionと明確な子・関連PIDを調べる。WKのApp/GPU/Networking/WebContentを4PIDで帰属する。Metalは主PIDと明らかに帰属する子だけを採る。全世界のMTLCompilerService等を見つけただけで加算しない。
2. shader準備と最初の計測を別記録にする。Metalの`shaderCompileMS`は`makeLibrary`からpipeline作成までの壁時計経過時間で、OSの専用CPU時間ではない。rootからPIDを得る前にcompileが終わっていれば、compile中の同時刻RAM/CPUピークは未測定とする。最初のPID countersは起動からそこまでの累積として残す。driver/compiler cacheを消さないため、初回アプリ起動を完全な空キャッシュと呼ばない。
3. 両版とも起動約60秒以降の通常表示90秒を0.5秒間隔で採る。通常は停止解除・非表示解除・モデルなし・1,536描画を全サンプルで確かめる。CPU/GPUの重いテストやbuildを同時に走らせない。
4. 実停止30秒、停止解除後の実Hide30秒。各操作後3秒以上待ち、診断stateが一致してから開始。途中にロック/遮蔽や不一致があれば原票を残して条件外として除外する。
5. 実Quit後に帰属した全PIDの消滅を確認。アプリ2個を同時に表示しない。通常表示の差が小さい場合はWK→Metal→WK再測定の順でも確認する。

## 値の読み方

[校正済みhelper](../widget-companion-v1/evaluation/native_metrics.c)をそのままコンパイルし、[明示PIDサンプラー](../widget-companion-v1/evaluation/sample_native.py)を使う。Mach ticksをtimebaseでナノ秒へ換算し、CPU時間差÷実時間差×100を求める。100%は1論理コア。charged footprintはプロセス別の同時刻合計で、共有を完全に重複除外したシステムRAM差分ではない。合計ピーク・中央値・終点、全PID別CPUを残す。生涯ピークの合算を同時刻ピークと呼ばない。

Metal診断はflat JSONの`frames, storedGlyphs, drawnGlyphs, paused, hidden, scheduled, preferredFPS, shape, width, height, metalErrorCount`。WK診断はnative fieldsと`web`内の`frames, storedGlyphs, renderedGlyphs, paused, visible, workerCount`。Metal R3にfixtureMode fieldは無いため、CLI・source・隔離設定からfixtureとhistory無効を記録する。`submitElapsedP95MS`も壁時計経過時間で、OS CPU率やGPU実行時間ではない。

公開する原票には人工入力と数値だけを含め、私的パス・個人文・署名付きURLを含めない。source/shader/bundle資産のhashと実行物の版を保存する。offscreen描画・CPU/GPUの曲面照合が通っていても、実小窓の負荷・実UIの完了として代用しない。
