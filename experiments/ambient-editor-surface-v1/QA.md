# Root所有のproduction QA

この資料は **未実行の実UI計画**。作者のCPU結果と別。GPU soak終了のgateが開いてから、production distだけを専用localhostへ配信する。リポジトリ/ `.local` / source / Vite `@fs` を公開しない。

entry `.runtime/dist-surface-r2/index-r2.html`。CSP connect-src none。network tabでlocalhostのHTML/JS/CSS以外のruntime外部送信が無いことを確認する。OS/他app/clipboard監視なし。pasteはこの専用textareaへの人の操作だけ。

| 操作 | 確認する境界 |
|---|---|
| 初期 | 黒い空間にvisual @、aggregate bodyCount0 / drawnMaterial0 / atlasKinds0。 |
| 人工 `青い球` + ASCII | 専用欄のconfirmed分だけbody。planeが表示され、旧球面の動き。IMEがunknownなら0のまま未確認表示として記録。 |
| 色青→緑→紫 | 旧文字色保持、次の追加だけ新色。body IDや本文のQA global露出なし。 |
| 人工 `箱` / `輪` +最大256以内の合成paste | バッチ/保持条件を満たす場合だけcube/Mobiusへ。slot/text/色をshapechangeで作り直さない。輪非同値HELP。 |
| 合成Unicode33種以上、emoji | atlas行を増やしても旧UV/色/数が保たれる。複合emojiは1unitでも1atlascell内表示で、字体品質は別評価。 |
| delete / undo / redo | 欄の本文は変わるがappend bodyは残る。 |
| INPUT閉/開 | textarea操作入口を隠すのみ、body再生成なし。 |
| PAUSE/RESUME、document hidden/reopen | aggregate renders/framesがinactiveで増えない。復帰のvisual時間jumpなし。receiver revealは有限少量ずつ。 |
| body256で追加 | wholeeventhold、勝手なsampling/eviction/body再構築なし。 |
| `exportOff()` | aggregateのみ、本文/ID列/色順/query/fingerprint無し。 |
| console / CSP / WebGL | compile/runtime error・未描画・外部requestの有無を原票へ。 |

`window.ambientSurfaceLab.inspect()` は本文/ID列を返さない。`pause(boolean)` と `exportOff()` は有限control/aggregateのみ。実textareaの値はブラウザ内にvolatileとして存在するが、console/logへ原文を出さない。

結果は新しいroot QA folder/原票に保存し、作者の凍結source/resultsを上書きしない。実DOM入力の確認はOS全体の入力連動や実IME一般の認証ではない。native resource/human comfortの採否とは別に扱う。
