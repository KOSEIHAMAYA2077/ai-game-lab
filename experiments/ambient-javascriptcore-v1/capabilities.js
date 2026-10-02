JSON.stringify({
  intl: typeof Intl, segmenter: typeof Intl !== 'undefined' ? typeof Intl.Segmenter : 'undefined',
  toReversed: typeof Array.prototype.toReversed, hasOwn: typeof Object.hasOwn,
  textEncoder: typeof TextEncoder, structuredClone: typeof structuredClone,
  fetch: typeof fetch, document: typeof document, window: typeof window, process: typeof process,
  require: typeof require, clipboard: typeof navigator !== 'undefined' ? typeof navigator.clipboard : 'undefined',
});
