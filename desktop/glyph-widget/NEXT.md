# 小窓を残して、次に何を比較するか

2026-10-03。native R1とそのWeb版の読取レビュー、独立担当の測定原票、Apple/WebKitの一次資料から作成した**次の候補**。この文書にある保存橋・透過帯・Metal描画は未実装。R1/R2のアプリ、既存ソース、保存した状態を置き換えない。

## 先に決めること

**普段は軽い表示だけを持ち、文章の意味を読む重い処理は入力時だけ。保存は表示技術から独立させる。**

次の順番が小さい変更で比較しやすい。

1. 現行WKWebView版のR2を同じ形・文字・時間で測る。通常の文字面が読める範囲で、CPU計算・バッファ更新・描画対象を減らす。
2. native側へ原文・入力色・形の状態を保存し、ポートが変わっても復元できるようにする。小窓を解体する条件を、この保存成功に結び付ける。
3. それでも常駐予算に届かない場合は、球・箱・メビウスの3形だけをMetalで表示する別の比較アプリを作る。全文法や60形を先に移植しない。
4. 画面下の透過帯は、その後の使い勝手の比較。透過を軽量化成功の根拠にしない。

## R1が示したことと、まだ示さないこと

このMac（Apple M5、32GB）の球385文字、15fps、30秒では、帰属した主プロセス＋WebContent＋Networking＋GPUの**charged footprint合算peakが約271.7MiB、CPUが1コア換算10.07%**だった。[原票](../../experiments/widget-companion-v1/evaluation/native-at-calm.json)。200MiB/5%の候補予算は未達。

モデルの初回準備を含む120秒窓のsampled peakは1,515,361,128 bytes、**約1,445MiB（約1.41GiB）**。[原票](../../experiments/widget-companion-v1/evaluation/native-session-r1.json)。常駐の表示と、取得・展開・推論のピークを分ける。ファイル取得約128MBから使用RAMを推定しない。入力Workerを終了できたことだけでは、描画やブラウザ基盤が軽くなったとは言えない。

停止・非表示の測定ではCPUは大きく下がるが、プロセスと資源が全て消えるわけではない。[停止・非表示の原票](../../experiments/widget-companion-v1/evaluation/native-session-r1-visibility.json)。これらの合算は各プロセスへ計上されたfootprintで、共有ページを完全に重複除外したシステムRAM差分ではない。GPU使用率・電力と16GB laptop CPU/iGPUは未測定。R2は同一条件の新しい結果として記録し、R1の測定を上書きしない。

WebKitはmacOSでもCanvas/WebGLをGPU Processへ分離し、WebContentからデバイスアクセスを隔離している。これは現在の複数プロセスを考える根拠であり、WebKitだけで271MiBが必須だという主張ではない。[WebKit公式のアーキテクチャ説明](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/#security)。

## A. 現行の表現を持つWKWebView版で、まず分ける費用

R2の対象文字数・更新頻度・文字atlas・描画サイズを固定し、入力なしの通常表示を比べる。GPU Processの値が大きくても、その全量を固定費と呼ばない。文字textureや描画buffer等を含むため、下記の対照が必要。

| 小さな対照 | 分かること | 分からないこと |
| --- | --- | --- |
| 同じ窓で黒背景＋@1文字 | 起動した基盤と最小表示の費用 | 多数文字が面を覆う時の実用負荷 |
| 同じ385文字・1536文字で停止／15fps | 流れと更新による増分 | 停止しただけで全GPU資源が解放されたか |
| 同じ面で文字atlasの解像度だけ変更 | atlasと画素数の影響 | 文字を減らして疎らにした改善の代用 |
| 入力を終えた状態で長く隠す→戻す | 資源の減少と復元の費用 | 2時間の安定性や対象PCの動作 |

描画対象を1文字へ下げて軽さを達成しても、実用版の合格にしない。文字の密度、面の被覆、細い文字平面の回転、原文と色の履歴を同時に確認する。

モデルなしの根性／小さい学習headを通常経路に置く案を比較し、大きいencoderは任意の入力解釈だけへ分ける。native化しても重いencoderを常駐させればピークは残る。取得量が大きくてもよいという条件は、毎フレームの演算や常駐RAMの条件を緩めるものではない。

`WKWebsiteDataStore.nonPersistent()`はディスクへ保存しない設定であり、RAM削減のAPIではない。今の取得cacheを消したり、起動のたびにモデルを取得し直すためには使わない。[WebKitの公式API定義](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/Cocoa/WKWebsiteDataStore.h)。

長時間の非表示でWKWebViewを完全に作り直す案は、native保存ができてからの比較にする。保存成功→入力処理の中断→WebGL資源の解放→delegate/message handler解除→windowから取り外す→参照解放、の順を守る。再表示は最後の保存済み状態を読み、意味を再推論しない。WebKit関連プロセスがいつ実際に消えるかは測定が必要で、他のアプリのWebKit/GPUプロセスを終了して軽さを作らない。

## B. originに依存しない保存を、先に小さく作る

現在はポートをUserDefaultsへ保存して再利用するため、通常は同じoriginへ戻れる。しかし、そのポートが使われていると別originになり、以前のlocalStorageが見えない。窓と描画を簡単に作り直すためにも、これは先に分ける。

最小候補は、アプリ専用Application Support内の**版付き状態ファイル**。原文のバッチ・色・seed・時刻・形Program・表示設定を保存し、表示用に選んだ文字位置や大きいモデル配列は保存しない。大きいモデル取得cacheは再取得可能な別データとして扱う。Foundationは長く保持するサポートデータと再生成可能なcacheを別の保存場所として説明している。[Apple公式の保存場所の指針](https://developer.apple.com/documentation/foundation/using-the-file-system-effectively)。

native bridgeは計測用`widgetMetrics`とは分ける。新たな`loadState`/`saveState`だけを受け付け、main frame・現在のloopback origin・固定schema・最大容量を検査する。Webから任意のファイルパスを受け取らず、入力本文をメトリクスやログへ流さない。

候補の1回のschema上限は2MiB。32,000文字の範囲とバッチ数・色・Programの上限も別に設ける。容量超過やI/O失敗は画面の既存状態を保ち、保存に成功したと表示しない。入力時だけ保存し、フレーム単位でディスクへ書かない。

初回の移行では既存localStorageを読み、検証済みのcopyを新しい保存領域へ書き、成功の返答を待つ。元のlocalStorageは削除しない。版番号付きの新しいsnapshotへ保存し、前のsnapshotを自動削除しない。書き込みが中断しても、最後の完了済みsnapshotから復元する。nativeのデータがあればそれを優先し、ブラウザ単体版では引き続きlocalStorageを使う。

受け入れ条件は、人工入力→終了→ポートを他のテスト用listenerで占有→再起動→原文・色・Programが同じ、保存失敗→以前の状態が残る、旧版と新しい版の保存が混ざらない、の3点。OSの設定や他アプリの保存には触らない。

## C. Metalは3形の独立比較から

Metal採用を今の性能改善として報告しない。ブラウザ基盤の費用を分けるための、別アプリ・別versionの小さな比較候補とする。

最初は**球、箱、メビウス**だけ。画面サイズ400×440、385文字と1536文字、同じ文字・色・視点・流れ・時刻を固定する。モデルと辞書の移植は含めず、既存版から得た安全なProgramか固定fixtureを入力にする。これで描画の比較を済ませ、採用した後に文章解釈をつなぐ。

### 表示の最小構成

1. AppKitの窓と`MTKView`。通常15fps、吸収30fpsを候補にし、実フレーム数も測る。非表示・停止では`isPaused=true`として描画要求を出さない。入力やresizeで必要な1回だけ描く。Appleは周期的な描画とイベント駆動の使い分けを説明している。[isPaused](https://developer.apple.com/documentation/metalkit/mtkview/ispaused?language=objc)、[WWDCのMetalKit描画制御](https://developer.apple.com/videos/play/wwdc2022/10114/)。
2. 入力で増えた文字だけCore Textから小さなbitmap atlasへ描く。描画フレームごとに文字組みやフォントを作らない。日本語の合成文字も文字clusterで扱い、ASCII字形だけの成功を自由入力の成功にしない。`CTLine`は文字列をglyph runへ組み、描画できる。[Core TextのCTLine](https://developer.apple.com/documentation/coretext/ctline?changes=la_6)。
3. 文字を厚さゼロのquadとしてGPUへまとめて描く。atlasのUV、入力色、表面のUV、位相をinstanceデータへ置き、球・箱・メビウスの位置と接線をvertex shaderで求める。CPUから毎フレーム送るのは基本的に時刻・視点のuniformだけ。Metalには同じprimitiveの複数instanceをまとめるdraw APIがある。[MTLRenderCommandEncoder](https://developer.apple.com/documentation/metal/mtlrendercommandencoder)。
4. 太い不透明モデルや点群へ置き換えず、glyphの輪郭・面への沿い方・裏へ回る様子を既存版と比べる。メビウスの文字流れと帯のねじれを分け、見かけの軌道だけを成功としない。
5. 長く非表示になる時は描画の予約に加え、不要なdepth/MSAA資源を解放する。Appleの`releaseDrawables()`はそのtextureの解放を説明するが、全GPU資源がなくなるAPIではない。[releaseDrawables](https://developer.apple.com/documentation/metalkit/mtkview/1535948-releasedrawables)。

1024×1024の単channel atlasは1MiB、1,536個×80bytes×3枚のinstance bufferは約360KiB、400×440×4bytes×3枚のcolor bufferは約2MiB、という構成を候補にできる。**これは自前bufferだけの概算**であり、driver・font cache・配列のコピー・関連サービスを含むアプリRAMの見積もりではない。絵文字や色付きglyphは別のRGBA atlasが必要になることもある。atlasが一杯でも原文を捨てず、今描く文字のatlasを組み直す。

CoreGraphicsで大量の文字を毎フレーム描く全面置換は先に選ばない。CPUでの3D投影・文字配置・bitmapの変換が増える可能性があるため、これは設計上の懸念であり実測結果ではない。Core Text/CoreGraphicsは入力時のatlas作成、停止時の絵、少数文字の対照には使える。動く文字面の本命比較はinstanced Metalとする。

Metal比較の採用条件は、**同じ面と文字を保って**通常CPU5%以内・charged footprint200MiB程度以下・1回のCPU処理p95 3ms以内を満たすこと。1文字だけの黒画面で満たしても採用しない。達成した場合も、3形の結果を60形や16GB PC全体へ一般化しない。

## D. 画面下の透過帯は、入力を分ける

Desktop Heroesのように他の作業の横にいる使い方に近づける候補は、表示専用の小さい帯と、明示的に開く編集窓。表示専用ではキーボードを奪わず、文字入力は編集窓だけで受ける。

| 状態 | native候補 | 操作 |
| --- | --- | --- |
| 通常の黒い小窓 | 現在のNSWindowを保持 | Enter・ドラッグ・閉じるが使える |
| 表示専用の透過帯 | 別のborderless NSPanel、`nonactivatingPanel`、`ignoresMouseEvents=true` | 下のアプリへクリックを通す。ここでは入力も移動も受けない |
| 編集／位置調整 | メニュー/Dockから普通の編集窓を表示 | 入力・移動を行い、完了で表示専用へ戻る |

`ignoresMouseEvents`は窓全体をマウスに対して透明にするので、字をクリックした時だけ入力できる設定ではない。[Apple公式](https://developer.apple.com/documentation/appkit/nswindow/ignoresmouseevents?changes=_6)。`nonactivatingPanel`はNSPanel用のスタイルで、アプリをactivateしない。[Apple公式](https://developer.apple.com/documentation/appkit/nswindow/stylemask-swift.struct/nonactivatingpanel?changes=_9)。普通のNSWindowへ同じflagを後付けして編集と表示を切り替える設計にはしない。

透明な背景はNSWindow側の非不透明設定だけでなく、描画surfaceのalphaも合わせて検証する。黒い背景の既存版を既定のまま残し、白い作業画面上で文字が読めるかも試す。輪郭や弱い影を足す場合は、後景の文字を覆う量とコストを比べる。Appleはalpha blendingを含む非不透明描画の効率を考える必要があると説明している。[Metal最適化の公式解説](https://developer.apple.com/videos/play/wwdc2020/10632/)。**透明化で軽くなると推定しない。**

最小の実操作は、他アプリの文書をクリック・スクロール・選択→帯が邪魔しない、Dock/メニューから編集→pasteと送信が働く、表示専用へ戻る→文字が残る、終了の入口を常に使える、の一巡。OS全体の入力監視、global key hook、clipboardの常時取得、ログイン項目は追加しない。

## 次の一巡で作るもの

最初にnative保存の比較版とR2の測定を完了する。Metalや透過帯の全実装を同時に始めない。

R2で表示の候補予算へ近づいたなら、黒い小窓を保って文章解釈の小さいモデルを比較する。R2でもブラウザ基盤を含む常駐費用が高いなら、3形・モデルなしのMetal表示比較を次の一本にする。どちらの場合も、未達値・表示上の退化・保存の失敗を残し、元の版へ戻れる状態で判断する。
