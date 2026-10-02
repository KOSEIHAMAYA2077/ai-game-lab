# Windows16GB実機での比較案

2026-10-03。**未実行の計画**。本フォルダにWindowsのCPU/RAM/fps/起動秒数/電力の測定値はない。[共通の資源計画](../widget-study-protocol-v1/RESOURCE_PLAN.md)をWindowsへ具体化するが、同文書の過去のsoak進行状況を現在の状態へ読み替えない。rootが現在測っているMacの通常窓結果も、この資料では参照・再集計していない。

## 比較を増やしすぎない

最初は A: Win32＋D3D11＋DirectWrite と W: WebView2＋同じWeb描画基準、または既存Mac Metalとの機能照合までに絞る。**Mac Metal対Windows D3Dの資源差は、OS・hardware・fontも変わるためbackend単独の因果差と呼ばない。** SDL／wgpu／Qt全てを同時に実装する必要はない。共通shader・複数OSの保守が問題になった段階で、BまたはCを一つだけ追加する。

WとAで、共通3形・文字数・色・seed・時刻・カメラ・サイズ・fps・吸収phaseを合わせる。形や文字が減る軽量版を高速な同等版としない。Web asset／GPU reference／実行物のhashを保存する。TauriはWebView2と既存Web描画を使用する場合にWのshell差として扱い、native wgpuやQt nativeとの等価rendererと勝手にみなさない。

## 実機・条件

物理的な16GB x64 Windows laptop＋iGPUを少なくとも1台で測る。機種名、CPU/GPU、OS/build、driver、RAM、電源、display解像度・refresh、DPI、window client/outer寸法、backbuffer画素、font、実行物hash、runtime版を記録する。16GBを指定したVMやMac32GBの上限設定を代用にしない。1機種なら「その機種での結果」とする。

| 軸 | 最初の条件案 | 対応する品質・状態check |
| --- | --- | --- |
| 文字数 | 描画1、385、1,536。保存32,000／描画1,536の容量条件も別 | storedとdrawnを混同しない。atlas種類数も固定 |
| 形 | 球・箱・メビウス各1 | 60形全体・6 Program分類の評価へ外挿しない |
| 時間phase | warm通常15fps、吸収中30fps、形変更、入力なし | request fpsと実frames/秒を別列。face coverageと文字visibilityを画像でも確認 |
| window状態 | visible、visible＋pause、hidden、minimized、他窓に覆われる、lock、復帰 | hiddenとoccludedを同じ状態扱いしない。deadline/予約数、time、frames、CPU、欠落を照合 |
| 初回 | cold process、font/atlas/shader準備、warm再入力 | compiler／OS cacheは勝手に「空」としない。初回downloadなし条件と配布導入を分ける |
| 材料burst | 合成commit 1/10/100/1,000 grapheme、32,000容量、種類上限へ接近 | queue長、入場数、保留、時間分散、atlas再構築回数、古いID/色を保持 |
| 解釈 | rendererのみの基準、frozen解釈器を必要時に呼ぶ条件 | 解釈latency、文字追加latency、終了後RAMを別。ambient内容反映の効果と命令精度を混ぜない |

warmの短時間比較は120秒暖機＋300秒記録を候補とし、同条件を5回、順序交互またはrandomで実施する。初回結果を見て測定窓や採用線を都合よく変更しない。測定担当以外のbuild/model/GPU試験を同時に走らせない。失敗原票も残す。

## Windowsの数字の意味を固定する

| 指標 | 提案する記録 | 誤読を避ける条件 |
| --- | --- | --- |
| CPU | 帰属PIDそれぞれのkernel＋user CPU time差分／実elapsed×100。100%＝1論理コア、全PID合計 | Task Managerの全core比率と無記名で混ぜない。multicoreでは100%超もあり得る。CPU submitの壁時計msはCPU使用時間ではない |
| resident | 同時刻WorkingSetSize、PID一覧、group合計 | 共有pageの重複を完全に除いたphysical RAM差分ではない。Mac charged footprintと同名比較しない |
| private commit | PrivateUsage、同時刻group合計、ピーク | Working Set／RSSではない。commitをresidentと呼ばない |
| GPU資源 | atlas/instance/backbufferの論理payloadと、取得できるdriver/GPU指標を別 | iGPU shared memoryやdriver pageをprocess RAMへ無条件加算しない。format/row alignmentや一時複製も別 |
| runtime group | hostだけでなくbrowser/renderer/GPU/helper/model processの起動・終了を対応付ける | WebView2 groupはUser Data Folder等で共有され得る。専用profileで開始する案でも帰属を実際に検査。不明な共有は不明と報告 |
| frameとwake | 実frame差分、body draw差分、animation deadline予約、event wake理由 | 1 draw≠1 frame≠無CPU。UI dirty drawと定期animation drawを別にできる診断を計画 |
| 電力 | 計測法・sampling・電源・温度を固定し、可能な物理Wまたはenergyを別収集 | fps/CPU/GPU使用率からWを推計しない。ソフトの指標やbattery差分を無条件に電力量と呼ばない |
| 長時間 | plateau後30分→2時間→8時間の同状態窓、error、資源数、保存結果 | intentionalな身体/atlas増加とleak候補を分ける。offscreen継続と通常窓全体の低負荷は別証拠 |

CPU timeの定義は [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes)、Working Set／PrivateUsageの区別は [PROCESS_MEMORY_COUNTERS_EX](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters_ex)。WebView2の帰属単位は [process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model) を確認した。実測collectorはまだ作っていない。

既存の候補予算である通常CPU≤5%／1論理コア、常駐200MiB、入力時peak512MiB、CPU submit p95≤3msは設計提案であり、Microsoft公式の標準でも達成値でもない。Windowsの**200MiB採否に使う主列は未確定**。最初のpilotはworking setとprivate commitを両方報告し、共有とGPU計上の意味を説明してから、最終Windows比較の前に主列・線を凍結する。停止/非表示の「ほぼ0」も、empty対照・sample間隔・検出限界を添え、frameが止まっただけで達成としない。

## 表現・入力・保存を同時に落とさない

同じcameraで少数文字と最大文字の面被覆、文字の縦横、前後関係、cube面の向き、Mobiusのねじれ、旧色を対画像で検査する。MacとWindowsのfont/rasterizerは異なるため、字形pixel完全一致を要求せず、geometry referenceと機能上の不変条件を別に検査する。低RAMのため少数の字形だけ表示した条件は別品質条件として報告する。

IME・paste・編集・undoの実窓試験は、合成commit再生と分ける。Windowsの普通の入力欄の動作確認だけでOS全体取得を検証したとしない。append-history／document-sync、cross-commit grapheme、seq dedupe、backpressure/no-ACK、saving-offのglyph/ID揮発条件は、将来adapter接続の別integration試験に残す。

black小窓／常に手前は作業を覆う可能性がある。renderer性能の主比較は同じ400×440条件で固定し、その後に配置やhide affordanceを [HCI評価案](../side-interior-hci-v1/EVALUATION.md) で比較する。細いstripへ替えて文字surfaceが読めなくなった結果を無条件の改善としない。CPU/RAMの合格、人間の短期負担、数日使った感想、研究6形の命令精度は、それぞれ別の結果とする。

## 将来報告の書式

各trialに `status: planned / completed / failed / invalid`、platform、device、runtime/backend、source/fixture SHA、window状態、elapsed、actual frame数、CPU定義、各memory欄、font、error／invalid理由を持たせる案とする。今回は全てplannedで、Windowsの完成・失敗trialは0件。rootが更新するMac成果やWindows実行物ができた後に、別の実行記録へ値を保存する。この文書へ推定値を観測値として埋めない。
