# Future dedicated textarea boundary

This folder implements no UI. A future browser prototype can observe only its own dedicated textarea and render a read projection of the one material authority. It must use receiver grammar v1, not cast browser or existing widget events into an old reducer. It must not monitor other apps, clipboard contents, global keyboard input or permissions.

Imports below are relative to a future module colocated with this experiment. They demonstrate synthetic declarations only:

```js
import { createReceiver, receive, advanceTo, exportReceiver } from './receiver-r3.mjs';
import { readBody } from './body-view.mjs';
import { validateStorage } from './storage-gate.mjs';

const state = createReceiver(); // saving off by default; max256 historical units
const header = (source, seq, kind) => ({
  grammar: 'ambient.integration.v1', session: 'lab', source, seq, kind,
  focusEpoch: 1, policyEpoch: 0, observedAt: 0,
});
receive(state, {
  ...header('system', 1, 'focus'),
  data: { field: 'normal', documentId: 'editorA' },
}, 0);
receive(state, {
  ...header('editor', 1, 'baseline'),
  data: { documentId: 'editorA', version: 0, text: '' },
}, 0); // an existing baseline would still add no material
receive(state, {
  ...header('editor', 2, 'composition-start'), data: { compositionId: 'imeA' },
}, 0);
receive(state, {
  ...header('editor', 3, 'composition-update'),
  data: { compositionId: 'imeA', text: '輪' },
}, 0); // preview only; body is still empty
const ack = receive(state, {
  ...header('editor', 4, 'composition-final'),
  evidence: 'synthetic-commit', serial: 1, operationId: 'e1-p0-c1',
  data: {
    compositionId: 'imeA', documentId: 'editorA', baseVersion: 0, version: 1,
    reason: 'type', ink: 'blue',
    changes: [{ offset: 0, deleteCount: 0, text: '輪' }],
  },
}, 0);
// ack.added is1 immediately; interpretation has not been called yet.
for (const { id, text, ink } of readBody(state)) {
  // Future renderer projects these IDs; it never allocates another body.
}
advanceTo(state, 5000); // artificial demo clock; shape now ring
const value = exportReceiver(state);
if (!validateStorage(value).valid) throw new Error('storage contract rejected');
// value contains counts/shape/time/color histogram, no raw or ordered material.
```

`receive` mutates only the artificial state and returns `{at,status,reason,ack,added}`. `advanceTo` advances artificial deadlines. `readBody` yields immutable ephemeral `{id,text,ink}` projections; it stores no second body and allocates no ID. Rendering should retain the authority's IDs only in volatile UI state. The iterator is not an atomic concurrent snapshot; a future asynchronous renderer needs a revision boundary around one synchronous read. Implementation R3 preserves schema/version v1 and is separately identified by source SHA. Only a fixed activity-only source gap is isolated from document provenance; other source capabilities retain conservative gap handling.

A future editor producer must keep a stable document revision and an original UTF-16 base for one atomic multi-edit event. During its own `compositionstart/update`, only preedit preview is sent. On its own `compositionend`, it may declare one editor-local final operation, with the ordinary following input echo bound to the same operation identity. It must handle browsers whose input/composition ordering differs; this folder has not tested such behavior. A document API with no confirmation flag stays document-only regardless of quiet time. The own-editor declaration is not OS-wide or other-app IME confirmation, and is not an authentication mechanism.

Do not reconstruct a new commit by replacing the entire document if that would append unchanged text. Derive precise changes against the stable original revision; ambiguous ordering or unsupported producer behavior remains preview/activity. Normal input, paste/completion/replacement can declare accepted inserted material only under the same editor-local contract. Undo/redo/deletion update the mirror without removing historical material in this provisional append design. A document-sync body would require a separate explicit baseline-import and identity contract; it is not enabled here.

Show capacity failures explicitly. A permanent `ack=true,status="held",reason="body-capacity"` or `event-text-limit` adds zero units. A valid document mirror may advance while its material is held: it is an observation, not successful body synchronization. A temporary `ack=false` keeps canonical/material watermarks unchanged; a cooperative producer may retain exactly one frozen event and retry it, with original observedAt, after a handoff becomes available. Source/epoch interruptions or competing producers disclose unsupported/gap and require repair; do not advertise losslessness. Revealing old material does not free the append capacity.

The 256-unit cap supports a small entrance comparison, not unlimited writing. Shape interpretation remains the three lexical groups sphere/box/ring with batch/hysteresis. Quoted or negated words can still trigger it; it is not a command interpreter. No real editor, IME, renderer or comfort claim is established by the code example.
