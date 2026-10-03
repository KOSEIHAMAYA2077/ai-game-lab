# CPU bridge / cache API

`Sources/cache-runtime.mjs` の bundle namespace は `AmbientCacheReceiver`、export は `createSession(receiverSession)` だけです。receiverSession は 1–64 個の ASCII 英数字・`_`・`-`。実アプリは一回作った UUID を bind し、保存・export しません。セッションの factory は一つの純 R3 receiver を作り、body・ID・grapheme 分割・canonical document・ACK を R3 だけに所有させます。

返された API は `executeMetaJSON(commandJSON)`、`snapshotMetaJSON()`、`readBodyDeltaJSON(requestJSON)`、`aggregateJSON()`、`offExportJSON()`、`destroy()`。同期呼び出しを直列に使う契約です。スレッドを跨ぐ非同期競合の保証はありません。

Native command は旧 R5 と同じ `init / commit / observe / ink / mark-start / mark-update / mark-cancel / pause / visible / advance / checkpoint`。`at` は単調非減少の非負整数です。confirmed trace は専用 producer の宣言であり、実 OS の確定を証明しません。取消・unmark の条件、5 秒 preedit expiry、永久容量 hold、no-ACK unsupported の境界は旧版から改善していません。

```js
const owner = AmbientCacheReceiver.createSession('artificial_session_1');
const metadata = JSON.parse(owner.executeMetaJSON(JSON.stringify({op:'init', at:0, value:''})));
// nextId/bodyCount に変化があるときだけ、host の既受信 ID の続きへ問い合わせる。
const added = JSON.parse(owner.readBodyDeltaJSON(JSON.stringify({
  cacheVersion: metadata.cacheVersion,
  receiverSession: metadata.receiverSession,
  materialGeneration: metadata.materialGeneration,
  afterId: 0
})));
// offExportJSON は R3 の集計だけ。added の本文/ID/色順は保存しない。
```

metadata は `cacheVersion='ambient.cache.transport.v1' / receiverSession / materialGeneration / nextId / bodyCount / presentedCount / shape / aggregate`。唯一の append body では `materialGeneration=nextId-1=bodyCount`、`nextId=bodyCount+1` です。世代番号は本文 hash や OS 証拠ではありません。本文差分応答は metadata の identity に `afterId / units[{id,text,ink}]` を加えたものです。exact new contiguous ID range を要求し、古い ID の再転送・同一 generation の extra payload・欠けた delta を拒否します。

Swift の `AmbientReceiverBridge(bundleURL:receiverSession:)` の `send` / `current` は `AmbientCacheUpdate(metadata,delta?)` を返します。command ≤8192B、metadata ≤4096B、delta ≤524288B。`AmbientProjection.bindSession(session)` を空の host へ一回行い、`apply(update)` します。`glyphs / renderingUnits / bodyCount / shape` は R3 由来の volatile 描画 view。追加分だけ検証し、全 packet の検証後に append します。ID・文字・色を再生成する allocator はありません。`presentedCount` の増分だけ view に昇格し、出生時刻は素材の確定時刻ではなく **最初の表示観測時刻** です。

reset は旧 bridge を退役し、新 receiverSession/core と新 projection を作って明示 bind する操作です。未知 session や generation の回帰を自動 rebase しません。focus/document-only の変更では既存 append body を reset しません。通常アプリは一 session で、reset UI は追加していません。

不正 packet は host view を変える前に拒否します。ただし本文を転送しない tick では、外部から密かに core の過去 prefix を書き換える攻撃は検出できません。SHA 固定した R3 の immutable append 契約を前提にしています。Bridge と projection は別々に同じ packet を検証し、正常な同一 thread 経路で一致させています。bridge が応答を受理した後に独自 host cache を不正に改変して projection が拒否した場合、自動復旧・無損失 retry を主張しません。明示 reset が必要です。

`Tests` の BaselineBridge/BaselineProjection/BaselineInstances は immutable R5 に namespace・集計 counters を加えた比較専用で、製品経路へ入れません。`TEST_SESSIONS` は source test の WeakMap で、bundle の namespace export へ出していません。core3 の multiple source は純 R3 の人工イベントだけで、native の専用 editor API に OS/他 producer を追加するものではありません。
