import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createStaticEncoder,TABLE_SHA256,TOKENIZER_SHA256} from '../../../../prototypes/glyph-creature/src/task-student-v1/static-runtime/encoder.mjs';
import {loadDenseModel,predictDense} from '../../../../prototypes/glyph-creature/src/task-student-v1/dense-inference.mjs';

const here=fileURLToPath(new URL('.',import.meta.url));
const evaluation=fileURLToPath(new URL('..',import.meta.url));
const experiment=fileURLToPath(new URL('../..',import.meta.url));
const repo=fileURLToPath(new URL('../../../..',import.meta.url));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
if(existsSync(here+'predictions.jsonl'))throw new Error('Runtime parity replies already exist; refusing to overwrite or rerun');
const freeze=json(experiment+'/FREEZE.json');
const originalRun=json(evaluation+'/run-manifest.json');
const sourceFiles=['prototypes/glyph-creature/src/task-student-v1/static-runtime/encoder.mjs','prototypes/glyph-creature/src/task-student-v1/dense-inference.mjs','experiments/bonsai-task-student-v1/static-candidate/assets/tokenizer.json','experiments/bonsai-task-student-v1/static-candidate/assets/table-128-float16.bin','experiments/bonsai-task-student-v1/evaluation/runtime-parity/check.mjs'];
const snapshots=Object.fromEntries(sourceFiles.map(p=>[p,hash(repo+'/'+p)]));
function verify(){
  for(const [p,digest] of Object.entries(freeze.files))if(hash(experiment+'/'+p)!==digest)throw new Error('Frozen model/data drift: '+p);
  for(const [p,digest] of Object.entries(snapshots))if(hash(repo+'/'+p)!==digest)throw new Error('Runtime source/asset drift: '+p);
  if(hash(evaluation+'/frozen-cases.jsonl')!==originalRun.evaluationSHA256||hash(evaluation+'/predictions.jsonl')!==originalRun.predictionsSHA256)throw new Error('Recorded holdout drift');
}
verify();
const asset=experiment+'/static-candidate/assets/';
if(hash(asset+'tokenizer.json')!==TOKENIZER_SHA256||hash(asset+'table-128-float16.bin')!==TABLE_SHA256)throw new Error('Runtime asset pin mismatch');
const bytes=readFileSync(asset+'table-128-float16.bin');
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const encoder=createStaticEncoder(json(asset+'tokenizer.json'),buffer);
const cases=readFileSync(evaluation+'/frozen-cases.jsonl','utf8').trimEnd().split('\n').map(JSON.parse);
const original=readFileSync(evaluation+'/predictions.jsonl','utf8').trimEnd().split('\n').map(JSON.parse);
const methods=['static-seed','static-bonsai8'];
const details=[],summary={};
const started=new Date().toISOString();
for(const method of methods){
  const model=loadDenseModel(json(experiment+'/artifacts/'+method+'-model.json'));
  const python=Object.fromEntries(original.filter(r=>r.method===method).map(r=>[r.id,r]));
  if(Object.keys(python).length!==244||cases.length!==244)throw new Error('Expected fixed 244-case Python baseline');
  const result={cases:244,shapeEqual:0,holdDecisionEqual:0,holdCountPython:0,holdCountJS:0,lengthEqual:0,widthEqual:0,bendEqual:0,allLabelsEqual:0,reasonEqual:0,top3LabelsEqual:0,maxScoreAbsError:0,maxMarginAbsError:0,maxCoverageAbsError:0,maxTop3ScoreAbsError:0,mismatches:[]};
  for(const row of cases){
    const p=python[row.id];
    if(p.text!==row.text||JSON.stringify(p.expected)!==JSON.stringify(row.expected))throw new Error('Case mismatch '+row.id);
    const actual=predictDense(model,encoder,row.text),expected=p.prediction;
    const labels={};
    for(const key of ['shape','length','width','bend']){labels[key]=actual[key]===expected[key];result[key+'Equal']+=+labels[key];}
    const holdEqual=(actual.shape==='hold')===(expected.shape==='hold');
    result.holdDecisionEqual+=+holdEqual;result.holdCountPython+=+(expected.shape==='hold');result.holdCountJS+=+(actual.shape==='hold');
    const allEqual=Object.values(labels).every(Boolean);result.allLabelsEqual+=+allEqual;result.reasonEqual+=+(actual.reason===expected.reason);
    const errors={score:Math.abs(actual.score-expected.score),margin:Math.abs(actual.margin-expected.margin),coverage:Math.abs(actual.coverage-expected.coverage)};
    if(!Object.values(errors).every(Number.isFinite))throw new Error('Nonfinite comparison '+row.id);
    result.maxScoreAbsError=Math.max(result.maxScoreAbsError,errors.score);result.maxMarginAbsError=Math.max(result.maxMarginAbsError,errors.margin);result.maxCoverageAbsError=Math.max(result.maxCoverageAbsError,errors.coverage);
    const top3Same=JSON.stringify(actual.candidates.map(c=>c.label))===JSON.stringify(expected.candidates.map(c=>c.label));
    result.top3LabelsEqual+=+top3Same;
    const candidateErrors=actual.candidates.map((c,i)=>Math.abs(c.score-expected.candidates[i].score));
    result.maxTop3ScoreAbsError=Math.max(result.maxTop3ScoreAbsError,...candidateErrors);
    if(!allEqual||!holdEqual||!top3Same)result.mismatches.push(row.id);
    details.push({method,id:row.id,category:row.category,text:row.text,expected:row.expected,pythonPrediction:expected,jsPrediction:actual,labelEqual:labels,holdDecisionEqual:holdEqual,top3LabelsEqual:top3Same,numericAbsErrors:errors,top3ScoreAbsErrors:candidateErrors});
  }
  summary[method]=result;console.log(JSON.stringify({method,...result}));
}
verify();
const output=here+'predictions.jsonl';
writeFileSync(output,details.map(r=>JSON.stringify(r)).join('\n')+'\n');
const metadata={scope:'Runtime consistency using the same already-recorded AI-authored artificial holdout, not new semantic evaluation, new examples, tuning or candidate selection.',startedAtUTC:started,finishedAtUTC:new Date().toISOString(),nodeVersion:process.version,methods:summary,totalComparisons:details.length,encoder:encoder.inspect(),sourceSHA256:snapshots,candidateFreezeSHA256:hash(experiment+'/FREEZE.json'),originalPythonPredictionsSHA256:hash(evaluation+'/predictions.jsonl'),evaluationSHA256:hash(evaluation+'/frozen-cases.jsonl'),runtimePredictionsSHA256:hash(output),frozenModelDataSHA256:freeze.files,noExternalRequests:true,frozenInputsUnchangedBeforeAndAfter:true};
writeFileSync(here+'summary.json',JSON.stringify(metadata,null,2)+'\n');
