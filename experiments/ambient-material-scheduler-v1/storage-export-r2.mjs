// R2 storage candidate only. R1 scheduler/parameters/cases remain unchanged.
export function serializeStorageR2(state) {
  const inkCounts = { white: 0, blue: 0, green: 0, purple: 0 };
  for (const unit of state.body) inkCounts[unit.ink]++;
  const result = {
    version: 'ambient-material-scheduler-v1-r2-storage-regression',
    policy: state.policy, rawSavingOff: state.rawSavingOff,
    at: state.now, shape: state.shape, visible: state.visible, paused: state.paused,
    counts: { retainedUnits: state.body.length, retainedCodeUnits: state.metrics.retainedCodeUnits,
      presentedUnits: state.presented, pendingPresentation: state.body.length - state.presented, inkCounts },
    metrics: { ...state.metrics },
    changes: state.history.changes.map(({ at, from, to, delayMs }) => ({ at, from, to, delayMs })),
    analyses: state.history.analyses.map(({ at, reason, queryUnits, shape, matchCount }) => ({ at, reason, queryUnits, shape, matchCount })),
    candidateEvents: state.history.candidates.map(({ at, shape, samples, evidenceAt, expiresAt, cached, reason }) => {
      const item = { at, shape };
      if (samples !== undefined) item.samples = samples;
      if (evidenceAt !== undefined) item.evidenceAt = evidenceAt;
      if (expiresAt !== undefined) item.expiresAt = expiresAt;
      if (cached !== undefined) item.cached = cached;
      if (reason !== undefined) item.reason = reason;
      return item;
    }),
  };
  if (!state.rawSavingOff) result.body = state.body.map(({ id, text, ink }) => ({ id, text, ink }));
  return result;
}
