/** Independent groupwise arithmetic; no model policy, threshold or text parsing. */
export function score(cases, results) {
  if (cases.length !== results.length) throw new Error('case-result-length');
  const byId = new Map();
  for (const result of results) {
    if (byId.has(result.id)) throw new Error('duplicate-result-id');
    if (result.acceptedShape !== null && typeof result.acceptedShape !== 'string') throw new Error('accepted-shape-contract');
    if (result.rankedShapes !== null && (!Array.isArray(result.rankedShapes) || result.rankedShapes.some(s => typeof s !== 'string'))) throw new Error('ranked-shape-contract');
    byId.set(result.id, result);
  }
  const groups = {};
  const details = [];
  for (const c of cases) {
    const r = byId.get(c.id);
    if (!r) throw new Error('missing-result-id');
    const accepted = r.acceptedShape !== null;
    const isPositive = c.group === 'positive';
    if (!['positive','no_shape','unresolved'].includes(c.group)) throw new Error('group-contract');
    const ok = isPositive ? accepted && c.allowedShapes.includes(r.acceptedShape) : !accepted;
    const top3Available = r.rankedShapes !== null;
    const top3Hit = isPositive && top3Available ? r.rankedShapes.slice(0,3).some(s => c.allowedShapes.includes(s)) : null;
    const group = groups[c.group] ??= {total:0,accepted:0,hit:0,abstained:0,falsePositive:0,wrongShape:0,top3Available:0,top3Hit:0,sourceKinds:{},languages:{}};
    const kind = group.sourceKinds[c.sourceKind] ??= {total:0,accepted:0,hit:0,falsePositive:0,abstained:0,wrongShape:0};
    const lang = group.languages[c.language] ??= {total:0,accepted:0,hit:0,falsePositive:0,abstained:0,wrongShape:0};
    for (const bucket of [group,kind,lang]) {
      bucket.total++;
      bucket.accepted += Number(accepted);
      bucket.hit += Number(ok);
      bucket.abstained += Number(!accepted);
      bucket.falsePositive += Number(!isPositive && accepted);
      bucket.wrongShape += Number(isPositive && accepted && !ok);
    }
    group.top3Available += Number(isPositive && top3Available);
    group.top3Hit += Number(top3Hit === true);
    details.push({id:c.id,group:c.group,sourceKind:c.sourceKind,acceptedShape:r.acceptedShape,expectedDecision:c.expectedDecision,allowedShapes:c.allowedShapes,hit:ok,top3Hit});
  }
  return {version:'independent-groupwise-r1',groups,details};
}
