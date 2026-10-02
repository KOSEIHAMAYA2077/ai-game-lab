# Metal v2 と WK v3 の小窓資源比較・事前計画

2026-10-03。**測定前の固定計画。実測はrootが行う。** この担当は数値helperと人工データの検証だけを行い、アプリ・UI・OS設定・PIDの起動/停止・Gitを操作しない。

## 対象と差

- Metal v2 R2: `renderer=metal-lab-v2`。人工fixture 1,536文字（最初の@を含む）、球shape=0、白、時刻24秒から吸収後。fixtureは履歴読取・保存を無効にする。source/shader/app実行物のSHAはrootが別記録。
- WK v3 0.14.2 R2: 別namespaceへ人工文を入力して、球・白・1,536描画・モデルなしへ合わせる。保存総数が違うなら、その値を固定して明記する。既存の本人の履歴を変更しない。
- 論理viewport400×440、描画解像度相当1、通常15fps。WKのWeb診断にはviewport/shape/atlas/cameraがないので、rootのscene inspectionとUI記録をexpectation sidecarへ保存する。
- raw batch、seed、文字材料ID、文字の種類、形成・吸収の履歴は完全一致でない可能性がある。同じ文字数を「完全同一の身体」と呼ばない。
- Metal v2は有界な面・quadのカメラ下限とfarを使う。WK v3のカメラ式は同じではない。構図差を記録する。
- MetalはCore Text `HiraginoSans-W3` 42pxでセルへfit。WKはCanvasの42pxフォント列 `Hiragino Kaku Gothic ProN / Yu Gothic / Noto Sans CJK JP / monospace` とbaseline調整。実フォントの選択と字形画素は同一としない。
- Metal instance=1,536×80=122,880B、uniform=176B。atlas RGBA/rows/kindsは診断値を保存。WKはscene.inspectのatlas pixelBytesと、CPU attribute配列/描画bufferの観察値を別欄にする。byteを足した値からアプリRAMを推測しない。

## 実測順と条件

1. 起動前・起動後・終了後の帰属をrootが確認する。expectationには主PID、帰属PIDごとの役割・開始counter・resource/jetsam coalitionを固定する。WKのApp/GPU/Networking/WebContentを明示し、Metalは主PIDと帰属を示せる子だけ。共有compiler等を一律に加算しない。
2. shader準備・初回atlas・WK入力/保存/モデル準備を通常区間に含めない。起動から最低60秒経過後、動きが定常・1,536描画・モデルなしを確認。キャッシュ削除はせず初回起動をcold cacheと呼ばない。
3. **通常90秒→実pause30秒→pause解除後の実Hide30秒**。各操作後3秒以上と、診断の一致を待って開始。0.5秒間隔で既存の校正済sample_native.py/native_metrics.cを使う。
4. 通常とpauseは実窓が表示・遮蔽なし。hiddenはpause解除を保った実Hide。ロック/遮蔽/状態不一致の区間は原票を残して条件外とする。
5. 測定区間にはheavy CPU/GPU test/build・モデル実験を重ねない。rootがquiet区間の開始・終了を担当へ連絡する。旧2時間soakは動いていない。単にagentの存在だけを無負荷の証拠にはしない。
6. 一つのアプリだけを表示し、実Quit後に帰属全PIDの消滅を確認して次へ。必要ならWK→Metal→WKの反復を新原票で行う。

## helper の事前判定

- 毎sampleの明示PID集合、開始counter、coalition、数値の有限性・非負、monotonic増加とCPU counter非減少を検査。欠測・再利用・負値を0として合算しない。
- 90/30秒はsample counterの実経過で±2秒、interval=.5、最大sample間隔1.5秒。不足や遅延は条件外。
- body総数/描画数/状態/モデルなしを全sampleで確認。Metal renderer名とshape/error/viewport/zoom、WK appVersionとnative/web可視性を確認。rootが別にUI状態とsnapshot不足を記録する。
- 通常はframe counterが非減少で、全区間の描画counter速度14〜16/秒を候補範囲とする。1秒周期の診断の遅れを含むためpresentation FPSではない。pause/hiddenはcounter不変。
- CPUは同じPID開始counterのuser+system差を実時間で割り、PID別と合計を再計算。sample_nativeの集計値も照合する。
- charged footprintとRSSは各sampleの同時刻合計からfirst/median/peak/lastを算出。各PIDの生涯peak合算は別に残す。システムunique RAMとは呼ばない。
- source/expectation SHAを残す。validationが通っても見た目・同体・16GB laptop・GPU使用率/電力の合格ではない。CPU5%/charged200MiBは候補予算の表示だけで、測定の妥当性と分ける。

計画をSHAで固定してからhelperの人工データ検証に入る。測定後に基準を変える場合は別計画・別原票として記す。
