import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadModel,predict} from '../../../prototypes/glyph-creature/src/task-student-v1/inference.mjs';
import {predictRule} from '../rules-adapter.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const experiment=fileURLToPath(new URL('..',import.meta.url));
const repo=fileURLToPath(new URL('../../..',import.meta.url));
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const output=here+'predictions.jsonl';
if(existsSync(output))throw new Error('Refusing to rerun frozen holdout: predictions.jsonl already exists');
const freeze=json(experiment+'/FREEZE.json');
if(freeze.frozenBeforeIndependentEvaluation!==true)throw new Error('Missing candidate freeze declaration');
const checkFreeze=()=>{
  for(const [name,digest] of Object.entries(freeze.files))if(sha(experiment+'/'+name)!==digest)throw new Error('Changed frozen input: '+name);
  const m=json(here+'frozen-manifest.json');
  if(sha(here+m.datasetFile)!==m.sha256)throw new Error('Changed frozen evaluation expectation');
};
checkFreeze();
const data=readFileSync(here+'frozen-cases.jsonl','utf8').trimEnd().split('\n').map(JSON.parse);
if(data.length!==244)throw new Error('Expected 244 holdout cases');
const kinds=['rules','seed','bonsai4','bonsai8','static-seed','static-bonsai8'];
const records=[];
const timings={};
const started=new Date().toISOString();
const checkPrediction=(p,id)=>{
  if(!p||typeof p.shape!=='string'||!['short','neutral','long'].includes(p.length)||!['narrow','neutral','wide'].includes(p.width)||!['straight','curved'].includes(p.bend))throw new Error('Invalid prediction contract for '+id);
};
for(const kind of kinds){
  const start=performance.now();
  let outputs;
  if(kind.startsWith('static-')){
    const input=data.map(({id,text})=>JSON.stringify({id,text})).join('\n')+'\n';
    const p=spawnSync(repo+'/.local/static-japanese-v1/venv/bin/python',['-B',experiment+'/predict_static.py','--kind',kind],{input,encoding:'utf8',cwd:repo,maxBuffer:32*1024*1024,timeout:120000,env:{...process.env,OPENBLAS_NUM_THREADS:'1',TOKENIZERS_PARALLELISM:'false'}});
    if(p.status!==0)throw new Error('Static predictor failed '+kind+': '+p.stderr);
    outputs=p.stdout.trimEnd().split('\n').map(JSON.parse);
    if(outputs.length!==data.length||outputs.some((p,i)=>p.id!==data[i].id))throw new Error('Static reply identity/count mismatch');
  }else{
    const model=kind==='rules'?null:loadModel(json(experiment+'/artifacts/'+kind+'-model.json'));
    outputs=data.map(row=>kind==='rules'?predictRule(row.text):predict(model,row.text));
  }
  for(let i=0;i<data.length;i++){
    const row=data[i],prediction=outputs[i];checkPrediction(prediction,row.id);
    const shapeCorrect=row.expected.acceptedShapes.includes(prediction.shape);
    const attributes=Object.fromEntries(['length','width','bend'].map(key=>[key,prediction[key]===row.expected[key]]));
    records.push({method:kind,...row,prediction,shapeCorrect,attributeCorrect:attributes,jointCorrect:shapeCorrect&&Object.values(attributes).every(Boolean)});
  }
  timings[kind]={batchWallMs:performance.now()-start,cases:data.length};
  console.log(kind+' '+data.length+' replies recorded');
}
checkFreeze();
writeFileSync(output,records.map(row=>JSON.stringify(row)).join('\n')+'\n');
const relevantFiles={};
for(const rel of ['prototypes/glyph-creature/src/task-student-v1/inference.mjs','prototypes/glyph-creature/src/task-student-v1/rule-modifiers.mjs','prototypes/glyph-creature/src/language.ts','prototypes/glyph-creature/src/shape-catalog.ts','prototypes/glyph-creature/src/lexical.ts','experiments/bonsai-task-student-v1/rules-adapter.mjs','experiments/bonsai-task-student-v1/evaluation/run-once.mjs'])relevantFiles[rel]=sha(repo+'/'+rel);
const meta={startedAtUTC:started,finishedAtUTC:new Date().toISOString(),candidateFreezeSHA256:sha(experiment+'/FREEZE.json'),evaluationSHA256:sha(here+'frozen-cases.jsonl'),predictionsSHA256:sha(output),nodeVersion:process.version,methods:kinds,totalReplies:records.length,batchTimings:timings,relevantSourceSHA256:relevantFiles,candidateFreeze:freeze,staticEncoderPins:{revision:'95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3',tableSHA256:'65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201',tokenizerSHA256:'833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9',verifiedBy:'StaticFeatureEncoder validates files on startup'},scope:'One independent artificial evaluation pass. No model, gate, data or expectation edits. Persistent Python process per static candidate; one batch each. No latency warmup; timing is supplementary.'};
writeFileSync(here+'run-manifest.json',JSON.stringify(meta,null,2)+'\n');
console.log('All '+records.length+' replies saved; frozen model/data/case hashes unchanged.');
