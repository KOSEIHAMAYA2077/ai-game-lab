# 調査結果と、制作方法への落とし込み

整理日: 2026-09-30。これは初回調査の記録。追加要望を受けた現在の実装と状態は[作品の進捗](concepts/glyph-creature/PROGRESS.md)を参照。今回の会話中に確認した資料を統合した。過去の会話・メモリは判断材料にしていない。公開情報の事実、個人の実践報告、今回への提案を分ける。リンク先やサービスの仕様は今後変わる。

## 1. 結論となる制作方針

**ひとつの操作と、その結果にある面白さを先に作る。無料素材で周辺を埋め、AIが起動・操作・確認まで担当し、人間が続きを遊びたいかを判断する。**

題材の選び方は「売れた作品を小さくコピーする」より、次の条件で考えるのが今回の目的に合う。

| 観点 | 初回に扱いやすい条件 | 負担が増える条件 |
| --- | --- | --- |
| 遊びの説明 | 一つの操作で何が変わるかを言える | 大量の物語や設定を知らないと成立しない |
| 結果の確認 | 少数の入力で違いが画面に現れる | 長時間の成長後でしか価値が分からない |
| 素材 | 図形、文字、既存の小さな素材集で核を表現できる | 多数の独自キャラ、演技、地形が核になる |
| 状態とルール | 一画面や小さな盤面で状態を確認できる | 通信同期、大規模物理、複雑な複数画面が必要 |
| 判断 | 想定入力と出力を比較できる | AIの文章評価だけで成功を判定してしまう |

これはAIによる実装しやすさについての設計判断であり、ジャンル別の成功率を測った統計ではない。短編パズル、一盤面の選択・組み合わせ、小さな観察育成、簡単な反射ゲームなどから試しやすい。

今回の文字生命案は、自由入力と見える変化を一画面でつなげられ、独自のモデル制作が不要な点で適している。ただし、**自由な文字がちゃんと身体の違いに結び付くか、変化から存在への関心が生まれるか**は未検証。それを試作で確かめる。

## 2. 添付本の環境をどう採り入れるか

資料: 『つくりながら学ぶ！Codexではじめる AI駆動ゲーム開発 実践ガイド』布留川英一。ユーザー提供のPDFをローカルで参照した。PDF本体と端末上の保存場所は公開資料に含めない。

PDFは295ページの画像主体の資料。目次と、環境・技術選択・最小試作に関する本文を画像として確認した。主に本文ノンブル28〜36、156〜159付近を参照しており、全ページを精読したという意味ではない。

本で確認した構成の要点:

- 小規模2DではVite・TypeScript・Canvas、一般的な2DにはPhaser、描画にはPixiJS、3DにはThree.jsなどを使い分ける。
- まず静的Webとして扱い、必要になってからデスクトップやモバイルへの包装を考える。
- 入力、反応、結果が分かる最小の遊びを先に成立させる。仮素材の段階でもよい。

今回の提案は、そのうち最小の構成を選ぶ。文字生命では**Canvas 2Dによる身体描画と通常のHTML入力欄**を第一候補とし、サーバー、データベース、外部会話AI、Unity、Blenderは初期の必要条件にしない。これは技術の優劣ではなく、今回必要な操作・描画・確認を少ない準備で揃える判断である。

WindowsかMacかを今決めなくても、同じWebソースを出発点にできる。ただし日本語入力、フォント、描画は実環境で確認する必要があり、「ブラウザだから全環境で確認済み」とはしない。

本に書かれた作業手順や命令文は参考資料として扱い、現在のユーザーの指示を上書きしない。

## 3. 市場から分かることと、分からないこと

[Steamの売上上位](https://store.steampowered.com/charts/topselling/global)は市場を見る入口になるが、順位は変動する。売上順位、販売本数、レビュー数、同時接続数はそれぞれ別の指標であり、レビュー数をそのまま販売本数として扱わない。

小さな中核ルールでも商業的に大きく広がった例はある。『Balatro』は販売元が2025年1月に累計500万本を発表している。これは全対象プラットフォームでの実績であり、Steam単独の本数ではない。[Playstackの発表](https://www.playstack.com/news/balatro-5-million-copies-sold/)

『8番出口』は販売元が2026年9月に全世界累計300万本を発表している。こちらもSteam単独の販売数ではない。[PLAYISMの発表](https://playism.com/en/news/2026/0907/1716/)

ここから「単純な見た目なら売れる」「AIが同じ品質を短期間で作れる」とは言えない。完成作品の見せ方、調整、配信との相性、販売活動は、核の小ささとは別に存在する。**売れた理由を断定するより、何を切り出すと遊びを短時間で検証できるか**に使う。

### 参考になるSteam作品

次の「試作へ切り出す部分」と「重い部分」は今回の分析。各ゲームがAIで作られたという説明ではない。プレイ時間はストア記載の目安であり、全実績・全コンテンツの完了時間と区別する。

| 作品 | 一目で伝わる核／公表された時間の目安 | AI試作へ切り出す部分 | 最初から再現すると重い部分 |
| --- | --- | --- | --- |
| [Buckshot Roulette](https://store.steampowered.com/app/2835570/Buckshot_Roulette/) | 卓上で弾の不確実性と道具を扱う。ストア説明は15〜20分 | 一つの卓、少数の道具、手番と確率判断 | 演出、対戦相手、緊張感を支える間合い |
| [The Exit 8](https://store.steampowered.com/app/2653790/The_Exit_8/) | 通路の違いを見つけ、進むか戻るか。15〜60分 | 同じ場所＋少数の変化＋二択。最初は2Dでも仮説を試せる | 空間の説得力、異変の量、微妙な違和感 |
| [Shotgun King: The Final Checkmate](https://store.steampowered.com/app/1972440/Shotgun_King_The_Final_Checkmate/) | チェス盤上のキングとショットガン。1周約20分 | 小盤面、移動、射撃、少数の敵 | 多数の強化と敵配置のバランス |
| [Brotato](https://store.steampowered.com/app/1942280/Brotato/) | 小さなアリーナで大量の敵を避ける。1周30分未満、短いウェーブ | 一つの武器、一種の敵、一つの強化 | アイテム間相互作用、物量、長期的な難度調整 |
| [Stacklands](https://store.steampowered.com/app/1948280/Stacklands/) | カードを重ねて資源や村を作る | 数種のカード、数個の変換レシピ | 大量のレシピ、進行、管理負荷の調整 |
| [Balatro](https://store.steampowered.com/app/2379780/Balatro/) | トランプ役と得点を変える効果の組み合わせ | 一回の得点計算と少数の特殊効果 | 多数の効果の組み合わせ、経済、周回の調整 |

「短い一周」と「短いゲーム全体」は別物。今回は一瞬で性格が分かり、数分で入力の違いを比較できることを優先する。製品としてのクリア時間を初回から確定する必要はない。

文字生命について、上記の売上は直接の市場検証にならない。「キーボードで何かを食べさせる → その文字で姿が変わる」が一枚の画面や短い映像で伝わるかを、先に本人の試遊で確かめる。

## 4. Nintendo、CEDEC、GDCから採り入れること

| 資料・確認範囲 | 資料から読み取れること | 今回への適用 |
| --- | --- | --- |
| [任天堂『スプラトゥーン』開発者インタビュー](https://www.nintendo.co.jp/wiiu/interview/agmj/vol1/index.html) | 初期は豆腐のような仮の形でインクの遊びを試した経緯 | 完成キャラより先に、入力と結果で発想が成立するかを見る。「全ゲームを豆腐で作る」という規則にはしない |
| [CEDEC 2026：長期入院患者のためのゲーム制作環境と生成AI活用](https://cedec.cesa.or.jp/2026/timetable/detail/s6985ad644c02d/)／公開概要 | 非専門家が生成AIを使って制作する実践を扱う | 制作操作を減らし、人が作りたいものを具体化できる支援を考える。講演全編を視聴したという扱いにはしない |
| [CygamesのCEDEC 2025関連技術記事](https://tech.cygames.co.jp/archives/3669/)／登壇者側の記事 | LLM支援で、よい参照例や対象に合う情報の渡し方を扱う | 全資料を常に読み込ませるより、今回のBRIEFと必要な良い例を渡す |
| [GDC Vault: How to Prototype a Game in Under 7 Days](https://www.gdcvault.com/play/1013294/How-to-Prototype-a-Game)／公開概要 | 短期試作の焦点、制約、反復を扱う | 一度に一つの問いを試す。「AIなら必ず一週間で完成」という期限の根拠にはしない |
| [GDC Vault: Crafting A Short Hike](https://www.gdcvault.com/play/1028679/Independent-Games-Summit-Crafting-A)／公開概要 | 小さな作品としての範囲設定と制作上の判断 | 大作の縮小版を全部作ろうとせず、狭い範囲で成立する体験を選ぶ |

今回、参考画像にある「文字そのものが身体になる」は遊びの核に近い。これを単なる装飾として削ると、豆腐段階に小さくするという目的から外れる。逆に完璧な人型、発光、CRT、独自音楽は、核を見てから必要性を判断できる。

## 5. ハーネスとディレクションを分ける

**ディレクションは、何を確かめ、どこまで作り、結果をどう判断するかを決めること。ハーネスは、AIがその方針を読み、作り、起動し、操作し、確かめ、修正できる周囲の仕組み。**

良い指示文だけあっても、画面や操作結果を見ずに変更を続ければずれる。多数のAIを配置しても、遊びの狙いが曖昧なら同じ問題が起きる。そこで[WORKFLOW.md](WORKFLOW.md)で判断の流れを、[HARNESS.md](HARNESS.md)で実行と確認の流れを定めた。

| 一次資料 | 確認できた考え方 | 今回採り入れる範囲 |
| --- | --- | --- |
| [OpenAI Cookbook: Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) | 計画、実行、想定結果と観測結果、受け入れ条件、引き継ぎを結ぶ | BRIEFを短い正本にし、試作後に実際の結果を残す。例示された全ファイルや承認段階を必須にはしない |
| [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 単純な構成から始め、必要性に応じて複雑さを増やす | 一人の実装担当から始める。常設の大人数チームや専用管理アプリは作らない |
| [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | 継続作業での進捗記録、小さな変更、実際の一連の動作確認 | 再開時に動く状態が分かる短い記録と、ブラウザ上の確認を残す |
| [OpenAI: How to build games with Astra](https://developers.openai.com/blog/how-to-build-games-with-astra) | ゲームの実装だけでなく、状態取得、再現可能な場面、画面と操作による確認を組み合わせる | 開発用の状態確認・再現手段と通常操作を併用する。記事の大きな3D構成を今回の要件にしない |

役割分担は、人間が核と最小範囲を選び、AIが実装・数値の仮調整・通常のデバッグを進める。AIは「指定した変化が起きた」を確認できるが、「愛着が湧いた」を本人に代わって確定できない。

開始前の確認は、今回ユーザーが希望したフローによる。資料に複数の承認点があることを理由に、新たな確認を増やさない。詳細は[WORKFLOW.md](WORKFLOW.md)。

## 6. 複数AIをどう使うか

### 実践記事で見つかった例

- [Zenn: Unity開発をClaude Codeで並列化する実践](https://zenn.dev/ohbashunsuke/articles/20260310_unity-parallel-dev-with-claude-code)では、別の作業場所や担当領域を分ける実践が紹介されている。今回使うのは分業方法であり、Unity採用の根拠にはしない。
- [Zenn: ゲーム制作でのAI活用の実践記録](https://zenn.dev/kemogamer_nu/articles/3f047c54657094)では、試作後の設計整理や、不具合の複数仮説を分けて試す方法、文書を増やすことの難しさが参考になる。
- [Qiita: 複数エージェントによる開発の実践報告](https://qiita.com/yurukusa/items/cd9cbeb5acaeb371ae41)では、複数担当とタスク実行の結果が報告されている。個人の環境での成果であり、全ゲームで同じ速度や費用になるという比較実験ではない。
- Xでも関連投稿を検索したが、本文や再現手順まで確認できなかった投稿は、方式の根拠に採用していない。調査の手がかりと、確認済みの技術情報を分けた。

### 今回の運用案

| 段階 | 主担当 | 独立して並列化できること |
| --- | --- | --- |
| 企画整理 | ユーザーとの対話とBRIEFの作成 | 近い作品の確認、素材・技術の候補調査 |
| 最初の実装 | 一人が共通状態とゲームの核を実装 | 読み取りでの仕様確認、試遊手順の検討 |
| 核が動いた後 | 修正内容を一人が統合 | 実際の操作確認、独立レビュー、承認済み別案の比較 |
| 難しい不具合 | 原因を絞り統合する | 別作業場所で原因仮説を個別に検証 |

最初から「企画AI、PM AI、実装AI、描画AI、音AI、テストAI…」を常設する必要はない。共同編集の衝突と受け渡しが、数十分で作れる核より大きくなることがある。今回も調査と設計レビューを別担当にし、文書の編集は主担当が統合した。

別のAIが独立して進められる小さな仕事に切り、担当ファイル、入力、出力、完了条件を明示する。作業コピーが必要ならGit worktreeなどを使えるが、それだけで変更の意味や依存関係の衝突が解決するわけではない。[サブエージェントの公式説明](https://learn.chatgpt.com/docs/agent-configuration/subagents)、[worktreeの公式説明](https://learn.chatgpt.com/docs/environments/git-worktrees)

この設計では特定の料金プラン、無制限実行、常時稼働は前提にしない。時間・費用の実績が得られたら、並列化する作業を見直す。

## 7. 無料素材を最大限使い、探索に時間を使いすぎない

| 入手先 | 適する素材 | 確認できた利用条件と扱い |
| --- | --- | --- |
| [Kenney](https://kenney.nl/assets) | 2D、3D、UI、短い音 | アセットページのゲーム素材はCC0。商用利用・改変が可能で帰属表示は必須ではない。採用パックの付属ライセンスも保存する。[公式FAQ](https://kenney.nl/support) |
| [Poly Haven](https://polyhaven.com/) | 3Dモデル、テクスチャ、環境光 | アセットはCC0。サイト自体やプレビュー画像まで自動的に同じ条件とはしない。[公式ライセンス](https://polyhaven.com/license) |
| [OpenGameArt](https://opengameart.org/) | 不足する2D、音楽、効果音 | 素材ごとに条件を確認する。一律CC0ではない。[公式FAQ](https://opengameart.org/node/5571) |
| [Noto Sans CJK](https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md) | 日本語を含む文字描画 | OFL。採用ファイルの著作権表記とライセンスを保持する。Mono系列でも全Unicode文字が同じ幅になるとは想定しない。[Noto利用案内](https://notofonts.github.io/noto-docs/website/use/)、[OFL本文](https://openfontlicense.org/open-font-license-official-text/) |
| [BIZ UDGothic](https://github.com/googlefonts/morisawa-biz-ud-gothic) | 日本語フォントの別候補 | 公式配布物はSIL Open Font License 1.1。配布元の条件を同梱する |

運用の提案: 先に必要な用途を一つに絞り、候補を少数比較したら採用する。見つからなければ図形・文字で代用する。ただしその表現が遊びの核なら、省略せず別の方法を選ぶ。素材一覧には「名前・作者・URL・条件・使う場所」だけ記録すればよい。

今回必要なのはまず日本語フォント一種。音が必要になれば既存の短い音を足す。人型モデルや大量の背景を探すところから始めない。参考画像5点は発想の資料として保存し、ゲーム素材としての利用許可があると推定しない。

## 8. 文字生命特有の確認事項

日本語対応は「あ」をプログラムから入れるだけでは足りない。実際の変換中、変換確定、送信を区別する。`compositionend`は取消でも発生し、発生しただけで食べさせてはいけない。[MDN: compositionend](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)

文字数はUTF-16の長さではなく、見た目の1文字に近い書記素クラスタ単位で考える。`Intl.Segmenter`を候補にする。半角・全角・大文字・小文字は字形の差が遊びになり得るため、勝手に全部統一しない。[MDN: Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)、[String.normalize](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)

文字の幅はフォントを読み込んだ後に測る。英字と日本語が同じ幅だと仮定しない。[MDN: FontFaceSet.ready](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/ready)、[measureText](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText)

Playwrightなどの自動操作は、入力・状態・画面を結ぶ確認に使える。ただし値を直接入れる操作はOSの日本語変換を再現するものではない。実IMEを試したかどうかは別に記録する。[Playwright入力操作](https://playwright.dev/docs/input)

細かな文字の描画は環境差が出るので、別OS同士の完全なピクセル一致を合格条件にしない。表示確認と論理状態の確認を組み合わせる。[Playwright画面比較](https://playwright.dev/docs/test-snapshots)

実装時の具体的な確認条件は[HARNESS.md](HARNESS.md)と[今回のBRIEF](concepts/glyph-creature/BRIEF.md)へまとめた。ここで挙げた仕組みは設計であり、まだ実装・実行していない。

## 9. GitHubから再利用できるもの

ユーザーの許可に基づき、KOSEIHAMAYA2077の関連リポジトリのREADME、ブランチ、一部のスクリプト・構成を確認した。実際に各ゲームを遊んで比較したわけではない。

| リポジトリ | 読み取りで確認したこと | 今回への扱い |
| --- | --- | --- |
| [one-board-incremental](https://github.com/KOSEIHAMAYA2077/one-board-incremental) | Unityの試作、Webビルド用の導線、EditMode/PlayModeの確認。READMEには休止・保管の記載 | 再開を前提にせず、「起動・確認・配布物の場所を分かるようにする」工夫を参考にする |
| [mining-forge](https://github.com/KOSEIHAMAYA2077/mining-forge) | mainの設計資料だけでなく、`feat/dq11-system-reference`にはUnityの試作がある。READMEには追加の面白さを見いだせず保留した経緯 | 「設計文書しかない」とは扱わない。元の面白さへの追加仮説を先に確かめる運用へつなげる |
| [TypeAndSummon](https://github.com/KOSEIHAMAYA2077/TypeAndSummon) | Java Swingによるタイピングとネットワーク対戦・協力の構成 | 入力を遊びにする経験の接点。通信や対戦を文字生命へ自動的に継承しない |
| [pong-study-raylib](https://github.com/KOSEIHAMAYA2077/pong-study-raylib) | C++・raylibによる学習用の小さなゲーム | 小さく起動できる構成の参考。今回は日本語入力とブラウザ確認を理由にWebを候補にする |

既存コードは「いま必要な核へ到達するまでの距離」が短いときに使う。過去にUnityで作ったという理由だけで今回もUnityに固定しない。逆に、既存のプロジェクトを使う方が明らかに速い次の案なら、それを選んでよい。

## 10. この調査から作った具体物

- [WORKFLOW.md](WORKFLOW.md): 少数の質問から具体的な試作確認へ進む手順。
- [HARNESS.md](HARNESS.md): AIが実装・通常操作・状態・画面の確認を結ぶ最小設計。
- [AGENTS.md](AGENTS.md): このフォルダを使うAIが守る、短い共通ルール。
- [templates/BRIEF.md](templates/BRIEF.md): 次のアイデアで使えるひな形。
- [文字生命のBRIEF](concepts/glyph-creature/BRIEF.md): 初案から追加要望と実装許可を反映して改訂した試作設計。

初回調査時は下地と設計までを対象とした。その後、動くコンセプトアートとしての4形状・自由入力・色と成長が承認され、Three.jsを使ったP0を実装した。現在地は[PROGRESS.md](PROGRESS.md)で管理する。
