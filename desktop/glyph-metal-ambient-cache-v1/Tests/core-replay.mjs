import { createReceiver, receive, advanceTo, inspect, GRAMMAR } from '../../../experiments/ambient-integration-contract-v1/receiver-r3.mjs';
import { readBody } from '../../../experiments/ambient-integration-contract-v1/body-view.mjs';
import { createCacheTransport, CACHE_VERSION } from '../Sources/cache-transport.mjs';

// Separate artificial core producer replay; not a native/OS input API.
export function evaluateCore(fixtures) {
  const runs=[];
  for(const fixture of fixtures.cases) {
    const state=createReceiver({savingOff:true,bodyLimit:256,shapeMode:'inline'}), built=[], traces=[];
    let last={status:'ready',reason:'ready'}, afterId=0;
    const aggregate=()=>({version:'metal-ambient-v1-r1',savingOff:true,bodyCount:state.material.body.length,presentedCount:state.material.presented,shape:state.shape.current,
      status:last.status,reason:last.reason,pending:Boolean(state.pending),composing:Boolean(state.canonical.composition),paused:state.paused,visible:state.visible,now:state.now});
    const transport=createCacheTransport(state,fixture.id,aggregate);
    for(const step of fixture.events) {
      if(step.advance) {advanceTo(state,step.at);built.push(null);}
      else {
        const event=step.alias!==undefined?built[step.alias]:Object.freeze({grammar:GRAMMAR,source:step.source,session:'lab',seq:step.seq,kind:step.kind,
          observedAt:step.at,focusEpoch:step.kind==='focus'?state.focusEpoch+1:state.focusEpoch,policyEpoch:state.policyEpoch,evidence:step.evidence??'none',
          ...(step.op!==undefined?{serial:step.op,operationId:`e${state.focusEpoch}-p${state.policyEpoch}-c${step.op}`} : {}),
          data:Object.freeze({...step.data, ...(Array.isArray(step.data?.changes)?{changes:Object.freeze(step.data.changes.map(x=>Object.freeze({...x})))}:{})})});
        built.push(event);last=receive(state,event,step.at);advanceTo(state,step.at);
      }
      const meta=transport.metadata();
      const delta=meta.bodyCount>afterId?transport.delta({cacheVersion:CACHE_VERSION,receiverSession:fixture.id,materialGeneration:meta.materialGeneration,afterId}):null;
      afterId=meta.bodyCount;
      const full={aggregate:aggregate(),units:[...readBody(state)],presentedCount:state.material.presented,shape:state.shape.current};
      traces.push({at:step.at,full,metadata:meta,delta,decision:last});
    }
    const actual=inspect(state);
    const values={body:actual.body,inks:actual.inks,document:actual.document?.text??'',units:actual.units,gaps:actual.gaps,pendingSlots:actual.pendingSlots,focusEpoch:actual.focusEpoch};
    const failures=Object.entries(fixture.expected).filter(([key,value])=>JSON.stringify(values[key])!==JSON.stringify(value)).map(([key,value])=>({key,expected:value,actual:values[key]}));
    runs.push({id:fixture.id,passed:failures.length===0,failures,actual:values,traces});
  }
  return {runs,passed:runs.filter(x=>x.passed).length};
}
