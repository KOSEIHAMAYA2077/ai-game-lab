# 全入力を材料にする用途と、現在の実装・証拠の境界

レビュー日: 2026-10-03、参照取得03:39 JST。ユーザーの用途は「創作・プログラミング・仕事の横に置き、日常の入力から育つ文字表面のサイドインテリア」。これは目標とする使用像であり、全アプリの本文を現在取得できるという実績ではない。

**現資料は概ね整合する。現在あるのは専用入力欄のアプリ、取得APIの一次調査と設計、独立した人工イベント処理、別々の解釈・描画評価である。取得schemaからpure reducer、既存保存、rendererまでを結んだambient実装は確認していない。** 接続する前に確定証拠・文書範囲・保存・字形同一性を決める必要がある。これらを未接続のまま実装済みと報告したり、命令の合成文成績を日常作業の快適性へ移すことはできない。

このレビューは新しいアプリ処理やテストを実行しない。既存のcanonical原票と、そのsource・型・検査手順を照合した。APIを新しく呼び出す、実IME・ユーザー本文を取得する、通信・権限を変更する、Gitを操作する行為はない。実UI/cameraはrootと描画担当の所有で、こちらは評価しない。

## 使用像と現在の範囲

| 層・主張 | 現在確認できるもの | 未実装・未実証として残すもの |
| --- | --- | --- |
| 全入力が材料になる | 専用欄で本人が送信した本文から身体を作る。活動・候補・確定文字を分けた人工処理 | 全アプリ／全フィールドの確定本文、捕捉率、実IMEとの重複・欠落。secure/除外/非対応経路は対象外または活動だけ |
| 仕事の横で育つ | 黒い400×440の窓、手前表示の切替、停止・非表示の既存処理 | 作業への妨げ・快適性・視線・生産性。小窓は作業領域を覆い得る。taskbar/edge配置へ変更した記録はない |
| 内容から穏やかに形が変わる | 明示送信に既知形を対応させる処理。低頻度の安定した窓は設計候補 | ambient文章の内容反映、安定性、本人にとっての納得。未完成schedulerを実証と数えない |
| 元の文字・色を保つ | 現アプリのraw batch保存と表示用字形。人工appendのID/色保持 | cross-commit結合文字を実rendererへ渡した見え方、文書同期の中央文字同一性、全経路の同じID契約 |
| 保存を切れる | reducerの`persistText:false`が本文・body・ID列をserializerへ出さない | 現アプリの既存storageに対する保存off。dedicated版は本文batchを保存するので、ambientを単に接続しても保存offにならない |
| ウィジェット程度の負荷 | 条件を限定したWeb/native/offscreenの別記録、人工reducerの一回の短い計時 | 通常窓の一式でCPU/RAM/電力予算、16GB一般PC、長期共存。API調査や処理の速さだけでは達成しない |

参照: [方向資料](../../research/side-interior-direction-20261003.md)、[現在の窓](../../desktop/glyph-widget/README.md)、[platform調査](../../research/ambient-input-platforms-v1/README.md)、[研究範囲](../../research/widget-study-protocol-v1/PROTOCOL.md)。黒い空間と既定60形は比較基準である。取得方法を追加するために面を読めない帯へ縮める、未知形生成へ置き換える、既定の形品質を下げることは、このレビューの提案に含めない。

## 先に埋める接続の差

以下は現在動いているアプリの欠陥という判定ではなく、将来接続で誤認を生みやすい差である。platformとreducerは意図的に別資料・別契約で、変換器や適合試験は存在を確認していない。

| 境界 | platform設計 | pure reducer | 接続前に必要な具体条件 |
| --- | --- | --- | --- |
| source・許可 | adapter名、session、allowed、secureState、primaryAdapter、policyEpoch | constructor宣言のopaque sourceとcapability、focus exposure | receiverが接続を許可してからregistryを作る。外部payloadの自称known-safeやcapabilityをそのまま採用しない |
| policy/focus | policy-change、focusEpoch、gapがある | focusでepochを一つ進める。policy-change/gap専用kindはない | policy失効・source切断・gapをどう取消/停止/再baselineへ変換するか固定。focusを推測で代用しない |
| 文書編集 | 同じbaseVersionに最大64 changeの配列 | 一つの置換change、version=base+1、baseline必須 | multi-cursorを同一版の一操作として保持。順に別versionを発明してcommit数を増やさない |
| 確定送信 | text-commitはdocumentVersion null可、rangeなし、explicit-sendも可 | known editはrange/baselineとcanonical commitSerialを要求 | 明示送信を文書diffへ偽装しない。独立した素材streamにするか、本人の送信だけを扱う限定契約を別に定義する |
| 順序・重複 | eventId/session/operation/revision、sequenceは0以上 | source別seqは1以上、focus内commitSerialは連続 | 正当な同文字二回と同操作echoを分ける。独立OS経路の対応serialをreducerが推測したとは扱わない |
| 上限 | 8KiB/batch、候補512grapheme/5秒、queue64、ID長64 | event256 UTF-16 units、doc512 units、preview64 units、body256 graphemes、pending512、ID長32 | code point/UTF-16/UTF-8/graphemeを明記して共通上限を固定。縮小・分割・保留を黙って成功にしない |
| 表示文字 | 文書offsetは原UTF-16のまま、字形化時にgrapheme | 原sequenceを正規化せず保存、挿入batch単位で分節 | 現MatterのNFC表示用分節・空白等除外・repeatと、原文/履歴IDの対応を別に検査する |

参照: [schema](../../research/ambient-input-platforms-v1/event-schema.json)、[設計説明](../../research/ambient-input-platforms-v1/EVENT-DESIGN.md)、[型](../ambient-input-contract-v1/contract.d.ts)、[reducer](../ambient-input-contract-v1/reducer.mjs)、[現在の字形化](../../prototypes/glyph-creature/src/model.ts)。schemaの構造検査28 cases/35 eventsとreducerの28 fixtures/51 mode runsは、件数が似ていても同じ入力や適合試験ではない。

**VS Codeのexact diffはIME確定ではない。** platformの`document-only`と、reducerの`documentDiff:true, committedText:false`は一致した保留境界を持つ。typing/paste/completionというreason、自称quality、一定時間の静穏から確定へ昇格しない。初期whole-document snapshotを素材としないことと、全文を一時mirrorすることも別である。既存全文を読み込まない初期経路へbaseline必須reducerを繋ぐ場合は、そのscopeを具体化する必要がある。

**trust/capabilityはOS認証ではない。** 宣言したsourceの能力とexposureを信頼する人工契約は、実OSでそのsourceが真正であること、secure fieldを必ず見分けられること、入力を取得する前に除外されることを証明していない。現reducerはそれを実装したと称していない。将来のIPC/adapterの接続許可と、確定証拠の来歴は別の検証対象になる。

## 保存・履歴・文字同一性

保存offの意味は、「生の原文ファイルだけを作らない」より広い。文字のbody、候補、queue、mirror、復元可能なID列もdiskへ残さない。人工serializer（reducer281行以降）はoff時にmode/retention/metricsだけを出し、bodyとnextGlyphIdを出さない。activity-onlyは本文処理に入る前に分岐する。payload getterを読まない人工probeはこの処理内の性質を支持するが、upstreamが本文を既に取得していないことまでは支持しない。

一方、現[saveWidget](../../prototypes/glyph-creature/src/widget-state.ts)11–16行はraw batchをlocalStorageへ保存し、[widget-main](../../prototypes/glyph-creature/src/widget-main.ts)は送信、非表示、pagehide等で呼び出す。これは本人が専用欄へ送る既存版の保存仕様であり、資料との矛盾や現ambient漏洩を示すものではない。**将来ambientのsaving-offをその既存APIで保証したとは言えない。** restore対象、diagnostic、atlas/cache、出力原票も含め、文字を残す経路を明示して分離する必要がある。個人本文を人工harnessへ入れてはいけない。harnessのfinalBody/finalDocumentは再現用の合成文字を含む。

appendとdocument-syncの違いは作者の選択を待つ作品仕様で、片方をAPIの唯一の正解にしない。

| 問題 | 既存人工処理の結果 | 保持すべき説明 |
| --- | --- | --- |
| undo/redo | appendは古い身体を残し、undo/redoから再追加しない。syncは確認した文書の新版へ合わせる | 削除した文字が身体に残る選好は未決。undoは新規創作量と数えない |
| commitを跨ぐ結合文字 | base letterの後に別commitのcombining markを追加すると、appendは履歴unit2、syncは全体grapheme1 | 原sequenceが同じでもunit・色・IDは異なる。rendererでの一文字表示や完全同一性は未検証 |
| 既存本文 | baseline自体はbody0。syncで後のwhole revisionがknownになると既存本文も素材化 | appendの「接続後に新しく確定した挿入」より広い。初期全文取込を採用したとはしない |
| 中央のID | prefix/suffix照合で両端を一緒に変更すると、未変更中央にも新ID・色が付く | 完全な文書同一性追跡ではない。保留中の比較方式として開示済み |
| 古いsync候補 | 新baseline、不明revision、composition、gap、capacityで未表示snapshot取消。drain時にも版/epochを検査 | 最後のknown bodyを表示する場合は現在文書との同期をfalseとする |

これらは[CONTRACT](../ambient-input-contract-v1/CONTRACT.md)35–39行と[REPORT](../ambient-input-contract-v1/REPORT.md)で具体的に開示され、該当人工fixtureがある。appendの受理済み旧epoch materialがfocus後にdrainされることも明記されている。focus/secure化で未確定候補を消すことと、以前許可された歴史を消すことは別である。

## finite queueは全入力の無損失を保証しない

no-ACKはproducerが最大一件を保持し、同じseq/version/serialのeventをretryする契約である。reducerは拒否payloadを保持せず、実typingを停止するものではない。新しい同source eventを送り続ける非協調producerの人工probeでは、high-waterが進み旧retryが拒否され、失った文字を回復できなかった。これは制限の確認で、OS全体の無損失backpressureの成功ではない。

恒久的body容量・単一job超過はACK付きholdで、部分文字を黙って成功にしない。doc-syncは最新stable snapshotへまとめるので中間の身体表示を飛ばし得る。syncの最後のreconcileは有限全体を一度に扱い、logical pacing countを厳密な1tick CPU予算と呼ばない。ここも既存contract/reportは正しく分けている。

将来の接続条件は、協調ACK/replayを持つ限定adapter、または本人の明示送信である。欠落を回復できない経路ではactivity/previewに留め、素材の完全性を保証しない。「全入力」は目指す使用像として残しつつ、対象アプリ・取得できる信号・除外・容量hold・gapの発生範囲を別に表示する。

## 命令・ambient・研究の母数

全入力が素材になることと、すべてに形変更の命令意図があることは別である。[主protocol](../../research/widget-study-protocol-v1/PROTOCOL.md)38–51行は明示モードを選んだ時だけ要求判定し、日常文には一意の正解形を強制しない。この分離は用途と一致する。60秒窓、連続一致、120秒保持は未実証の候補値で、fixtureへ合わせた達成基準ではない。

現在[widget-main](../../prototypes/glyph-creature/src/widget-main.ts)107–168行は、解釈をawaitした後にMatter.addする。holdの通常完走では素材を加えられるが、解釈例外時は入力欄を保持し、身体への追加は行わない。protocolの「即時」「hold・例外でも一度だけ材料として残る」は将来満たす条件であり、現アプリの全経路の実績ではない。将来は文字追加と意味処理の寿命を分け、取消/古い返答でもbodyの一回追加を失わない処理が必要になる。

| 評価 | 分母・範囲 | そこから主張できないこと |
| --- | --- | --- |
| 主RQの将来比較 | sphere/box/tube/ring/blade/vaseの一つかhold。日本語の明示要求 | 60形全体、二部位＋関係、未知語一般理解、ambient内容理解 |
| 現tinyのfresh120 | 凍結した有限Program・guardの合成要求/保留/曖昧。実query重複も別監査 | 主RQ用の新しい6単体データと同じ実験、純粋なML寄与、human utility |
| staticのfresh140 | 60 enumの80要求、40保留、20曖昧。6primitive相当の27要求は別部分集合 | 60と6の分母混合、accepted-positiveだけを総合精度と呼ぶこと |
| 人間試遊の提案 | 6参加者の短い形成的試遊、別の5作業日案 | 6形というlabel数との混同、一般好み・生産性改善、継続的習慣の実証 |
| 描画/資源 | 共通に実装された3形・通常窓とoffscreenを別記録 | 60形/骨格全移植、実IME互換、快適性、一般PCの予算達成 |

現120/140を見た後の変更は回帰にし、新しい最終未見は語彙・paraphrase・template等の群から別に凍結する。副RQの資源・連続性も意味正解率に混ぜない。現在のprotocolはこれを明記している。主RQはユーザーの使用像を支える明示機能の限定研究で、使用像全体への回答と称さない。

## 証拠の照合と公開時の注意

canonical [summary](../ambient-input-contract-v1/results-final-v2/summary.json)は人工28 fixtures/51 mode runs、10 probes、406 fixture calls、7 targeted mutations、通常失敗0を報告する。4,750 assertionsや20,000 activity eventsを独立利用者・独立文章数とは数えない。これは作者が手で置いた期待値を同じ人工実装へ適用した検査で、人間注釈やplatform適合を検証しない。

このレビューでsummaryに保存されたreducer/fixtures/type/CONTRACT/runnerの5 SHAは現sourceと全一致した。canonical原票のPROVENANCE参照も一致した。**03:38時点では、PROVENANCEのREADME/REPORT SHAだけが現文書と不一致**だった。読取中の端末固有path除去後の文書変更と整合するが、理由は推測である。コード証拠の不一致ではない。rootへ場所を伝え、共有文書は変更しない。参照SHAは[REFERENCES.json](REFERENCES.json)、最後の照合時点と差は[REVIEW_CHECKS.json](REVIEW_CHECKS.json)に記す。これらは読取スナップショットで、Git全体の凍結や将来の同一性を保証しない。

公開予定資料への限られたlocation-only scanは、root3文書とplatform/contract/protocol/HCIの4 folderを対象にhome path、email、典型credential markerを探した。最終件数・場所だけをCHECKSに保存し、個人情報の内容を転載しない。これは完全なPII/secret auditではなく、repo全体やbinary/cacheを検査した主張ではない。

## rootへ返す改善案

1. 次に接続する前に、上表の変換仕様を一つのversion付き資料へ固定する。explicit-send、multi-edit、policy失効、gap、canonical serial、上限単位を落とさない。
2. ambientの保存offと素材一回追加を独立した受入条件にする。現保存/解釈先行の経路がそのまま条件を満たすと称さない。原文と表示用NFC字形の対応も検証する。
3. 文書同期は既存本文と中央IDの制限を保留理由として残す。appendのundo/cross-commit字形は選好とrenderer検査を終えるまで製品仕様と確定しない。
4. READMEの入口では「専用欄は実装、他アプリ本文は未接続、全入力素材は使用像」と短く分ける。保存表にもvolatile条件へリンクし、現在の本文保存版との混同を防ぐ。
5. schedulerは完成後に別の版・別のreview対象とする。今回のレビュー完了を待たせず、合成eventの処理結果を実OS入力・human comfortへ拡張しない。

以上はrootへ提案済み。既定モデルの採用見送り、作者の60形、黒い3D文字表面、旧版保存を尊重する。編集所有はこの新しいreview folderだけで、ここ以外に変更は加えていない。
