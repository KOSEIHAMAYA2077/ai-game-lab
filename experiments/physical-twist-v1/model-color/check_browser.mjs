// Metamorphic runtime check of the actual public Worker, with the same head.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(resolve(process.cwd(),'package.json'));
const {chromium}=require('@playwright/test');
const folder=resolve(process.cwd(),'../../experiments/physical-twist-v1/model-color');
const data=JSON.parse(readFileSync(resolve(folder,'cases.json'),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage();
await page.goto('http://127.0.0.1:4222/program.html');
await page.waitForLoadState('networkidle');
const report=await page.evaluate(async(data)=>{
  const {loadProgramModel,resolveProgram}=await import('/src/scaffold-model-client.ts');
  const prepared=await loadProgramModel();
  const projection=program=>program?{parts:program.parts.map(part=>Object.fromEntries(['primitive','height','width','depth'].map(key=>[key,part[key]]))),relation:program.relation}:null;
  const baseline={};
  for(const template of data.templates)baseline[template.name]=await resolveProgram(template.base,new AbortController().signal);
  const rows=[];
  for(const item of data.cases){
    const result=await resolveProgram(item.text,new AbortController().signal);
    const base=baseline[item.template];
    const expected=result.program && JSON.stringify(result.program.parts.map(part=>part.primitive))===JSON.stringify(item.primitives) && result.program.relation.kind===item.relation;
    rows.push({...item,result,requiredStructureUnchanged:JSON.stringify(projection(result.program))===JSON.stringify(projection(base.program)),fullProgramUnchanged:JSON.stringify(result.program)===JSON.stringify(base.program),expectedAccepted:!!expected});
  }
  const observedFix=await resolveProgram('白い細い棒の先に大きな球',new AbortController().signal);
  return {label:'Metamorphic development/regression only; actual Worker; independent fixture untouched',provider:'wasm',prepared,count:rows.length,summary:Object.fromEntries(['requiredStructureUnchanged','fullProgramUnchanged','expectedAccepted'].map(key=>[key,rows.filter(row=>row[key]).length])),rows,observedFix};
},data);
await browser.close();
writeFileSync(resolve(folder,'metamorphic-wasm.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({count:report.count,summary:report.summary,observedFix:{program:report.observedFix.program,reason:report.observedFix.reason,modelMs:report.observedFix.modelMs},failures:report.rows.filter(row=>!row.expectedAccepted||!row.requiredStructureUnchanged).map(row=>({text:row.text,reason:row.result.reason}))}));
