import { readBody } from '../../../experiments/ambient-integration-contract-v1/body-view.mjs';
export const CACHE_VERSION = 'ambient.cache.transport.v1';
const opaque = /^[A-Za-z0-9_-]{1,64}$/;
const integer = n => Number.isSafeInteger(n) && n >= 0;

// No body/ID ownership here. Every transferred glyph view comes from readBody.
export function createCacheTransport(state, receiverSession, aggregate) {
  if (!opaque.test(receiverSession ?? '') || !state.savingOff) throw new Error('off receiver session required');
  function metadata() {
    const bodyCount = state.material.body.length, nextId = state.material.nextId, presentedCount = state.material.presented;
    if (!integer(bodyCount) || bodyCount > 256 || nextId !== bodyCount + 1 || !integer(presentedCount) || presentedCount > bodyCount) throw new Error('immutable append receiver required');
    return { cacheVersion: CACHE_VERSION, receiverSession, materialGeneration: nextId - 1, nextId, bodyCount, presentedCount,
      shape: state.shape.current, aggregate: aggregate() };
  }
  function delta(request) {
    const meta = metadata();
    if (!request || request.cacheVersion !== CACHE_VERSION || request.receiverSession !== receiverSession || request.materialGeneration !== meta.materialGeneration ||
      !integer(request.afterId) || request.afterId > meta.bodyCount) throw new Error('current delta request required');
    const units = [];
    for (const unit of readBody(state)) if (unit.id > request.afterId) units.push(unit);
    return { cacheVersion: CACHE_VERSION, receiverSession, materialGeneration: meta.materialGeneration, nextId: meta.nextId,
      bodyCount: meta.bodyCount, afterId: request.afterId, units };
  }
  return Object.freeze({ metadata, delta });
}
