# 進捗

## 2026-10-03 03:50 — サイドインテリアの入力方式と研究計画

日常の入力から育つ用途を、[使用像と分析](research/side-interior-direction-20261003.md)へ整理。[一次資料30項目の入力API比較](research/ambient-input-platforms-v1/README.md)では、キー操作だけで全アプリの日本語確定本文を得る前提を置かず、活動量と対応editor本文を分ける。VS Codeの差分にIME確定フラグが無いことも記した。APIの存在や人工schemaを、OS監視の実装・実IME確認とは扱わない。

[研究プロトコル案](research/widget-study-protocol-v1/README.md)は、保留付き既知6形の明示要求を同条件で比較する研究と、日常文章が穏やかに姿へ反映される体験の研究を分ける。件数、閾値、6人試遊、16GB実機・長期評価は将来の計画であり、実施済みではない。[人工入力契約](experiments/ambient-input-contract-v1/README.md)は28fixture/51runと10 probe・7 mutation checkを完了しrootも再実行。[HCI本文8論文](research/side-interior-hci-v1/README.md)は配置・注意・長期使用の比較案を整理。[接続前の境界レビュー](experiments/ambient-boundary-review-v1/REPORT.md)ではplatform schemaとの変換、保存off、解釈前の材料追加を未実装課題とした。人工テストと人間・実OSの検証を分ける。

公開小窓v3のEnter→日本語paste→文字のメビウス表面→停止を実操作確認。旧版を含む7つのHTTP manifestは保存commitと全一致。[確認原票](experiments/widget-v3-release-verification-v1/public-manifests.json)。Metalの2時間予定offscreenはfinal記録なしに中断。約30分までの原票を保持し、完走や窓全体の性能とは扱わない。全入力連動・実窓Metal資源・一般PC快適性は未実証。

## 2026-10-03 02:54 — 表面を保つ小窓v3と追加の使用像

根性60形を保ち、段階atlasと約122KB分類器の任意選択を別版 `0.14.2-widget.3`へ統合。公開前の独立レビューで種類上限のdraft消失と色previewを修正し、別productionの23項目・60形選択・tiny遅延読込・旧保存key不変が成功。[独立review](experiments/widget-v3-release-review-v1/REPORT.md)。174単体・型・build、32k/1536容量復元、新native ZIPのhash/strict署名が成功。nativeの日本語paste・メビウス・再起動・pause/hide/復帰を短い実操作で確認。[配布確認](experiments/widget-v3-release-verification-v1/README.md)。全体CPU/RAM削減と実IMEは未検証。

追加の使用像は日常の創作・仕事・プログラミングの横で入力から育つサイドインテリア。分析期限を10:37 JSTへ延長した。全入力を命令とせず、活動量・確定文字・文書編集・意味反映を分けて設計中。OS全体の入力取得や権限変更は開始していない。[継続状況](experiments/widget-companion-v1/STATUS.md)。

静的日本語検索のfresh140は、128guard正しい受理23/80、保留誤反応3/40で既定採用を見送る。[評価と限界](experiments/static-japanese-fresh-evaluation-v1/REPORT.md)。Metal2時間offscreen試験は04:35終了予定で進行中、窓全体の資源比較とはしない。

## 2026-10-03 02:10 — 描画Aを公開、次の小窓比較へ

`0.14.1-widget.2`をPR #25・独立tag・`widget-v2/`・macOS arm64 Releaseへ保存。Pages成功、旧5版と新v2の6 manifest SHAを確認。表示容量に配列とGPU更新を合わせ、原文全文と旧色を保持。隔離した公開commitの174単体・型・production build、容量末尾とreload復元が成功。[表現・保存・実機原票](experiments/widget-render-budget-v2/README.md)。実macOSの基準→A→基準再測定でCPU改善は再確認できず、RAMは低い観測値に留まった。

小型分類器は同じ重みを保ち、新しい120合成文の評価と分類クエリ重複の監査を保存した。guard-v2でも表現可能正例は21/44、保留文の誤発火2/40。[限界・採否](experiments/widget-student-v2-fresh/REPORT.md)。標準60形を置き換えない。段階atlasと遅延読込の実験選択肢を、さらに別版へ統合中。

球・箱・メビウスの面をMetalへ移す別候補は、CPU/GPUの数値とoffscreen画像を確認。[技術・原票](experiments/widget-metal-lab-v1/README.md)。Macがロックされ実操作と通常表示のCPU/RAM比較は延期。スリープ防止と08:25までの改良継続は有効で、既存版やOS設定を変更しない。[継続状況](experiments/widget-companion-v1/STATUS.md)。

## 2026-10-03 — 小窓の基準版と8時間の比較改善

`0.14.0-widget.1`を旧4版から分け、通常15fps/吸収30fps・非表示停止・入力時だけモデルWorker・文字履歴と描画数の分離を実装。Mac標準の独立した小窓も作った。[操作と測定範囲](experiments/widget-companion-v1/README.md)。取得量128MBとRAMは異なり、初回準備の4PID合算footprintは約1.4GiBまで増える。通常表示も候補CPU/RAM予算に未達で、低負荷を達成した製品とは扱わない。

直接の追加指示で、08:25 JSTまで約8時間の改良・期限付きスリープ防止とGitHub記録を進める。[現在地・次の比較](experiments/widget-companion-v1/STATUS.md)。[研究の技術・課題・先行研究・評価案](research/widget-research-map-20261003.md)は、日本語の局所編集、文字表面の連続性、常駐資源を分けて研究質問とする。既存版・資料を削除せず別版を残す。

## 2026-10-02 — 常駐時の軽さを優先する条件

ユーザーから、メモリを使い切る構成ではなくウィジェット程度の負荷にしたいという追加条件を受けた。以前の16GB向け研究予算より常駐中のRAM・CPU・GPU負荷を優先し、[別版の設計と候補予算](research/widget-first-20261002.md)を追加。コード読取で、停止中も描画し、準備したモデルを正常時は保持することを確認した。これらの軽量化と全体の実メモリ測定は次の実装であり、今回の設計更新ではアプリコード・公開tagを変更していない。

## 2026-10-02 — 断面のねじれと色の構造分離

19:55 JSTに公開確認まで完了。延長作業約2時間22分、専用スリープ防止と期限付き自動作業は停止。[Release](https://github.com/KOSEIHAMAYA2077/glyph-matter/releases/tag/glyph-matter-v0.13.1-twist.1) / [PR21](https://github.com/KOSEIHAMAYA2077/glyph-matter/pull/21)。

`0.13.1-twist.1`で箱/刃の実体をねじり、文字の位相移動と分けた。色語を構造解析のコピーから除き、元の文字と入力の色を保つ。モデル重み・閾値・captionは固定。CPU/実Workerで186色付き文の全Programが色なしと一致。

太管が小球を包む等の貫通反例を保留へ落とす。通常18組合せを維持し、54例中39受理、受理39は0〜120秒の独立10時刻で実材質交差。有限の数値確認で連続時間保証ではない。132単体・type/build、実UI62操作は例外/入力外部要求0、既知44例に退行なし。[比較・残る範囲](experiments/physical-twist-v1/README.md)。試遊入口は[twist-v1](https://koseihamaya2077.github.io/glyph-matter/twist-v1/)。旧3公開入口は保持。 冷初回は取得・演出を含め12.213秒、準備後は3.970〜4.027秒。30秒以内だが冷初回10秒目標は未達。一般的な16GB機は未測定。[独立評価](experiments/physical-twist-v1/evaluation/REPORT.md)。

## 2026-10-02 — 部位と関係から文字の面を作る別版

`0.13.0-program.1`で、sphere/box/tube/blade/ring/vaseを最大2部位、学習した関係分類器と制約付き幾何で組み合わせる。元の根性版、v0.12骨格版は保存済みタグとURLを保持。新しい試遊入口は[program-v1](https://koseihamaya2077.github.io/glyph-matter/program-v1/)。

128単体テスト・型・build、新UI2ケース、旧骨格6ケースを確認。独立初回21/30、実UI修正後28/30（同種6/6、追加4/8）は回帰。モデル初回準備9.225秒、準備後の全工程3.970〜4.015秒をこのMacで実測。16GB CPU/iGPU実機は未測定。実際の幾何では32生成の有限面、above接触11/11、through交差5/5を確認。[結果・制限・再現](experiments/scaffold-program-v1/evaluation/REPORT.md)。

その後、別版で断面自体のねじれと色の構造分離を実装・比較した（上の0.13.1節）。[次の研究](experiments/scaffold-program-v1/RESEARCH_NEXT.md)。

## 2026-10-01 — インストール不要のWeb試遊版

GitHubのREADMEトップからGitHub Pagesの試遊版へ直接進む導線を追加。公開元は保存済みの骨格版`glyph-creature-p0-v0.11.0-rigs.1`。以前のコードをmainへまとめて統合せず、公開ワークフローが指定タグをビルドする。トップへ軽量モデルによる曖昧な言葉からの3D形状生成を研究・試作中であること、Codexのサブエージェントによる分担を明記。公開中の根性版はモデル推論なし。[公開版・操作・保存・更新](docs/WEB_DEMO.md)。以下は以前の記録。

## 2026-10-01 — 鳥・魚・蛇の骨格

`feat/glyph-creature-rigs-v1`、`0.11.0-rigs.1`、4198へ分岐。実際の骨の親子階層と逆初期姿勢の変換を使い、鳥7本・魚4本・蛇9本の骨で文字の表面を動かす。共通処理を次の生き物へ展開できる形にした。4197以前の作業コピーと記録は保持。単体98件、関連ブラウザ13件、型・ビルド・画面を確認。[結果・実測・未実装の範囲](experiments/creature-rigs-v1/README.md)。

## 2026-10-01 — 根性版の回転とクラゲの動き

`feat/glyph-konjo-motion-v1`、`0.10.1-konjo-motion.1`、4197へ分岐。全体の遅い左右回転へ緩やかな上下の傾きを加え、クラゲの傘を7.2秒で拍動させ、触手に先端ほど遅い揺れを加えた。[比較・確認・起動](experiments/konjo-motion-v1/README.md)。


## 根性版 v0.10（別ブランチ）

60形と、名前・同義語・手製グラフ・長い綴りの限定検索を実装。既存の22形へ38形を追加した。通常4195、旧4173/4194は保持。[比較と試遊](experiments/konjo-v1/README.md)。文字の表面・入力・執筆・日記・周期を維持し、実行時のモデル/APIは使わない。輪郭巡回は4196の別実験へ分離。


## 2026-09-30 — 対応語と手続き形状の別版

`feat/glyph-word-shapes-v2` で旧試作を保持したまま、花・蝶・くらげ・木・星・螺旋・砂時計・土星・剣・花瓶を追加。モデルを使わず、文章の対応語と数式を組み合わせる。専用ポート4194で起動。文字の面被覆、追加の語、通常操作・執筆・日記を比較している。[記録](experiments/word-shapes-v2/README.md) / [作品の進捗](concepts/glyph-creature/PROGRESS.md)。

以下は旧版の記録。

更新日: 2026-09-30 / 設計の最初の版: `design-v0.1.0`

**現在地: 執筆の逐次追加、30秒の形の周期、文章の形指定後60秒の優先を統合。v0.8.0。**

[今回の操作と範囲](prototypes/glyph-creature/README.md#執筆と形の変化)。夜間の自動実行は停止したまま、今回はユーザーの直接の修正依頼による作業。

公開先: [ai-game-lab](https://github.com/KOSEIHAMAYA2077/ai-game-lab) / 試作の作業一覧: [Issue #1](https://github.com/KOSEIHAMAYA2077/ai-game-lab/issues/1)

| 対象 | 状態 | 確認する場所 |
| --- | --- | --- |
| 市場・本・カンファレンス・並列AIの調査 | 完了 | [RESEARCH.md](RESEARCH.md) |
| 質問から試作へ進む制作手順 | 完了 | [WORKFLOW.md](WORKFLOW.md) |
| ハーネスの設計 | 完了。実行機能は試作と合わせて実装・確認 | [HARNESS.md](HARNESS.md) |
| 文字の集合P0の核と最小範囲 | 版0.8.0へ改訂、直接の修正指示を反映 | [BRIEF](concepts/glyph-creature/BRIEF.md) |
| コンセプトアートの実装 | 執筆・日記・筆画の試作とビルド完了 | [作品の進捗](concepts/glyph-creature/PROGRESS.md) |
| 動作確認・本人の試遊 | ロジック77件・全60ブラウザケース・型確認・ビルド成功。実IMEと本人による今回の版の評価は未確認 | [作品の進捗](concepts/glyph-creature/PROGRESS.md) |

## 完了したこと

- [x] 初案として自由入力、文字が残る身体、全体の変形、反応による愛着を整理した。
- [x] ユーザーが決めたこととAIの提案を分けた。
- [x] 制作手順、最小ハーネス、再利用する指示書を作った。
- [x] 設計文書を独立レビューし、ローカル参照を公開版から分けた。
- [x] 文書の内部リンクと、原画像を変更せず保存していることを確認した。
- [x] GitHubへの公開と版・進捗管理について、ユーザーから許可を得た。
- [x] 公開リポジトリへ設計資料を登録し、試作の進捗Issueを作成した。
- [x] 初回を、文字の凝縮・流動・形状・密度を見るコンセプトアートへ変更した。
- [x] 4形状、ボタン操作、赤から白への変化、密度・成長・カメラ距離について回答を得た。
- [x] 「回答後に試作開始」という明示の指示に従い、実装許可を版0.2へ記録した。

- [x] 初回の文字アートを実装し、4形状・入力・色・成長・密度を確認した。

- [x] 常設のWeb風UIを除去し、Enterで開く白枠ターミナルに変更した。
- [x] 文字を厚さゼロの3D平面にし、表・真横・裏の描画を確認した。
- [ ] クイズ・実績／図鑑の方向は相談中。今回の修正には含めない。

- [x] 形・流れ・色・個数・鎖のことば入力と、文字そのものが吸収される導入を追加。
- [x] 無料小型AI2種を端末内で実測。意味精度不足で採用見送り、[調査記録](concepts/glyph-creature/LOCAL_AI_RESEARCH.md)を保存。

- [x] 自作分類器を3,684例で学習し、独立問題群で評価。重み・失敗・再学習手順を保存。
- [x] 学習モデルを初期オフの実験機能として作品へ追加。

- [x] 最初のEnterで入力欄、初回送信後にボタン、HELPから5段階の案内。
- [x] 自由文の複数候補選択、花火、球体の流路。
- [x] 執筆の別窓連携、日別保存・復元・書き出し。OS全体の入力取得は未実装。
- [x] KanjiVGの7文字による一画分解試作、MARYの一次資料確認。

## 次の一手

[試作の起動方法](prototypes/glyph-creature/README.md)から文字を加え、流れと密度の表現がイメージに近いか確かめてもらう。実施した確認と残る制限は[作品の進捗](concepts/glyph-creature/PROGRESS.md)に記録済み。

## 更新の仕方

作業の区切りごとに、実際に終えたこと・確認した結果・次の一手を更新する。作品ごとの詳しい実行結果は、対象作品のPROGRESS.mdへ残す。この一覧はその要約にする。

常時監視や自動更新はまだ設定していない。作業を実行した際に更新し、意味のある区切りをGitHubへ反映する。

## Glyph Matterと16GB向け調査 — 2026-10-02

リポジトリを `glyph-matter` に改名し、[新しい公開URL](https://koseihamaya2077.github.io/glyph-matter/)で入力・描画と保存タグのmanifestを確認した。公開元の版・過去の履歴は保持。

[先行研究と次の方針](research/16gb-text-to-3d-20261002.md)、[小モデルCPU比較](experiments/consumer-16gb-20261002/README.md)を追加。0.8B/2BはCPUで動くが、形を求めた20文の全意味条件一致は0/20・1/20。汎用小LLMの直接採用は見送る。次は小さい意味encoder・専用head/decoderと決定的配置処理を別版で比較する。16GB Intel/AMDノートでの性能・新しい構造の組立は未検証。

## 生成時間と骨格方式の追加条件 — 2026-10-02

入力確定→肉付け→文字を伴う初回描画まで約10秒を目標とする。[骨格生成案 v0.1](research/skeleton-first-10s-v1.md)を別ブランチに保存。花瓶・剣・輪を少数の構造と寸法で扱い、肉付けは決定的な処理へ任せる。設計更新のみで、既存の試遊版・CPU実測結果は変更していない。

今回の期限付き継続実行は停止した。今後の常時監視・自動更新は行わない。
