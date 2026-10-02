# 最小 API と renderer への読み取り境界

入口は `adapter-r2.mjs` の `createAdapter` と `singleDiff`。既存 receiver R3 を読み取り参照し、新しい grammar の adapter 正規化境界を通す。旧 widget API への cast / 既定60形への接続はしない。

以下は専用ページの新しい textarea だけに接続する最小例。createAdapter はその欄の listener を自動登録するので、追加 listener から同じ event をもう一度 `handle` へ送らない。本文・ID の allocation は receiver だけで行う。

```js
import { createAdapter } from './adapter-r2.mjs';
const editor = document.querySelector('textarea');
const projection = document.querySelector('.projection');
const adapter = createAdapter({ element: editor, ink: 'blue' });
const nodes = new Map(); // ID -> DOM node only; body ownership is receiver.

function render() {
  const state = adapter.snapshot(); // aggregate only
  let seen = 0;
  for (const unit of adapter.readBody()) { // volatile readonly view
    if (seen++ >= state.presentedCount) break;
    if (nodes.has(unit.id)) continue;
    const node = document.createElement('span');
    node.dataset.materialId = String(unit.id);
    node.dataset.ink = unit.ink;
    node.textContent = unit.text;
    projection.append(node);
    nodes.set(unit.id, node);
  }
}
const timer = setInterval(() => {
  if (!document.hidden) {
    adapter.advance(Math.floor(performance.now()));
    render();
  }
}, 100);
document.addEventListener('visibilitychange', () => {
  adapter.setVisible(!document.hidden);
});
// Final teardown only; BFcache suspension should keep this same owner.
function detach() { clearInterval(timer); adapter.destroy(); }
const aggregateExport = () => adapter.exportState(); // saving off only
```

`handle(event)` は人工 harness 用にも公開。イベント target が自作欄に厳密一致する前に payload を読まない。beforeinput/input の trusted・非composing・同じ type・安定した原文 version・安全な選択範囲を照合する。paste / completion は自作欄の最終値から挿入差分を導出し、clipboardData / DataTransfer / getTargetRanges を読まない。undo / redo / delete は文書観測のみで過去の材料を追加し直さない。

composition は自作 editor の producer に限定した guard。start / update は preview、空の end は cancel。既知 end と実値の照合が成立した最終文字を一度だけ追加する。end が input に先行した場合は ended token の既知 final input を待つ。未知列は材料0。実イベントの `isTrusted` は OS全体のIMＥ認証ではなく、人工テストの true もUA証拠ではない。

`setInk` は white / blue / green / purple。beforeinput または compositionstart の時点で操作色を capture。`setAdmissionReady(false)` は人工 backpressure 用、`retry()` は一つの凍結 slot だけを再送する。pending 中の blur / 別値の割込みで unsupported になった後は通常 baseline では復旧しない。原文は自作欄に残り、追加が失われたことを status で示す。

`setVisible` / `setPaused` は receiver の限定解釈と表示反映を止める。新素材は bounded admission と独立。`shapeMode:'deferred'` の `shapeRequest` / `answerShape` は凍結 scheduler の人工 shape-token 接続だけで、実モデルを呼ばない。永久に返答しない token でも次の文字追加は待たない。

`destroy()` は terminal / idempotent。同一 module 内で同じ element を再構築できない。古い全 mutation callback は無作用、`shapeRequest()` は null。既存の body は readonly に参照できるが、IDを作り直した renderer 状態へコピーしない。必要な新しい比較接続は新しい element を明示作成する。

実DOMページでは render listener、interval、visibility / pagehide / pageshow を page 側が所有する。R2 pagehide の BFcache は同じ owner を hide し、pageshow で戻す。final unload は interval を止め destroy する。この配送は非UI unit試験では実証していない。
