# Widget atlas + frozen small classifier comparison

This candidate adds an optional frozen classifier to the small widget. The default
still uses the authored 60-shape vocabulary. It does not replace the earlier
widget, train new weights, generate arbitrary meshes, or demonstrate general
language understanding.

## Integration

- Widget only: `dynamicAtlas: true`. Classic pages retain the fixed-atlas default.
- HELP → **小型分類器（実験）** dynamically imports `widget-student-guard-v2` and
  the existing frozen classifier. Selection/input causes the local module load;
  the default path does not load this asset. This option uses no Transformer,
  additional Worker, or external service.
- The classifier offers sphere, box, tube, blade, ring and vase, at most two
  parts and one `end` / `above` / `through` relation. Explicit rules still handle
  negation, noun scope, ordering and dimensions. The HELP text says free-text
  success is limited and unsupported interpretations are held.
- Every guard hold retains the current authored shape **or** current finite
  Program. It adds the original input and its current-batch color without
  falling through to the authored 60-shape vocabulary. Colors on previous
  batches remain unchanged.
- Input is capped at 4,000 UTF-16 code units before model work. Original input,
  seed, accepted repetition count and color remain in the existing local save.
  The stored body limit remains 32,000 glyphs and the draw limit 1,536 glyphs.
- Provider changes, reset and visibility cancellation invalidate an outstanding
  import/inference result. A downloaded ES module can remain in the module
  cache; discarding its result is not a claim that JavaScript unloaded it.
- The existing **MiniLMを取得（初回約128MB）** button only starts the optional
  MiniLM Worker path. Cancel/switch terminates that Worker.

A UI regression exposed an existing default-provider problem: `表面 メビウスの輪`
was interpreted as a finite `ring` Program after the word `輪` matched. The
candidate gives an authored single shape priority when found; explicit two-part
relations still use a finite Program. Single descriptions without an authored
shape can continue through the existing finite baseline. This restores the
Möbius surface and retains jellyfish, bird, fish and snake rigs.

## Asset accounting and timings

The frozen JSON asset is **122,601 bytes**. The fully decoded primitive/relation
heads plus their known-feature bitsets are **91,136 bytes** (90,112 bytes of
Int16 weights and 1,024 bytes of bitsets). A single head may decode earlier than
the second. `tinyClassifier.decodedWeightBytes` reports the actual decoded
head total, while `frozenWeightBytes` reports the full frozen budget. Neither is
whole-app memory: JavaScript strings/objects, the WebGL atlas, browser, UI and
native host are additional. There is no native RAM or total CPU result for this
candidate yet.

`tinyClassifier.loaded`, decoded bytes and load time are separate from the
MiniLM Worker counters and native `modelLoaded` meaning. Resolution and timing
records retain the `tiny-student` source and separately expose `classifierMs`
and `guardMs`. Guard time includes cloning, rule handling, validation and
finite geometry compilation; it is not just regular-expression time. The
existing guard's `modelMs` is preserved; asset import is represented by
`loadMs` and the complete submit path by `interpretationMs`/`totalMs`.

The recorded headless integration run contains actual input-to-absorption
completion measurements, all under 30 seconds; exact values are in
`ui-regression-result.json`. The positive two-part input includes the decoded
heads and finite compile, while the module had already been selected/loaded.
These few deliberately targeted UI sequences do **not** estimate unseen text
accuracy or performance on a 16GB laptop. The existing `firstFrameMs` field is
an estimate from interpretation + construction, not a GPU completion timestamp.

## Reproduction and limitations

From the repository root:

```sh
node experiments/widget-atlas-student-v3/run-ui-regression.mjs
cd prototypes/glyph-creature
npx tsc --noEmit
npm test -- --reporter=dot
```

The standalone script starts its own Vite process on loopback port 4285, uses
installed Chrome through Playwright, renders real WebGL, blocks all external
requests and closes only its own browser/server. Its artificial UI sequences
were authored independently of the held-out language-evaluation fixtures.
They check default Möbius/creature surfaces, tiny two-part acceptance, holds on
both authored/finite geometry, body accumulation, colors, the input cap, local
reload, provider/import/reset races, MiniLM cancellation, pause/hidden queues,
32,000-glyph saves, Unicode originals, and no Worker/external request in the
tiny path. Frozen model/source hashes are checked before and after.

The hidden check dispatches the app's native lifecycle event and inspects its
scheduler queue. It does not show that the locked desktop UI or actual macOS
window hiding was operated. These runs also make no claim about real Japanese
IME interaction. MiniLM cancellation checks creation/termination without
running a full 128MB download or validating its output.

Preserved failures:

- `initial-default-failure.json`: product regression reproduced before the
  authored single-shape priority fix (Möbius became a ring Program).
- `initial-harness-port-failure.json`: the first harness mistakenly connected
  to an already occupied port. The script moved to its own port and now checks
  server exit before accepting readiness. This was not a product failure.
- `failure-*.json`: a later harness initially sent Enter while focus was still
  on the pause button; document Enter intentionally excludes buttons. The
  helper now focuses the scene before pressing Enter. This was not an app
  failure. That run had already passed its first 15 integration assertions.

No previous application bundle was overwritten, no source/threshold/weight
training changed, and no Git publication was performed by this subtask. The
root task owns version/storage changes, native packaging, verification and
publication.

Before publication, the root retained the original failure JSON files in its
ignored local folder and replaced machine-specific stack paths with `<repo>`
in the public copies. Error messages and failure evidence remain unchanged.

### Recorded run (2026-10-03 JST)

- **23 integration assertions passed**, no unhandled page exception and no
  external request in the recorded run. The tiny-only phase created zero
  Workers; explicit MiniLM preparation created then terminated one Worker.
- All **15 completed input/absorption measurements** were within 30 seconds;
  longest **3,950.5ms**. The two-part tiny example `棒の先端に球体` completed in
  **3,914.7ms**, with **1.30ms classifier / 6.00ms guard+compile**. The first
  deliberately unsupported input exercised initial primitive-head decode at
  **1.50ms classifier / 0.70ms guard**. Local module loading was **18.80ms**
  before these submissions.
- Both decoded heads were observed at **91,136B**, while Worker count remained
  zero. Full Unicode source and batch metadata survived reload at **32,000
  stored glyphs / 1,536 drawn glyphs**.
- Frozen JSON, classifier source and guard source SHA-256 stayed unchanged;
  the exact hashes are recorded in the result file.
- `npx tsc --noEmit` passed; existing unit suite **174 tests / 29 files passed**;
  `git diff --check` passed. No native bundle was rebuilt in this subtask.
