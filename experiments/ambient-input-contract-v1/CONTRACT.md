# Ambient input contract v1 — artificial events only

This is an independent pure reducer proposal. It does not import, call, copy or modify the widget API. It implements no keyboard/clipboard/OS monitoring, app extension, accessibility reader, permission change, real-document collection, renderer or external transmission. Every example is manually authored synthetic text.

The provisional default is an append-only body. User preference about deleted/revised letters is pending; document synchronization remains a separately scored alternative, not a decided product behavior.

## Three separate facts

| Event evidence | Activity | Reversible preview | Permanent material |
|---|---|---|---|
| Raw key/shortcut count | Yes | No | Never |
| Exact document API diff, commit quality absent/unknown | Yes | Bounded current-document preview | Never infer IME confirmation |
| Explicit composition update from a capable source | Yes | Bounded composition preview | Never |
| Explicit commit boundary + capable source + canonical serial | Yes | Current document | Candidate for append |
| Known stable whole-document revision + capable source | Yes | Current document | Candidate for document-sync |
| Unknown source or unknown/secure field | Activity metadata only where available | No text | No text |

A document API such as the described VS Code route can supply accurate replacement ranges/text without a Japanese IME-confirmed flag. Its declaration is `documentDiff:true, committedText:false`. A `reason:'typing'`, `paste`, `completion`, elapsed silence, or claimed `quality:'known'` does not upgrade it. That source remains preview/activity only. A future adapter must independently establish commit provenance; this harness does not claim such an adapter exists.

Activity metrics count observed events by channel. `key` and `shortcut` remain separate from edit/composition observations; their sum is not asserted to equal distinct physical user actions when multiple sources describe the same operation.

## Identity and ordering

- Only constructor-declared opaque source IDs are accepted. All IDs are bounded ASCII tokens, never app names, paths or document content. Declarations are a trusted adapter assumption, not authenticated OS proof.
- `seq` is a monotonically increasing safe integer per source. Duplicate/older transport sequence is ignored. The finite fixed source registry retains high-water marks, rather than evicting a dedupe ledger and silently re-accepting old events.
- A control-source focus event advances an integer `epoch` by exactly one and supplies opaque app/field/document IDs and `normal`, `unknown`, or `secure` exposure. Late text from an earlier epoch is rejected. App switching cancels previews/composition; document-sync also cancels an old document's pending snapshot. Already accepted append material may finish draining with its old provenance.
- Document snapshots establish a bounded authoritative baseline, never typed material. An edit requires `baseVersion` equal to the current document version and `version=baseVersion+1`. Stale/out-of-order edits request a new snapshot and cannot mutate material. Ranges are UTF-16 offsets; splitting a surrogate pair is rejected. Combining/ZWJ graphemes are preserved without normalization.
- Known commits require a canonical `commitSerial` that advances by one within the focus epoch. Multiple signals for the same commit must share this serial. They are not deduplicated by text equality or timing: two legitimate identical insertions remain two commits. Shared serial/version provenance is an adapter contract, not something the reducer invents from independent OS streams.
- After a missing serial, an ordinary document snapshot cannot repair the commit watermark. A capable `committedText` source can explicitly supply `quality:'known', commitSerialBaseline:N` with a new authoritative snapshot. This rebases transport evidence only and contributes no material. An absent/unknown-quality baseline or a document-only source cannot upgrade confirmation. The trusted adapter must establish that baseline; silence and document contents cannot infer it.

## Composition and edit reasons

Composition begin/update/cancel uses a bounded composition ID on an explicitly capable source. Updates replace a reversible draft and never enter the body. A matching composition commit carries one authoritative final edit and explicit commit evidence. One canonical commit contributes final material once; document echoes and duplicate sequences cannot add it again.

Paste/completion/replacement are accepted as new insertion material only with known commit evidence. Delete contains no new material. For the provisional append proposal, undo/redo update document/preview/activity but do not delete old body letters or append them a second time. A fresh ordinary commit of the same text can append again. This undo/redo policy is an explicit provisional choice awaiting the user, not a claim that append-only history has a unique correct interpretation.

Document-sync uses a known **stable whole revision**. A known inserted segment alone is insufficient to promote unrelated provisional text in the rest of a document. A stable revision is reconciled as one bounded snapshot: exact unchanged prefix/suffix graphemes keep IDs/colors, removed graphemes disappear, changed/inserted graphemes receive fresh IDs and the new batch color. Removed IDs are never recycled. Unknown edits only preview even in this mode. Append segments each inserted batch independently: `e` followed by a separately committed combining acute keeps two historical material units, even though their concatenated text forms one visible grapheme. Document-sync segments the whole revision and treats the merged grapheme as a changed unit. Both preserve the original code-unit sequence; the harness does not validate a renderer's treatment of those units.

This whole-document alternative includes pre-existing baseline text once a capable source explicitly confirms the whole revision; the baseline snapshot itself still contributes zero material. That is a broader capture scope than append-only typing. It is demonstrated with artificial text, and is not adopted as a default ambient input route. Prefix/suffix matching is deliberately small and bounded: simultaneous changes at both ends can replace the identity/color of an unchanged middle grapheme. The harness preserves this limitation rather than claiming complete identity tracking. Unknown edits can leave an already displayed last stable body visible while a separate preview reflects the current document; synchronization is marked false. A new baseline, unconfirmed revision/composition, gap or capacity hold cancels any not-yet-displayed older snapshot. Draining checks its epoch/version/resynchronization status again before adoption.

## Bounds and backpressure

The artificial defaults are: 8 declared sources, 256 UTF-16 units per event text, 512 units in the document mirror, 64-unit preview, 256 body graphemes, 512 pending graphemes, 8 append jobs, and at most 8 drained append graphemes per tick. Document-sync has a logical pacing count and then an atomic bounded reconciliation of at most `maxBody` graphemes; this is not a strict per-tick CPU operation bound. Counters saturate at 1,000,000. These are test parameters, not measured product budgets.

Append jobs preserve accepted material and drain over ticks. When the finite pending queue is full, a known commit receives **no ACK** and leaves its document version, source sequence, canonical commit watermark, and body unchanged. The producer retains at most one bounded unacknowledged event and retries that same event after draining. Future events cannot be silently placed in an unlimited queue. Raw activity is a separate source and continues. This flow control requires a cooperative adapter; it cannot pause real typing, guarantee replay from every app, or recover lost OS events.

The reducer does not retain an unACKed payload. Its artificial producer enforces the one-slot retry contract. A deliberately non-cooperative producer test sends a newer same-source document event after refusal: the high-water mark then prevents retry of the older event and its text cannot be recovered. That adapter is explicitly unsupported for lossless append adoption; the test must not be represented as OS-wide backpressure working.

Permanent body capacity or a snapshot larger than the configured queue yields an explicit capacity hold, with no silent truncation. The bounded document mirror/preview can still advance and the decision discloses that the body is not synchronized. Oversized/malformed input is rejected without storing its payload. Document-sync coalesces pending stable snapshots to the newest one; it is not an append-history mode and may skip intermediate body presentations during a burst.

## Text retention

`retention:'activity-only'` suppresses all text before document/composition/material processing. Reducer state contains no captured text in that mode. Activity counters remain bounded; secure/unknown textual payloads are never inspected or echoed.

The text proposal can hold bounded ephemeral material and previews. Persistence defaults to `persistText:false`, which serializes mode/retention flags and counters and no document, draft, queue, or body text. Explicit `persistText:true` stores only the bounded committed body and its ID/color metadata; document mirrors and provisional drafts are never persisted. The harness trace also records metadata/decisions only. Synthetic fixture files contain artificial example text solely to make the experiment reproducible.

## Evaluation boundary

Tests must distinguish append material from current document text, known from unknown confirmation, active from stale context, duplicates from repeated legitimate text, and finite queue refusal from silent loss. Hardcoded expected outcomes and targeted mutation checks assess whether tests would catch those errors. Passing them establishes this artificial contract's behavior; it does not validate a platform adapter, real IME, application compatibility, privacy enforcement by an OS API, user comfort, or low whole-app resource use.
