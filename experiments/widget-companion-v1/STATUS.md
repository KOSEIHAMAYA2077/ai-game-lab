# 小窓版の継続状況

## 最新: 2026-10-03 02:10 JST

終了期限08:25 JST（前20分は公開とまとめ）は継続。期限付きcaffeinate PID52785と20分間隔の同タスク継続は有効。現在branch `experiment/widget-atlas-student-v3`。Macが01:52頃からロックされ、CUA実操作はできない。本人へ解除を求めず、OS設定や解除操作をせず、実装・オフスクリーン回帰・研究を続ける。ロック中の値を通常表示の資源測定にしない。

### 保存した区切り

- 基準v0.14.0と旧4版を保持し、描画A・保存修正をtag `glyph-matter-v0.14.1-widget.2` / commit `ca65073` / PR #25へ保存してmainへmerge。Pages run37037565082成功、新URL `widget-v2/` とmacOS arm64 Releaseを追加した。
- Aは989frame・6,766,826成分最大差0、7形の実WebGL画素一致。実macOSの基準→A→基準再測定はCPU13.278→12.110→11.798%、charged footprint中央値218.93→207.60→215.39MiB。RAMは低い観測値だがCPU削減は再確認できず、200MiB/5%未達。停止の失敗2窓も原票へ保持。
- 容量末尾でも送信原文全文を保存し、32,000保存/1,536描画・全原文/旧色のreload復元を実UI回帰で確認。公開commitを隔離して174単体・型・production build成功。Web保存key v2とnative bundle ID v2を分けて旧履歴を触らない。native停止診断の最終状態保存はR3実操作5秒smokeで確認。
- v2配布最終R5はZIP SHA256 `e69a8dd47a79f64f3ec939dcaeee0858ac69b7f0d3fa4cd25b90ebf317d0c474`、別新規展開先でstrict署名成功。保存key変更後の最終R5はMacロック後なので再操作未確認。旧Desktopアプリの属性問題は以前の記録通りで、既存アプリを変更していない。
- tiny freeze-1はJSON122,601B/展開91,136Bのchar n-gram線形分類。初回90文は訓練完全一致10文を除外して54/76、guard-v2は同重みに保留等の規則を加えた回帰62/76。新しい120合成文ではv1 64/120、guard79/120、規則58/120。表現可能正例44ではguard21/44、誤発火2/40が残る。全文訓練一致0でも切り出す分類クエリには多数一致。評価AIの合成ラベルで人間評価ではない。標準60形を置き換えない。

### 進行中と所有

1. `widget_render_budget`担当は `widget-main.ts` と新 `widget-atlas-student-v3/`。段階atlasをwidgetだけ有効にし、guard-v2を遅延読込の実験選択肢へつなぐ。tiny保留は形を保持して文字だけ追加し、60形へ救済しない。メビウスが有限programのringへ縮退する経路を別版で修正する。共有sourceへrootが同時編集しない。
2. sceneの段階atlas Bは所有返却済み、現在unstaged差分。default OFF、1→2→4→8→16→32行。48 GPU条件合格、Canvas全一致/GPU最大2/255以内。最初の最大11不合格と修正を `widget-atlas-budget-v3/` に保持。native RAM効果は未測定。
3. `widget_metal_comparison`担当は `desktop/glyph-metal-lab-v1/` と新実験だけ。AppKit/Metal/CoreTextで球/箱/メビウスを別アプリへ移植、GPUで位置と接線を計算。最終R5をCPU/GPU/offscreen検証・原文1MiB上限・排他的保存・BuildInfo SHAとともに準備中。UI/全CPU/RAMは未測定、60形/モデル未移植。
4. `static_japanese_retrieval`担当は新 `static-japanese-retrieval-v1/` とignored localのみ。公式の日本語StaticEmbeddingを固定revision/安全なsafetensorsで取得し、1024→128次元のlookup+meanで60形の意味検索を比較する。約136MB取得、128次元表約16MiB候補。閾値/候補を固定してから独立評価を行う。資料値をアプリ資源や正確さの達成にしない。
5. fresh120担当は所有返却済み、未commitの `widget-student-v2-fresh/` にREPORT/原票/freeze/クエリ重複の監査あり。native比較担当はロックにより新 `widget-metal-native-evaluation-v1/` の計画・集計コードだけ作成して所有返却。実測未実施。

### 次の一実験

Atlas+tiny統合担当のUI回帰完了を受け取り、rootで保存key v3/packageの別version・BuildInfo・原文保持を整え、新URL/tag/native appへ保存する。rootは現在の担当が所有するwidget-mainを触らない。Metalの初回表示比較はMac解除が可能な時へ延期し、原票なしの資源削減を報告しない。静的埋め込みの独立fixtureはモデル担当のcalibrator/閾値を読む前に別担当が作って固定する。研究地図へ最新評価と各方式の境界を反映し、採用/不採用/未実測を分ける。

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
