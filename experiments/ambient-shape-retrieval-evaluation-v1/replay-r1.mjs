/** Saved first-result arithmetic reproduction only; never invokes the candidate. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {score} from './score.mjs';
const p=import.meta.dirname;
const read=n=>JSON.parse(fs.readFileSync(path.join(p,n),'utf8'));
const cases=read('FIXTURES-R1.json').cases,result=read('RESULTS-R1.json'),saved=read('SUMMARY-R1.json');
const freeze=read('FREEZE-R1.json');
for(const [name,expected]of Object.entries(freeze.files)){
 const b=fs.readFileSync(path.join(p,name));assert.equal(b.length,expected.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),expected.sha256);
}
const rows=[];
for(const mode of result.modes){
 const actual=score(cases,result.output[mode]);assert.deepEqual(actual.groups,saved.summaries[mode].groups);assert.deepEqual(actual.details,saved.summaries[mode].details);
 rows.push({mode,positiveHit:actual.groups.positive.hit,positiveTotal:60,positiveAccepted:actual.groups.positive.accepted,noShapeFalsePositive:actual.groups.no_shape.falsePositive,noShapeTotal:40,unresolvedHold:actual.groups.unresolved.hit,unresolvedTotal:20});
}
console.log(JSON.stringify({version:'saved-output-replay-r1',candidateCalls:0,comparedModes:rows.length,mismatches:0,rows},null,2));
