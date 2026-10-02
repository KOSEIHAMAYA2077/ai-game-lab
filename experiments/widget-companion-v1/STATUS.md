# 小窓版の継続状況

## 最新: 2026-10-03 02:43 JST

追加の使用像は、創作・プログラミング・仕事中の入力を材料に育つサイドインテリア。既存の改良を継続し、02:37から8時間の設計分析を追加。新期限10:37 JST（2026-10-03 01:37 UTC）、10:17から新機能を止めまとめる。専用caffeinateはPID83393へ置換（8時間限定、旧専用52785だけ終了）。同タスク20分継続3d-5も更新済み。今回の追加は使用想定と分析であり、OS全体入力監視を開始・設定変更していない。Macロック時は解除を求めずoffscreen/コード/資料を続け、通常窓の計測としない。

### 保存した区切り

- A v0.14.1 / tag `glyph-matter-v0.14.1-widget.2` / commit `ca65073` / PR #25はmainへmerge。Pages run37037565082成功、旧5版と新widget-v2の6manifestを確認。macOS Release ZIPの新展開先strict署名成功。関連4PIDの基準→A→基準CPU13.278→12.110→11.798%から全CPU改善は未確認、RAM低い観測値でも200MiB/5%未達。
- Bはbranch `experiment/widget-atlas-student-v3`、統合commit `8acd4f3`。段階atlasをwidgetだけON、根性60形・メビウス・生き物を保持、guard-v2 tinyを約122KBの実験選択肢へ遅延読込。旧保存を触らないkeyv3 / bundleIDv3。23実WebGL UI回帰、15吸収完了最長3.95秒、174単体成功。atlas48GPU条件のCanvas全一致/GPU最大2/255以内は論理画像比較でnativeRAM未測定。
- exact8acd sourceを隔離production buildし、32k/1536・全文/旧色・reload容量回帰成功。native0.14.2 R1新アプリはBuildInfo source/web全hash・strict署名成功、実nativeUI未確認。公開前の独立reviewで、kind1024上限で追加0の入力が消える不具合と入力previewの選択色不一致を再現。rootは追加0でdraft/shape/pauseを保持、previewと送信の色優先順位をそろえる修正を行い、型/174単体成功。再production/独立UI確認後に新R2を公開する。R1と失敗原票は保存。
- tiny fresh120: guard-v2全体79/120、表現可能21/44、明確な保留の誤反応2/40。全文訓練一致0でも分類クエリに大量一致。AI合成意図、人間評価なし。既定60形を置き換えない。
- static retrievalとfresh140は所有返却済み。全1024guard正解30/80・要求受理34/80・保留誤反応5/40、128guard23/80・受理23/80・誤反応3/40。日本語21/40、英語2/40。1024mmap独立PythonRSS約90MiB/p95約0.136msは窓全体ではない。128f16は最終判断一致、生top1 139/140一致。未知文字span失敗を別v3診断へ保持。既定採用見送り、研究比較に保持。
- Metal R5は別AppKit/Metal/CoreTextアプリの球/箱/メビウス。CPU1213/GPU581確認と3offscreen画像、BuildInfo/strict署名成功。ロック中startupはframe0で通常資源測定から除外。60形/rig/model/実IMEは未移植/未検証。

### 進行中と所有

1. root: widget-main/state/版管理/研究map/STATUS/公開。追加0・色修正後のB production確認と独立reviewを受け、新tag/URL/Releaseへ保存する。R1は上書きしない。
2. `static_fresh_evaluation`: `experiments/widget-v3-release-review-v1/`だけ所有。凍結8acd productionの独立source/UIレビュー、不具合原票と修正後回帰。共有sourceはrootだけ編集。
3. `static_japanese_retrieval`: `research/widget-study-protocol-v1/`だけ所有。既知形・保留付き解釈のRQ、比較/分割/少人数人間評価/資源制約を設計。最新サイドインテリア像と命令/ambientの差を反映。
4. `widget_metal_comparison`: `experiments/widget-metal-soak-v1/`だけ所有。frozenR5から2時間offscreen実時間表示、PID83137/session36101、02:35:33〜04:35:33 JST。explicitPID sampler session1218、5秒周期。1536文字400x440/15fps、10分毎の3形切替・人工入力/atlas成長・旧ID/色保持を記録。offscreen一process資源で窓全体のRAM/CPUではない。原文/旧アプリにアクセスしない。

### 次の一実験

Bを安全に公開し、全旧manifestが同じことを確認。新しい分析の主軸は他アプリ入力連動で、キーイベントとIME確定文字・貼付・編集差分を分け、macOS/Windows一次APIと権限/制約から方式を選ぶ。命令入力の解釈と、通常文を低頻度で視覚へ反映するモードを分ける。人工イベントで蓄積・重複・取消・負荷・情報を保存しない経路を比較し、実入力の監視はまだ開始しない。研究文書には実装済み/未実装、AI合成/人手、未見/回帰、offscreen/窓、取得量/RAMを分けて残す。


以下は01:10時点の履歴。最新の判断は上の節を参照する。

2026-10-03 01:10 JST。現在branch experiment/widget-render-budget-v2。8時間の改良を許可取得、期限08:25 JST（前20分は公開とまとめ）。期限付きスリープ防止と20分間隔の継続実行が有効。旧4版と小窓基準版はタグと公開URLを保持。

## できたこと

- 別のwidget.html、AppKit/WKWebViewの400×440小窓。通常15fps、吸収30fps、停止/非表示で予約を停止。入力時だけモデルWorkerを作り、処理後終了。原文/色/形は保存。描画1,536文字と保存32,000文字を分離。
- 独立ブラウザ7人工入力、Worker終了/再生成、3秒停止・hidden契約でframes/time差0、復帰時に飛びなし、reloadで全バッチ一致。10秒通常14.78fps。独立評価の原票と報告はevaluationへ保存。
- native実画面でEnter→日本語paste→白い球を確認。CUAのtypeTextは日本語文字が欠けたためpasteへ切替。日本語IME全体を検証済みとはしない。
- native4PIDを帰属して球385文字の30秒を測定。合算charged footprint peak271.7MiB、1コアCPU10.07%。目標200MiB/5%は未達。主PIDだけのRAMではなくWebContent/Networking/GPUを含む。同一システムのunique RAMやGPU負荷とは異なる。
- 保存の文字種類上限で復元が拒否される不具合、モデル準備中断後にボタンが無効のままになる不具合を修正。公開WebのBFCache復帰も修正。修正後ビルド/アプリはこれから再検証。

## 今の実験

基準v0.14.0-widget.1をcommit 6831396、PR #24、独立tag/widget-v1 URLとmacOS arm64 Releaseへ公開した。Pages成功、旧4版と小窓の5 manifest SHAを確認。公開WebのEnter→日本語paste→青いメビウスを実操作確認。入力時のピーク・通常CPUとも予算未達。研究地図と独立評価REPORTもmainへ保存済み。

候補Aは表示容量に配列を合わせ、定着後の一時計算とGPU転送を削減。989フレーム・6,766,826成分の最大差0、7形の実WebGL画素一致、短時間の描画関数mean24〜36%短縮。これから同じ人工身体でnative4PIDを比較する。新規v0.14.1では容量末尾でも送信原文全文を保存する修正を含む。基準版は変更しない。

独立小型解釈器freeze-1は122,601 bytesのchar n-gram線形分類＋手作業の範囲/否定/属性規則。6形・最大2部位・1関係まで。学習/閾値/runtime/データSHAを固定してから、別担当の未見90人工文で評価開始。アプリへまだ統合していない。既存MiniLMの重みは変更していない。

## 次

1. 描画候補Aを新しいアプリへ作り、基準R2と同じbody/画面/時間で通常・停止・非表示を比較する。
2. freeze-1の未見評価を保存し、採否と制限を決める。学習担当へ評価例を見せた後の修正は別版の回帰評価として記す。
3. 次の改善は別版として、面の近似補間・atlas容量・origin独立保存などから測定結果を根拠に一つずつ試す。未実装/未検証を達成と書かない。

native R2の初回署名でDesktopのFinderInfo属性によりエラーが出た。今回新規生成したアプリのその属性だけを除き、再署名とstrict検査を通したが、Desktop側が後に同属性を再付与し、その場所での再検査は失敗した。Release ZIPはresource fork/拡張属性を含めず、別の新規場所への展開とstrict署名検査が成功。公開ZIPとDesktopの属性状態を混同しない。旧アプリやデータ・OS設定は変更していない。基準R1原票に加え、同bodyでのR2資源再測定をこれから行う。
