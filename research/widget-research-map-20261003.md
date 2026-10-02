# Glyph Matterを研究テーマへつなぐ

人工統合R3の検査は、唯一の材料body/ID・全体追加後ACK・shape-only判断・保存offを同時に扱う新しいgrammarへ進んだ。元20、補助8、追加gap4と独立11/追加5は修正後の人工回帰として区別し、R1/R2失敗とharness不足を残した。[公開確認とroot再現](../experiments/ambient-integration-publication-v1/README.md)。専用textarea接続が次の候補で、OS取得・実IME・快適性の結果ではない。

追加の用途は、日常の創作・仕事・プログラミングに伴う入力から育つサイドインテリア。[使用像の追加分析](side-interior-direction-20261003.md)と、[実施可能な研究プロトコル](widget-study-protocol-v1/README.md)を別資料にまとめた。日常文章のambient反映と明示的な形指定の研究課題は分ける。 [人工入力契約](../experiments/ambient-input-contract-v1/README.md)、[HCI本文8論文](side-interior-hci-v1/README.md)、[接続前の境界レビュー](../experiments/ambient-boundary-review-v1/REPORT.md)を別資料へ保存した。既存小窓の原文保存と、新しい保存off案を同一実装と扱わない。

確認日: 2026-10-03。文章の内容に応じて3Dの形が変わり、蓄積した文字がその面を流れ続ける、軽量なデスクトップ常駐表現を対象とする。ダウンロード量と常駐負荷を分け、16GB RAM・laptop CPU/iGPUで他の作業と共存できることを目指す。

**第一候補は「制約付き形状Programを使う、日本語の段階的な形状編集と文字表面の連続性」。** すぐ完成メッシュを生成することより、意味を取り違えにくいこと、前の文字と色が残ること、変形しても流れが切れないことを調べる。低負荷の常駐実行は、その研究を実際に使えるものにする制約として評価する。

これは研究計画と一次資料の整理であり、新規性、任意文への汎化、一般ノートPCの性能を実証した論文ではない。現時点の実測の正本は各比較版の評価記録。小窓版は実装・検証中で、数値は[独立評価](../experiments/widget-companion-v1/evaluation/)へ記録する。

## 1. 現在使っている技術と、その担当範囲

追加の[材料／形判断の人工比較](../experiments/ambient-material-scheduler-v1/REPORT.md)では、17 stream×3方針で材料の原文・ID・色を保持しながら、更新数と字句検索数を分けた。R2 storageは本文・ID列・色順をexportしない別回帰。実OS/IME・実小窓・一般的な意味理解・快適性は未検証で、2秒batch／5秒保持を製品値には採用しない。[接続マップ](../experiments/ambient-integration-map-v1/README.md)の14 JSON提案例も実行済み件数へ数えない。

Windows16GB laptop CPU/iGPUでの常駐条件は未検証。文字plane instanceとGPUの面計算を保つ最初の移植候補はWin32＋D3D11＋DirectWriteで、SDL3 GPUとnative wgpuを代案に整理した。WebView2/Tauriのbrowser系process、Qt nativeとWebEngineを分け、同じ3形・描画数・DPI・pause/hide・帰属CPU/RAMで将来比較する。[移植対応・公式資料30項目・実機評価案](widget-cross-platform-runtime-v1/README.md)。OS本文取得と意味モデル採用はこの描画案と別で、Windows実装・測定は0件。

| 層 | 現在の実装 | できること・限界 |
| --- | --- | --- |
| 自由入力と文字の蓄積 | TypeScript、文字ID・入力順・入力色・入力batch、端末内保存 | 日本語・英字・記号を身体の材料として残す。文字そのものを形の推定結果へ置き換えない。保存量には上限がある |
| 根性版の語の対応 | 人手の形状辞書、WordNet由来の語彙、作者定義の連想、限定した曖昧検索 | 60形の手続き表面を選べる。新しい未知の物体を学習で発明する処理ではない |
| 文章の意味特徴 | 固定した多言語MiniLMのint8 ONNX、384次元の文埋め込み、mean poolingと正規化 | 既知の部位説明・属性説明との類似度を計算。最大128 tokenという入力境界がある。文の近さだけで修飾対象や接続が正しくなるわけではない |
| 構造の解釈 | 句を分ける規則、色・部品語のマスク、人工文で学習した線形softmax関係head | `sphere / box / tube / blade / ring / vase`、最大2部位、`end / above / through`の1関係。親子順と切り出しには規則も使う |
| 幾何の構築・検証 | 有限JSONの検査、決定的な中心線・断面・部位配置、材料交差の数値確認 | 限定されたProgramから表面を作る。貫通の検査は有限の点・時刻の確認で、全時刻の数学的保証ではない |
| 文字表面・動き | Three.js/WebGL、文字atlas、平面のinstancing、面の位置・接線・法線、時間依存の手続き変形 | 文字を単なる線の粒子にせず面へ沿わせる。球には面積を保つshearの合成、箱には曲面からの写像などを使う。流体らしい運動であり、Navier–Stokesの流体ソルバーではない |
| 生き物の動き | 作者定義の鳥・魚・蛇のrig、クラゲ等の手続き変形 | 既知の身体に動きを与える。任意メッシュへの自動rigging、文章からの汎用動作生成は未実装 |
| 小窓の実行 | Swift/AppKit、OS標準WKWebView、loopbackの静的配信、Webとの表示状態イベント | 独自ブラウザruntimeを同梱しない。モデルを使わない通常表示と、入力時の解釈を分離する。現試作はmacOS向け。Windowsの窓は未実装 |
| 負荷の制御 | 通常15fps・吸収30fpsの予約、停止・非表示時の描画停止、描画する文字と保存する文字の分離、入力ごとのWorker終了 | 低負荷化の実装方針。Workerが0になったことだけでプロセスRAMが戻ったとは言わない。関連WebKitプロセスを含む実測が必要 |

コードと再現情報: [小窓の入口](../prototypes/glyph-creature/src/widget-main.ts)、[描画](../prototypes/glyph-creature/src/scene.ts)、[文字表面](../prototypes/glyph-creature/src/surface-flow.ts)、[有限Program](../prototypes/glyph-creature/src/scaffold-program.ts)、[モデルと学習の区別](../experiments/scaffold-program-v1/model/README.md)、[native窓](../desktop/glyph-widget/README.md)。旧版のtag・URLは比較基準として残す。

モデルの公式取得ファイルは合計127,494,442 bytes、関係headの学習対象は1,540数値。**約128MBは取得量で、常駐RAMではない。** headを小さくしてもエンコーダー、tokenizer、推論作業領域、文字atlas、WebKit・GPUの資源は別に必要。[固定revision・SHA・出所](../experiments/scaffold-program-v1/model/README.md#出所取得安全確認)。

### 8時間の比較実験で追加した候補

候補を増やしたことと、採用できたことを分ける。基準の小窓v0.14.0は独立tag・公開Web・macOS arm64 Releaseへ保存済み。

| 候補 | 実装・観測 | 採否と次の確認 |
| --- | --- | --- |
| 描画A | 表示容量の配列、部分転送、定着文字の一時計算削減。989フレーム・6,766,826成分は基準と最大差0。7形の実WebGL画素一致。描画関数の短時間mean24〜36%短縮 | native全4PIDの基準→候補→基準再測定はCPU13.278→12.110→11.798%、footprint中央値218.93→207.60→215.39MiB。RAMは低い観測値だが全体CPU改善は未確認、200MiB/5%予算も未達。[実機原票](../experiments/widget-render-budget-v2/native-evaluation/REPORT.md) |
| 小型解釈器freeze-1 | char n-gramをハッシュした線形softmax、int16重み。JSON122,601 bytes、明示的展開buffer91,136 bytes。形・関係は分類、範囲・親子順・属性・否定は手作業規則 | 初回90人工文は、短い形名等の10文が訓練と完全一致。除外後の確定76文でstudent54/76、規則46/76。否定等の誤受理5例、属性5例・親子逆転2例の誤り。標準採用を見送る。[方式とfreeze](../experiments/widget-student-v1/README.md) / [独立評価](../experiments/widget-student-v1-independent/REPORT.md) |
| 小型解釈器guard-v2 | freeze-1の同じ重みへ、保留・方向属性・親子順・有限geometryの手作業規則を追加 | 90文を見た後の回帰評価。確定86文72正解、訓練完全一致を除外した76文62正解。誤受理5→0だが、意味がある60文の保留は10→14。独立汎化の証明とはしない。[回帰・失敗](../experiments/widget-student-v1-independent/REGRESSION-GUARD-V2.md) |
| 段階atlas B | 固定2,048²から必要な行へ1→2→4→8→16→32と成長。48 GPU条件、Canvas全一致・GPU最大2/255以内。旧ID・色・座標を保持 | 最初の最大11不合格と修正を保持。画像の論理容量削減と全体RAMを区別し、native資源効果は未測定。[候補と回帰](../experiments/widget-atlas-budget-v3/README.md) |
| Metal 3形 | AppKit/Core Text、文字planeのinstance、GPUで面・接線・変形を評価。CPU1,213/GPU581確認、元TSと504地点を比較。新v2は端切れ修正、R2射影35,763条件、実UI/pause/Hide確認 | 白い球の実窓90秒はCPU2.661%／charged peak68.298MiB。WK v3は8.858%／173.253MiB、反復7.681%／124.253MiBだがframe gate FAIL。機能・camera・字体・ID差があり、方式だけの因果・全60形・16GB性能は未実証。既定採用保留。[画面と幾何](../experiments/widget-metal-framing-v2/README.md) / [実窓原票・限界](../experiments/widget-metal-native-evaluation-v2/REPORT.md) |

guard-v2を新しい120合成文で測ると、全文の厳密意図一致79/120、表現可能な要求21/44、明確な保留の誤発火2/40だった。全文のtrain/dev完全一致は0だが、切り出すprimitive分類クエリ132回中112回は学習例と正規化一致した。重みを変えないv2の改善15件は、手作業規則による保留13件・寸法修正2件。評価担当AIの合成意図ラベルで、人間の注釈や二重確認は未実施。**全文未見と分類クエリ未見を分けることを評価設計に加える。** [凍結の順序・原票・採点・クエリ監査](../experiments/widget-student-v2-fresh/REPORT.md)。


静的日本語埋め込みも別候補として固定比較した。[作者のStaticEmbedding](https://huggingface.co/hotchpotch/static-embedding-japanese)は、トークンの固定特徴を平均する方式。今回の60形検索は未知meshを生成しない。モデル・tokenizerを固定revisionで取得し、safetensorsと公式hashを照合、遠隔コード・PyTorchは実行していない。全1024次元tableは128MiB、先頭128次元float32は16MiB、追加変換したfloat16は8MiBである。

独立した140合成文（要求80・保留40・曖昧20）では、全1024次元guard候補は要求の正解30/80・受理34/80・保留対象への誤反応5/40、128次元guardは正解23/80・受理23/80・誤反応3/40。128次元は日本語21/40に対して英語2/40と低い。受理した要求だけなら23/23だが、明確な保留への誤反応も含めた120文の受理正解は23/26で、さらに曖昧20文では5文が受理された。要求だけの条件付き正解率を、そのまま「精度100%」とは報告しない。既存60形規則は正解40/80・受理56/80・保留誤反応25/40。この評価もAI担当の合成意図で、人間注釈は未実施。bolt・shell・ribbonの主観的な形対応3件は元の採点を変更せず別感度分析へ分けた。[凍結・全原票・語彙対応監査](../experiments/static-japanese-fresh-evaluation-v1/REPORT.md)。

全1024次元をread-only mmapした独立PythonプロセスではRSS約90MiB・短文の検索p95約0.136msを観測した。通常table読み込みのRSS約242MiBと区別し、アプリ全体RAMや一般PCの値へ移さない。128 float16はこの140文でfloat32と全最終判断が一致、生順位は139/140一致した。未知文字列のUnigram span検証不足を発見し、別guard-v3案に残したが、凍結したheadline評価へ後から混ぜていない。**既定の解釈への採用は見送り、全1024 mmapと128 float16は研究比較に保持する。** [出所・容量・速度・失敗・再現](../experiments/static-japanese-retrieval-v1/README.md)。

新しい小窓v0.14.2では、標準の根性60形を維持し、小型分類器guard-v2を明示的に選ぶ比較機能だけ追加した。メビウスや生き物の手続き表面を有限Programの一形へ縮退させる経路を修正し、tiny保留は今の形と蓄積文字を保つ。約122KBを選択時に遅延読み込みし、追加Workerや外部送信は使わない。頭なしの実WebGL UI回帰23項目と15入力の吸収完了を確認し、最長約3.95秒だった。これは意味精度やnative全体資源の達成ではない。[統合と境界](../experiments/widget-atlas-student-v3/README.md)。

freeze-1の初回90文では、直接Node呼出のp50約0.055ms・p95約0.459ms。重複込みの確定文は意味64/86（正例43/60、保留21/26）、意味と描画可能性を含む完走60/86。55受理出力のうち4件を幾何コンパイラが拒否した。学習担当が評価を未閲覧でも、短い人工文の偶然一致は起こる。重複除外の値を主結果にし、規則とstudentでは属性・語彙・既定値も異なるため学習効果だけの優位とはしない。小ささや推論速度だけでは意味の正しさを保証しない。アプリ内の入力から吸収完了までの時間、全RAM、一般PCは別の未測定事項。評価集合を見た後に加える規則は別版へ保存し、同集合での結果を**回帰評価**と記す。

この方式の基礎として[fastText / Bag of Tricks for Efficient Text Classification, EACL 2017](https://aclanthology.org/E17-2068/)を確認した。今回は公式fastText実装や階層softmaxの再現ではない。[Model2Vec公式実装](https://github.com/MinishLab/model2vec)のstatic embeddingは別候補で、まだ導入・蒸留していない。受理と保留を同時に評価する根拠は後述のSelectiveNetにあるが、本実験は固定閾値の分類器であり、同研究の学習方式を実装したものではない。

## 2. 先行研究から借りる考え方

以下は論文本文・著者ページ・公式文書を確認したもの。研究の主張と、この作品への応用案を分ける。論文を読めることと、実装・重みを再配布できることは別である。

| 研究・一次資料 | 確認できた内容 | この試作への応用と、残る隔たり |
| --- | --- | --- |
| [Sentence-BERT, EMNLP 2019](https://aclanthology.org/D19-1410/) / [多言語蒸留, EMNLP 2020](https://aclanthology.org/2020.emnlp-main.365/) / [使用モデル公式card](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) | 文を比較できる埋め込みと、翻訳対を使う多言語の蒸留。使用モデルは384次元、Apache-2.0 | 小さい意味特徴を固定し、対象部位・属性・関係に別のheadを学習する土台。埋め込みの類似度は、形状Programの意味正解率や校正済み確率ではない |
| [ShapeAssembly, SIGGRAPH Asia 2020](https://rkjones4.github.io/shapeAssembly.html) / [ShapeCoder, SIGGRAPH 2023](https://rkjones4.github.io/shapecoder.html) | 部品の宣言・接続による階層Program、形状集合からの再利用可能な抽象化。ShapeCoderは形とライブラリの複雑さを合わせて考える | 「形の名前を増やす」から「部品・接続・反復を組み合わせる」への先行例。日本語文章の理解や文字の流動はこの論文の成果ではない。コードの取り込みは別途利用条件を確認する |
| [ShapeLib, arXiv 2025 / v3 2026-05-31](https://arxiv.org/html/2502.08884v3) | 言葉による設計意図と少数の形例から、意味の分かる手続き関数を作り検証する。関数ごとの認識器には合成Programを使う | 形状ライブラリの作成を開発時に行い、実行時は小さい予測器に分離する着想。本文はo1-mini/gpt-4o、認識器の実験はRTX3090 24GB。端末内無料・一般CPUの実証ではない |
| [NNProc, Eurographics / CGF 2025](https://jdily.github.io/resource/nnproc/nnproc_paper.pdf) | 手続き形状から教師を作り、パラメータと形状の潜在表現を対応させる。パラメータ予測後に元の手続きで形を再構成できる | 自作の曲面から教師を作り、少数の太さ・曲がりを学ぶ参考。論文は言語入力の方式ではなく、言語特徴へ接続する部分は独自提案。GPUでの実験をCPUの速度としない。論文はCC BY-NC-ND、コード・重みの条件は別 |
| [Proc3D, arXiv 2026-01](https://arxiv.org/html/2601.12234v1) | 部位・親子構造・編集パラメータのPCGへ文章を対応させる。GPT-4oや微調整Llama 3を使用 | 自由な頂点座標を予測させず、短い構造表現を介す参考。報告された生成・編集時間を16GB CPU/iGPUの全工程時間へ移さない。[既存の詳しい確認](../experiments/scaffold-program-v1/RESEARCH_NEXT.md) |
| [Procedura, arXiv 2026-08-26](https://arxiv.org/html/2608.26238v1) / [著者ページ](https://spatiaos.github.io/projects/procedura/) | 名前付き部品とtyped mateのgraphから配置を解き、compile・mate・connectivityの検査後に部品を採用。同じgraphで材料とarticulationを扱う | 接続を見た目任せにせず幾何から解く、形と動きが共通の部品構造を持つ、という参考。本文はGemini 3.7 Flash等とOpenSCAD/Blender/Isaac Sim。今回の30秒・小窓RAM予算の実証はない。著者ページの「Code」は同ページへ戻り、配布実装・重みの確認には至らなかった |
| [ShapeCrafter, NeurIPS 2022](https://ivl.cs.brown.edu/research/shapecrafter.html) | 文章を一度に消費せず、句を足すごとに形の分布を段階的に更新する。Text2Shape++は369Kのshape–text対 | 日々の執筆に伴って形が変わるための直接の先行例。入力列の前後関係と編集の一貫性を評価する。文字を材料として保持することや低資源常駐は別の課題 |
| [Curl-noise for procedural fluid flow, SIGGRAPH 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf) / [著者の公開実装案内](https://www.cs.ubc.ca/~rbridson/) | ノイズから非圧縮な乱流状の速度場を手続き的に作り、境界を扱う。著者は例コードをpublic domainと案内 | ゆっくりした不規則な流れの比較候補。3Dのcurl場を面へ投影するだけで曲面上の密度・継ぎ目が守られるとは仮定しない。現在の球のshearと別方式として測る |
| [Automatic Rigging and Animation of 3D Characters, SIGGRAPH 2007](https://people.csail.mit.edu/ibaran/papers/2007-SIGGRAPH-Pinocchio.pdf) | 静的な身体と汎用骨格から、骨格の埋め込みとsurfaceへの重み付けを行う。身体・骨格の姿勢や比例、連結した体積等に仮定がある | 未知の生物を動かす時の基礎。任意の形なら自動で自然なrigになる、とは言わない。論文の「普通のPCで1分以内」は当時の条件であり、今回の30秒の保証ではない |
| [SelectiveNet, ICML 2019](https://proceedings.mlr.press/v97/geifman19a.html) | 分類・回帰と棄却を扱い、risk–coverageを比較する | 「分からない時に前の形を残す」を評価対象にする。現在は固定閾値の保留で、SelectiveNetを実装したわけではない |

追加の直接3D生成器・CAD生成器・圧縮研究は[16GB PC向け調査](16gb-text-to-3d-20261002.md)に残す。Point-E/Shap-E等との比較を行うなら、入力言語、生成物、後処理、全体RAM、生成から文字の初回描画までを揃える。別のGPUで報告された速度を、軽い常駐アプリの根拠にしない。

## 3. 現在見えている課題

**文章の意味。** 「白い細い棒の先に大きな球」の色語が関係解釈を壊した例、句の切り出しや否定が作用する範囲の失敗がある。色の独立化で既知入力を直せても未知文の汎化を証明したことにはならない。「細い」を全体のscaleへ適用するだけでは「首だけ細い花瓶」を扱えない。

**少数の人工テンプレート。** 関係headの訓練1,103文は、マスク後には57種の入力になる。人工検証が100%でも、初回独立30文は21/30だった。単なる文章の完全一致検査だけで漏洩・近い言い換えの混入を排除したとは言えない。[初回失敗と回帰結果](../experiments/scaffold-program-v1/model/README.md)。

**配備条件の差。** 同じ固定モデルでもCPUの最適化、WASM、batch8/batch1の差で受理閾値を跨いだ。WASM用に作った別headは追加独立8文で精度の優位を示せず、不採用の比較として保存した。[計算条件と比較](../experiments/scaffold-program-v1/model/wasm-head-v1/README.md)。最終実行環境で比較し、形式上の同じモデル名だけで等価としない。

**面と流れ。** 少数文字の細管が疎らになる、形の変更や接続で材料座標が不連続になる、面上の速度と画面上の速度が揃わない、という問題を分ける。メビウスの帯では継ぎ目の座標と向きの反転も扱う必要がある。文字数を増やすだけで解決すると、常駐負荷の条件と衝突する。

**形の構造と動作の構造。** 造形の中心線・部品graphと、動かすjointのgraphは同じものではない。接続部をrigとして動かすなら、文字のsurface・接線・法線にも同じ変換を適用する。文字だけ元の場所へ残る表示を避ける。

**常駐の寿命と資源。** 低fpsでも1回の計算が重ければCPUを使う。Worker終了後もruntimeやOSのallocatorがページを保持する可能性があるため、終了の実装とRAMの回収は別の観測にする。表示上限とは別に、確保するCPU/GPU配列、atlas、文字保存量、読み込み時の複製も調べる。

2026-10-03の最初のnative小窓で、担当者は関連4プロセスのfootprint集計を観測した。MiniLMの初回準備中は標本ピーク約1,445MiB、Worker終了後は約233MiB。385文字の球を30秒表示した区間は、1論理コア換算CPU平均約10.07%、footprint標本ピーク約271.7MiBだった。**200MiB・CPU5%・解釈中512MiBの最初の候補予算は未達。** 短時間・初回候補の観測であり、2時間常駐や一般PCの値ではない。プロセスのfootprint集計は、共有ページを完全に重複除外したシステムRAM差分とも呼ばない。修正後の値と混ぜず、[条件と生記録](../experiments/widget-companion-v1/evaluation/)を正本にする。

この観測から、Workerの寿命を縮めることは推論後の常駐を減らすが、128MBのエンコーダーを毎回同じWASM経路へ読むだけでは一時ピーク予算を満たさない、という次の検証課題が出た。モデルの取得量をさらに小さくすることだけに問題を縮めない。

**生成・編集・雰囲気の混同。** 60形から選ぶこと、6部位を組むこと、未知のmeshを作ること、文章から穏やかな動きを選ぶことは別の能力。「曖昧な言葉に反応した」の一言でまとめず、それぞれの入力と結果を記録する。

## 4. 検証できる研究質問を三つに絞る

### RQ1: 小さい意味特徴と限定Programで、未見の日本語編集の意味をどこまで保てるか

例: 「胴は丸いまま、首だけ細く」「箱の上の棒を曲げる」「赤い球には変えない」。形状族の選択、修飾対象、連続値の変化、接続、保留を別に測る。

比較する候補は、A: 辞書・連想・規則、B: 固定埋め込み＋説明文類似度、C: 同じ埋め込み＋部位対象head／属性head／関係head、D: 同じ教師例の小さい構造decoder。現実装にあるのはA/Bと関係headで、局所属性head・構造decoderは提案段階。

まず対象部位と6点の正の断面半径を予測する小さなheadを試す。形状の有効範囲や滑らかさはコンパイラが守る。「文章全体から一つの形」の分類と、同じ教師・同じ図形で比べる。形の変化が学習由来か作者規則由来かを、結果のevidenceへ分けて記録する。

意味の採点は、shape/対象/属性/関係のmacro-F1、連続値の方向一致・誤差、Program全体一致、保留率、受理した文だけの誤り率。閾値を変えたrisk–coverage曲線も出し、保留を増やしただけの精度改善を見分ける。未知名詞・比喩・矛盾した文に唯一の「正しい形」を押し付けず、複数の許容形または保留を正解として事前に定める。

### RQ2: 形が動き、文字が増えても、少ない描画数で面と材料の連続性を保てるか

同じ文字列・色・seed・カメラで、A: 世界座標の粒子、B: 固定の面座標、C: 面座標＋接線・法線＋形の変形、D: C＋密度や曲面距離を考慮した流れを比較する。現在の手続き表面はCに近く、Dの一般化は未実装。

形を別の完成メッシュへ交換するだけでなく、同じ部位の太さや曲がりを編集する入力列を使う。球・箱・メビウス・花瓶・接続した管・既知rigを分ける。文字のID/入力色の保存、面からの距離、瞬間移動の大きさ、接線方向の不連続、面積あたりの密度、見えている輪郭と面の被覆を測る。遮蔽で正当に見えない文字と、誤って脱落した文字を分ける。

表示上限512/1,024/1,536/3,072等を同条件で比較し、古い文字の一様抽出・直近文字の保持・面積に応じた抽出を比べる。全入力を保存しつつ、現在画面の文字だけ選ぶ処理であることを明示する。数値だけで好みは判定できないため、順序を入れ替えた短い映像で「形が分かる」「面を流れる」「落ち着いて見続けられる」を別々に人が評価する。

### RQ3: 意味モデルを常駐させず、他の作業と共存する生成表現にできるか

同じ入力列・推論精度・描画品質で、A: Worker/モデルを常時保持、B: 入力後にsessionを解放、C: 入力ごとにWorkerを終了、D: 規則で処理できる入力はモデルを呼ばない、を比較する。Cは現在の実装方針。Bだけで確保RAMが戻るとは仮定しない。[ONNX Runtimeのrelease契約](https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.html#release)。

通常15fps、吸収30fps、非表示0描画を、常時30/60fpsと比較する。冷初回、ディスクcache後の再読込、推論直後、30分・2時間の通常表示、pause、hide、終了、再開を分ける。入力待ちの合間は表示だけを続ける。取消した古い予測を採用しないことも確認する。

記録するのはアプリと帰属するWebContent/Networking/GPUプロセスのphysical footprint、RSSを分けた値、1論理コア換算CPU、更新・描画回数、p50/p95の全工程遅延、可能なら電力/GPU負荷。共通ブラウザの共有プロセスは帰属の不確かさを記す。ダウンロードcache、JS heap、プロセスRAMを同じ値にしない。

常駐200MiB、一時512MiB、通常CPU5%等は[最初の候補予算](widget-first-20261002.md)で、達成済みではない。達成しない方式は、取得ファイルを小さく見せて採用するのでなく、nativeの描画や推論を分ける方式と比較する。M5・32GBでの測定を、16GB Intel/AMD laptop/iGPUの証明へ読み替えない。

## 5. 教師データ・分割・実験記録

1. **形→教師を自作する。** 有限Programと許される編集を先に定義し、正解の部位・寸法・関係・変更しない部位を保存する。幾何検証に通る範囲で合成し、その意味を言い表す人工文を作る。自然文の正確さも人が確認する。重いモデルで学習文を作る場合は開発時の費用・条件と利用者の実行要件を分ける。
2. **分割を文章の乱数だけにしない。** 言い回しの型、同義語のfamily、部位の組合せ、関係、局所編集をgroupにする。完全一致・マスク後一致の検査に加え、特定の組合せを訓練から丸ごと外す。未見構成と未見表現の評価を分ける。未知物体の生成評価と呼ばない。
3. **未見の人工90文程度を先に凍結する。** 単形・属性15、修飾対象15、2部位接続15、否定・矛盾15、通常文・未知語15、連続編集15を最初の案とする。これは計画した件数で、実施済みではない。threshold選択用の検証文と最終評価文を分ける。
4. **初回と回帰を残す。** weights/dataset/prompt/grammar/source/tag/runtime/OS/CPU/GPUのhashと版を保存。最終評価を見た後の修正は同じ文の回帰として報告し、新しい未見文で追加確認する。モデルが出したProgram、compilerの採否、画面の結果を別に保存する。
5. **少数例の誤差を明示する。** 各種の件数、信頼区間、入力ごとの失敗分類を示す。人の評価は参加者数・経験・表示順を記し、作者一人やAIの好みを一般的な快適性の実証にしない。
6. **本文の扱いを分ける。** 公開するのは人工例と同意を得た評価材料。日常の執筆本文・参考本・個人画像・認証情報は公開データへ含めない。モデル取得先には文章を送らず、動作の通信も確認する。

CPUとiGPUは同じfixtureと品質条件で比べる。WASM/CPUを共通基準にし、WebGPU・native ONNX・Vulkan/Metalは追加条件。GPU推論が速くても文字描画や他アプリと競合する可能性があるため、解釈時間だけで選ばない。[ONNX Webの環境・session設定](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)。

## 6. 推論時の小ささを変える比較候補

同じMiniLMへさらにheadを足すだけでは、上の初期化ピークの主因を除けない。次は、以下を**同じ未見入力・同じ有限Program**で比較する。文字n-gramと静的日本語埋め込みは上の比較実験へ実装した。局所属性head・構造decoder・教師からの用途限定蒸留・native推論は未実装案である。

| 候補 | 根拠と実装案 | 特に調べる失敗 |
| --- | --- | --- |
| 文字n-gram＋小分類器 | [fastText, EACL 2017](https://aclanthology.org/E17-2068/)は軽い語・n-gramの分類基準。[公式コードはMIT](https://github.com/facebookresearch/fastText/blob/main/LICENSE)。日本語は単語分割へ依存しない文字n-gramの特徴を自作し、形・対象・属性・関係を別々に予測する | 言い換え・未知語・離れた修飾に弱い。訓練テンプレート暗記と形の理解を分ける。fastText本体を採用する場合と、着想だけを使う自作方式を区別する |
| 用途を絞ったstudent | 使用可能な教師の特徴やProgram候補を開発時に計算し、小さなMLP/CNN等へ蒸留する。教師の結果を正解と盲信せず、検証済みProgramの教師と比較する | 教師の誤りを引き継ぐ、少数の形の言い換えだけに過適合する。teacher/student/gold-label学習を別条件にする。教師と派生重み双方の利用条件を保存する |
| static embedding | [Model2Vec公式実装・説明](https://github.com/MinishLab/model2vec)はSentence Transformerのtoken特徴を前計算し、推論時のTransformer処理をstatic tableへ置き換える。MIT。[公式多言語モデル](https://huggingface.co/minishlab/potion-multilingual-128M)は256次元・MIT、128M規模なので、小さい英語モデルを日本語対応版と取り違えない | 文の平均では語順・否定・修飾先が消えやすい。例えば「棒の上の球」と「球の上の棒」を対にする。FP32の128M数値なら重みだけで概算512MBになるため、「staticだから少RAM」とは言わない。語彙・次元・量子化を絞る効果と精度損失を測る |
| 同じ重みをnative CPUで実行 | ONNX等のモデルをWebKit外の短命処理へ移し、入力と小さなProgramだけを往復する。Mac固有のCore ML等は別条件 | WASM/Workerの複製や初期化負荷を減らせるかは未測定。UIとモデルを別processにするだけでアプリ合計RAMが減るとは限らない。CPU/GPUの帰属、取消、過去状態の上書きを確認する |

Model2Vecが示す「最大500倍」「CPUで蒸留約30秒」は作者のモデル・設定の報告であり、この作品の日本語精度や文章→形→吸収の全工程30秒ではない。汎用多言語モデルを一式配る以外に、開発時に作る用途限定の特徴table・studentを配る道がある。何MBに縮めたかより、保留を含む意味精度と実際の全体RAMを比較する。

## 7. 次の順序と、研究としての言い方

最初に小窓のpause/hide・文字保存・Worker寿命を実測して、低負荷の基準版を固定する。次に、同じ表面と入力列で局所編集headを比較する。最後に、連続性を保つ表面対応と描画数の選択を比較する。大量の形を増やす作業と、未見文に汎化する学習実験を別の枝にする。

候補題名は **「低資源のデスクトップ常駐環境における、日本語による段階的形状編集と文字表面の連続表現」**。対象が広ければ **「制約付き形状Programを用いた、日本語の局所形状編集」** まで絞り、文字表面は検証用の応用にする。

現段階で主張できるのは、制約付きProgram、固定多言語特徴、小さい関係head、手続き表面、nativeの小窓を結んだ比較用プロトタイプを作っていること。研究の新規性になり得るのは、**修飾範囲・保留・文字の履歴と面の連続性・常駐資源の制約を同じ入力列で評価した時に、既存方式よりどの条件が改善するか**である。組み合わせたというだけで新規性があるとは決めない。先行研究との比較と、未見の入力・目標実機での評価が残る。

調査は一次資料の閲覧と現コードの読み取り。本文で提案した局所編集head、教師からの用途限定蒸留、一般的な面上curl流、任意rig、Windows窓、16GB実機評価は未実装・未実証である。自作n-gram分類器と固定静的埋め込みの比較は別実験として実装・評価したが、汎用意味理解の達成ではない。
