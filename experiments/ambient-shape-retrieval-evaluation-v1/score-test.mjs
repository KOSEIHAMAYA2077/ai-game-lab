import assert from 'node:assert/strict';
import {score} from './score.mjs';
const c = (id,group,allowedShapes=[]) => ({id,group,allowedShapes,sourceKind:'synthetic-harness-only',language:'ja',expectedDecision:group==='positive'?'candidate':group==='no_shape'?'none':'hold'});
const cases=[c('p1','positive',['a','b']),c('p2','positive',['a']),c('p3','positive',['a']),c('n1','no_shape'),c('n2','no_shape'),c('u1','unresolved'),c('u2','unresolved')];
const results=[
 {id:'p1',acceptedShape:'b',rankedShapes:['b','c']},
 {id:'p2',acceptedShape:null,rankedShapes:['c','a']},
 {id:'p3',acceptedShape:'c',rankedShapes:['c','d','e','a']},
 {id:'n1',acceptedShape:null,rankedShapes:['a']},
 {id:'n2',acceptedShape:'a',rankedShapes:['a']},
 {id:'u1',acceptedShape:null,rankedShapes:null},
 {id:'u2',acceptedShape:'a',rankedShapes:null}
];
const s=score(cases,results);
assert.equal(s.groups.positive.total,3); assert.equal(s.groups.positive.hit,1);
assert.equal(s.groups.positive.abstained,1); assert.equal(s.groups.positive.wrongShape,1);
assert.equal(s.groups.positive.top3Available,3); assert.equal(s.groups.positive.top3Hit,2);
assert.equal(s.groups.no_shape.falsePositive,1); assert.equal(s.groups.no_shape.hit,1);
assert.equal(s.groups.unresolved.falsePositive,1); assert.equal(s.groups.unresolved.hit,1);
assert.equal(s.details[1].hit,false); assert.equal(s.details[1].top3Hit,true);
assert.throws(()=>score(cases,results.slice(1)),/length/);
assert.throws(()=>score(cases,[...results.slice(0,6),results[0]]),/duplicate/);
assert.throws(()=>score(cases,results.map((r,i)=>i? r : {...r,acceptedShape:undefined})),/contract/);
assert.throws(()=>score(cases,results.map((r,i)=>i? r : {...r,rankedShapes:[7]})),/contract/);
console.log(JSON.stringify({version:'scorer-only-synthetic-r1',assertions:16,passed:true,modelCalls:0,actualFixtureCasesRead:0}));
