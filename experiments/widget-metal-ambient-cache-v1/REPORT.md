# Cache R1 result and boundaries

採否: **固定した CPU/source 接続候補として受理**。同じ人工イベント・時計に対する旧 Build R5 の表示を保ち、待機時の本文全文転送・全 prefix 検算を除く目的は、この有限範囲で成立しました。実窓、実 IME、常駐 CPU/RAM、快適さ、OS 取得は未確認です。Mac はロック中で、UI/GPU を起動していません。独立 reviewer の結果はこの作者結果と別に扱います。

## 事前固定と原失敗

[METHOD-R1](METHOD-R1.json)・native14・core3・invalid8・局所 timing の proposal を実装前に固定し、SHA を root へ通知しました。手書き期待は AI が作ったもので、人間の意味 annotation/評価ではありません。candidate R1 source は初回 source freeze の 29 files と全て一致しています。元 23 readonly input pins も一致しています。

初回 Node は native14 **14/14**、core3 **2/3**。R03 の body、ID、色、文書は一致していましたが、検査が `inspect(state).focusEpoch` という存在しない項目を読んでいました。原 source/結果を保存し、別検査 source `core-replay-r2.mjs` で `state.focusEpoch` を参照しました。別 [HARNESS-FIX-R2](HARNESS-FIX-R2.json) を結果前に固定し、core3 **3/3**。期待値や candidate/core の変更ではありません。旧 R1 原票を pass に書き換えていません。

## CPU/JSC comparison

| Gate | 結果 | 対象 |
|---|---:|---|
| 手書き native14 | 14/14 | baseline/追加/IME人工trace/削除undo/body cap/Unicode/停止/非表示/shape-only/reset/idle/unsupported/duplicate |
| 手書き pure-core3 | 3/3 | multiple source、operation echo、independent activity gap と pending retry、focus change |
| malformed wire8 | 8/8 | session/generation/count/presented regress、欠けた delta、古い/重複 ID、extra payload、過大 unit |
| 旧新版 instance 比較 | 15,908 対一致 | 全 80B byte、literal UTF-16/ID/ink/birth/intakeSeed/inputIndex |
| 既存 native16 式 | 96/96 finite | 16 geometry ×2 times ×3 IDs。元コピーの有限性確認で、新 GPU 評価ではない |

core3 は元 R3 へ直接送る人工 grammar で、native API を multiple-source/OS 取得へ拡張したものではありません。旧 full readBody representation と新 delta を実 Swift projection へ通しています。native14 は旧 immutable R5 bundle と新 bundle の実 JavaScriptCore を使います。

@ は元の NSTextField の仮表示で body0/glyph0。削除/undo/未知の document-only 変更で素材を消しません。append の削除履歴方針は暫定。新 ink は新追加だけに適用し、過去の色を保持します。既知 3 字句候補の球/箱/輪を sphere/cube/Mobius の表示へ写します。普通の輪と Mobius は同じ形ではなく、16/60 形の意味モデルではありません。

例 K12 は 256 素材を定着させて 60 idle ticks。旧 full JSON は 63 calls / 568,400 bytes / 15,872 unit checks、新 cache は body1 call / 8,997 bytes / 256 checks + metadata63 calls / 25,491 bytes。idle 部分の新 body calls/検算追加は **0**。小さい body では metadata overhead と別 delta 呼び出しにより総 bytes が旧版より多いケースもあります。最大 body 待機の結果を全入力へ一般化しません。

## 局所 workload timing

人工時計を圧縮して実行し、own CLI の `CLOCK_PROCESS_CPUTIME_ID` と monotonic wall を測りました。実際に 15fps で 100 秒間窓を動かす試験ではありません。本文 256 を初期化・定着済みの context で 1,500 ticks ×5 round、順序 old-cache/cache-old を交互にしました。JIT warmup の費用が残り得るので、完全な steady state と呼びません。

R1 原票には自分の app compiler と重なった区間があり、そのまま保存しています。事前に同じ executable/workload の repeat R2 を宣言し、自分の別 build/runner は止めました。他 root/system の処理は制御していません。root からは別 mostly-idle native-static CLI が開始されたとの通知があり、寄与や全 Mac の静穏を測っていません。

| R2 1,500 ticks/round | 旧 R5 | cache R1 |
|---|---:|---:|
| full/body transfer calls | 1,500 | 0 |
| full/body transfer bytes | 13,746,068 | 0 |
| metadata calls/bytes | full に包含 | 1,500 / 613,568 |
| prefix unit 検算 | 384,000 | 0 |
| own CLI process CPU median | 0.453794 s | 0.015989 s |
| instance updates on settled idle | 0 | 0 |

5 round 全ての semantic/instance gate が一致。CPU の range は旧 0.452897–0.455388 s、新 0.015613–0.016452 s。wall 値と全 round は [R2 原票](results-timing-r2.json) を参照。時間への合格閾値、best round の選別、試験後の tuning はありません。

cold10 pairs と burst110 ticks も固定 workload で保存しました。cold は旧 bundle 56,465 bytes、新 42,266 bytes と export graph が異なります。新 runtime には旧 manual evaluator を出しておらず、cold 差を cache 単独の効果としません。burst は新追加 256 units を一回受信し、110 ticks 後に presented256、各 tick の instance bytes が一致しました。これらは font/atlas/Metal draw、OS timer、UI callback、ウィンドウ全体を測るものではありません。

## Unicode/response の既知回帰

旧 R5 response guard の問題に対する **既知接続回帰** として、`A + U+20D0×255` の 256 UTF-16 unit の cluster を 256 回追加し、各回 canonical document を空に戻しました。body は 256 graphemes / 合計 **65,536 UTF-16 units**、presented256。旧最大 raw response205,003B、新最大 delta952B、metadata410B。60 idle の追加 body calls/検算0、off export は同じ集計10キーで一致。cluster を切断して容量成功に見せる処理はありません。

command8192B、metadata4096B、delta524288B を保持。本文最大 JSON の保守 bound は `256×(256×6+64)+8192 = 417792B`。6B は UTF-16 unit ごとの JSON escape の最大、64B は ID/ink/row metadata、8192B は session/固定 field/aggregate 予約です。実応答が上限以下であることと、heap/RSS の上限は別です。JSON string、UTF-8 Data、decoded views、texture glyph cache などが同時に存在し、window RAM を主張しません。

## Ownership and invalidators

R3 が唯一 body/ID/segmentation/canonical/ACK を所有します。Swift の staged views と glyphs はその ID から派生する readonly 表示 cache で、第二 material allocator、文書同期 body、保存物ではありません。session は一回明示 bind。generation/count/nextId の整合と monotonic prefix を要求し、shape-only/held/document-only/ink/idle では body delta を取りません。presented の増分だけ既受信 view を昇格し、出生は first active observation です。reset では core と host の双方を明示作り直します。

body を転送しない tick で、外部が元 core の過去 prefix を密かに改変した場合を検出する fingerprint はありません。固定 R3 の immutable append を前提とする限定契約です。bridge と projection の異常な分離・外部 cache mutation・複数 thread での競合を無損失と呼びません。projection 拒否後の hidden automatic rebase/retry は入れていません。

入力条件と取消方針は旧 R5 / OwnEditor R2 の bytes を保持しています。unknown preedit0、一般 unmark/document-only0、5 秒の trace expiry により実 IME の正しい入力を取りこぼす可能性は残ります。AppKit callback 全順序/hidden単独経路cancel/実IMEは未検証です。temporary no-ACK は native 専用 API では unsupported のままで、OS の損失なく取れるとは言いません。

## Source/app/public audit

旧 renderer、OwnEditor、shader、16 geometry/camera/material/weights/density を同じ bytes で reuse。既定 15fps と pause/hidden 停止を source から保持し、新しい GPU 測定をしていません。新 app は compile/sign/strict verify 成功。元と同じ `fastMathEnabled` deprecation warning があり、renderer は修正していません。新 namespace/resource だけを app に入れ、元状態保存を読まず、実 UI は起動していません。

所有コードには WebView/OS input hook/clipboard 自動読取/network/model/storage 本文 API を加えていません。通常 raw saving は off、R3 off export は本文・ID 列・色順・session・window/query/hash を含まない集計だけ。volatile cache と AppKit 入力・undo・文字 atlas には表示に必要な本文があるため、memory 全消去や OS の内部管理まで証明しません。診断 flag のファイルは数・shape・状態・bytes counters 等の非文字集計だけです。

公開ログは [provenance](PUBLIC-LOG-PROVENANCE-R1.json) で original SHA を記録し、ignored private 原票を保持。公開コピーの trace path だけ置換しました。assert/status/期待値はそのままです。candidate/app/compiled Swift/source pins は [CACHE-CANDIDATE-R1](CACHE-CANDIDATE-R1.json)。JSON/link/pin audit と最終公開 manifest を別記録で返却します。現段階は「軽量常駐達成」や人間の快適さの採択ではありません。
