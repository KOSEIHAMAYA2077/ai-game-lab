// Synthetic writing streams and manually fixed expected mechanism outcomes.
// No reducer/model/widget imports, real text or intent labels.
const M = (word, batch, hysteresis) => ({ 'per-word': word, batch, 'batch-hysteresis': hysteresis });
const focus = (at = 0, context = 'docA') => ({ at, kind: 'focus', context });
const material = (at, text, ink = 'white', extra = {}) => ({ at, kind: 'material', quality: 'known', text, ink, ...extra });
const visibility = (at, value) => ({ at, kind: 'visibility', value });
const pause = (at, value) => ({ at, kind: 'pause', value });

export const streams = [
  {
    id: 'alternating-nouns', purpose: 'Same frequent lexical alternation; compare state-change dispatch, not intent accuracy.', horizon: 14000,
    events: [focus(), ...Array.from({ length: 12 }, (_, i) => material(i * 500, i % 2 ? 'ring ' : 'box ', i % 2 ? 'green' : 'blue'))],
    expected: { text: 'box ring box ring box ring box ring box ring box ring ', changes: M(12, 2, 1),
      finalShape: 'ring', analysisCalls: M(12, 3, 3), reflectionMax: M(0, 500, 2500), capacityRejectedUnits: 0 },
  },
  {
    id: 'quoted-shape-names', purpose: 'Quotes are ordinary literal material; rule search can change shape from a mentioned noun.', horizon: 12000,
    events: [focus(), material(0, '詩に「球」と書いた。', 'blue'), material(1000, '文中の『箱』という語を引用する。', 'green'),
      material(3000, '引用を閉じ、『輪』を眺める。', 'purple')],
    expected: { text: '詩に「球」と書いた。文中の『箱』という語を引用する。引用を閉じ、『輪』を眺める。', changes: M(2, 2, 1),
      finalShape: 'ring', reflectionMax: M(0, 1000, 3000), capacityRejectedUnits: 0 },
  },
  {
    id: 'burst-paste', purpose: 'Material admission is immediate; one paste can create many naive lexical changes at one artificial timestamp.', horizon: 10000,
    events: [focus(), material(0, 'box ring cube sphere ring ', 'purple')],
    expected: { text: 'box ring cube sphere ring ', changes: M(5, 1, 1), analysisCalls: M(5, 1, 1),
      cachedSamples: M(0, 0, 1), reflectionMax: M(0, 2000, 5000), finalShape: 'ring' },
    checks: [{ at: 0, expected: { retainedText: 'box ring cube sphere ring ', presentedCount: 0 } },
      { at: 100, expected: { presentedCount: 4 } }],
  },
  {
    id: 'japanese-emoji-color', purpose: 'Original Japanese, ZWJ emoji and combining units keep IDs and batch ink across scheduler policies.', horizon: 10000,
    events: [focus(), material(0, '青い球👩‍💻é', 'blue'), material(500, '箱🙂', 'green'), material(1000, '輪🌸', 'purple')],
    expected: { text: '青い球👩‍💻é箱🙂輪🌸', units: 9, inks: ['blue', 'blue', 'blue', 'blue', 'blue', 'green', 'green', 'purple', 'purple'],
      finalShape: 'ring', changes: M(2, 1, 1), reflectionMax: M(0, 1000, 4000) },
  },
  {
    id: 'idle-no-parse-loop', purpose: 'One keyword followed by long idle does not keep calling the analyzer or refresh expiry.', horizon: 20000,
    events: [focus(), material(0, 'box ', 'blue')],
    expected: { text: 'box ', changes: 1, analysisCalls: 1, cachedSamples: M(0, 0, 1),
      reflectionMax: M(0, 2000, 5000), finalShape: 'box', recentCodeUnits: 0 },
  },
  {
    id: 'dirty-input-blocks-old-candidate', purpose: 'New unparsed input blocks an old candidate at its hold deadline; expiry is not refreshed by cached sampling.', horizon: 14000,
    events: [focus(), material(0, 'box ', 'blue'), material(4500, 'memo ', 'green')],
    expected: { text: 'box memo ', changes: M(1, 1, 0), finalShape: M('box', 'box', 'sphere'),
      analysisCalls: 2, cachedSamples: M(0, 0, 1), candidateExpiries: M(0, 0, 1) },
    checks: [{ at: 5000, expected: { shape: M('box', 'box', 'sphere') } }],
  },
  {
    id: 'focus-invalidates-context', purpose: 'Old pending candidate and stale epoch material do not enter the next document context.', horizon: 14000,
    events: [focus(), material(0, 'box ', 'blue'), focus(2500, 'docB'),
      material(2600, 'ring STALE_PRIVATE_MARKER', 'purple', { epoch: 1 }), material(2700, '球', 'green')],
    expected: { text: 'box 球', units: 5, changes: M(2, 2, 0), finalShape: 'sphere', staleEpoch: 1,
      absentExport: ['STALE_PRIVATE_MARKER'], capacityRejectedUnits: 0 },
  },
  {
    id: 'hide-aggregate-and-reopen', purpose: 'Hidden letters accumulate immediately within bounds; no hidden analysis/reveal, limited catchup after reopening.', horizon: 16000,
    events: [focus(), material(0, 'box ', 'blue'), visibility(1500, false),
      material(2000, '輪🙂', 'purple'), material(3000, '箱', 'green'), material(7900, 'ring 🌸', 'blue'), visibility(8000, true)],
    expected: { text: 'box 輪🙂箱ring 🌸', changes: M(2, 1, 1), finalShape: 'ring', analysisCalls: M(2, 1, 1),
      reflectionMax: M(2100, 2100, 4100), presentationQueuePeak: 9 },
    checks: [{ at: 7999, expected: { analysisCalls: M(1, 0, 0), presentedCount: 4, retainedText: 'box 輪🙂箱ring 🌸' } },
      { at: 8000, expected: { analysisCalls: M(1, 0, 0), presentedCount: 4 } },
      { at: 8100, expected: { presentedCount: 8 } }],
  },
  {
    id: 'hidden-expired-window', purpose: 'No stale interpretation on reopening long after the last hidden keyword.', horizon: 16000,
    events: [focus(), material(0, 'box ', 'blue'), visibility(2500, false), material(3000, 'ring ', 'green'), visibility(11000, true)],
    expected: { text: 'box ring ', changes: M(1, 1, 0), finalShape: M('box', 'box', 'sphere'),
      analysisCalls: M(2, 2, 2), recentCodeUnits: 0 },
    checks: [{ at: 10000, expected: { analysisCalls: 1, presentedCount: 4, shape: M('box', 'box', 'sphere') } }],
  },
  {
    id: 'pause-material-independent', purpose: 'Pause stops presentation/interpretation while the normalized material receiver keeps bounded logical admission.', horizon: 14000,
    events: [focus(), material(0, 'box ', 'blue'), pause(2500, true), material(3000, 'ring ', 'green'),
      material(4000, 'cube ', 'purple'), pause(4500, false)],
    expected: { text: 'box ring cube ', changes: 1, finalShape: 'box', analysisCalls: M(2, 2, 2),
      reflectionMax: M(0, 2000, 4500) },
    checks: [{ at: 4400, expected: { analysisCalls: 1, presentedCount: 4, retainedText: 'box ring cube ' } },
      { at: 4600, expected: { presentedCount: 8 } }],
  },
  {
    id: 'gap-disclosed', purpose: 'Missing seq resets lexical evidence, does not fabricate missing material or claim upstream losslessness.', horizon: 14000,
    events: [focus(), material(0, 'box ', 'blue'), material(2200, 'ring ', 'green', { seq: 4 })],
    expected: { text: 'box ring ', changes: M(2, 2, 1), finalShape: 'ring', streamGapCount: 1, missingSequences: 1,
      reflectionMax: M(0, 2000, 3800) },
  },
  {
    id: 'raw-saving-off', purpose: 'Volatile material is retained but exports contain no input text or text fingerprint.', horizon: 10000,
    events: [focus(), material(0, 'PRIVATE_LITERAL_👩‍💻箱', 'green')],
    expected: { text: 'PRIVATE_LITERAL_👩‍💻箱', finalShape: 'box', exportedBody: false,
      absentExport: ['PRIVATE_LITERAL_', '👩‍💻', '箱'], changes: 1 },
  },
  {
    id: 'explicit-saving-on', purpose: 'Explicit body saving exports committed body only; analyzer window/query text have no export fields.', horizon: 10000,
    config: { rawSavingOff: false }, events: [focus(), material(0, 'SAVED_LITERAL_🙂輪', 'purple')],
    expected: { text: 'SAVED_LITERAL_🙂輪', finalShape: 'ring', exportedBody: true, exportedText: 'SAVED_LITERAL_🙂輪', changes: 1 },
  },
  {
    id: 'capacity-hold-no-truncation', purpose: 'Intentional small downstream bound shows explicit refusal, with no invented upstream retry guarantee.', horizon: 10000,
    config: { bodyLimit: 8 }, events: [focus(), material(0, 'box ', 'blue'), material(500, 'ring ', 'purple'), material(1000, '球', 'green')],
    expected: { text: 'box 球', units: 5, receivedMaterialUnits: 10, capacityRejectedUnits: 5,
      changes: M(2, 0, 0), finalShape: 'sphere', analysisCalls: M(2, 1, 1) },
  },
  {
    id: 'exact-bound-large-burst', purpose: '256 retained material units, one analysis slot, metadata histories remain finite even for many literal changes.', horizon: 14000,
    events: [focus(), material(0, '箱 輪 '.repeat(64), 'green')],
    expected: { text: '箱 輪 '.repeat(64), units: 256, presentationQueuePeak: 256, changes: M(128, 1, 1),
      analysisCalls: M(128, 1, 1), finalShape: 'ring', capacityRejectedUnits: 0 },
  },
  {
    id: 'ascii-boundary-and-offset', purpose: 'ASCII folding preserves offsets in Unicode text; spring is not an English ring alias.', horizon: 12000,
    events: [focus(), material(0, 'İBOX🙂 spring ', 'blue'), material(3000, 'TORUS ', 'green')],
    expected: { text: 'İBOX🙂 spring TORUS ', finalShape: 'ring', changes: M(2, 2, 1), capacityRejectedUnits: 0 },
  },
  {
    id: 'duplicates-and-unknown-event', purpose: 'Normalized-source prerequisite and transport dedupe are explicit; rejected quality does not supply material.', horizon: 10000,
    events: [focus(), material(0, 'box ', 'blue', { seq: 2 }), material(100, 'box ', 'blue', { seq: 2 }),
      material(500, 'UNKNOWN_PRIVATE_RING', 'green', { quality: 'unknown', seq: 3 })],
    expected: { text: 'box ', changes: 1, finalShape: 'box', duplicateEvents: 1, invalidEvents: 1,
      absentExport: ['UNKNOWN_PRIVATE_RING'] },
  },
];
