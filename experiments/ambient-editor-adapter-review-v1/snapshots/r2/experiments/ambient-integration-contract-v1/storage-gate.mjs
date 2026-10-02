// Independent allowlist check of an export value, not of private test state.
const counters = ['received', 'addedUnits', 'admissions', 'permanentHolds', 'deferrals', 'gaps', 'documentGaps', 'serialGaps',
  'trustedRebases', 'invalidChanges', 'transportDuplicates', 'operationDuplicates', 'activityKeys', 'activityShortcuts',
  'queries', 'shapeChanges', 'cachedSamples', 'candidateExpiries', 'staleAnswers', 'acceptedAnswers', 'unsupportedModes',
  'queuePeak', 'pendingSlotPeak', 'hiddenWork', 'normalizedForwardGaps'];
const colors = ['white', 'blue', 'green', 'purple'];
const top = ['grammar', 'version', 'savingOff', 'seed', 'shape', 'now', 'count', 'presentedCount', 'inkCounts', 'counters'];
const exactKeys = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) &&
  Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const integer = (n, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= 0 && n <= max;
export function validateStorage(value) {
  const fail = reason => ({ valid: false, reason });
  if (typeof value?.savingOff !== 'boolean' || !exactKeys(value, value.savingOff ? top : [...top, 'body'])) return fail('top-allowlist');
  if (value.grammar !== 'ambient.integration.v1' || value.version !== 'ambient-integration-contract-v1-r1' ||
    !['sphere', 'box', 'ring'].includes(value.shape) || !integer(value.seed) || !integer(value.now) ||
    !integer(value.count, 256) || !integer(value.presentedCount, value.count)) return fail('fixed-scalars');
  if (!exactKeys(value.inkCounts, colors) || colors.some(c => !integer(value.inkCounts[c], 256)) ||
    colors.reduce((n, c) => n + value.inkCounts[c], 0) !== value.count) return fail('color-histogram');
  if (!exactKeys(value.counters, counters) || counters.some(k => !integer(value.counters[k], 1000000))) return fail('counter-allowlist');
  if (!value.savingOff) {
    if (!Array.isArray(value.body) || value.body.length !== value.count || value.body.some((r, i) =>
      !exactKeys(r, ['id', 'text', 'ink']) || r.id !== i + 1 || typeof r.text !== 'string' || !r.text.length || r.text.length > 256 || !colors.includes(r.ink))) return fail('bounded-opt-in-body');
  }
  return { valid: true, reason: value.savingOff ? 'aggregate-only' : 'explicit-artificial-opt-in-body' };
}
