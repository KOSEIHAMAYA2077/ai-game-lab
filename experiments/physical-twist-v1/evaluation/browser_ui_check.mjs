/** Normal UI operation against a frozen production preview. Synthetic text only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../../..');
const require=createRequire(path.join(root,'prototypes/glyph-creature/package.json'));
const {chromium}=require('@playwright/test');
const run=process.argv[2]??'browser-ui-physical-1',url=process.argv[3]??'http://127.0.0.1:4228/program.html';
const output=path.join(directory,`${run}.json`);if(fs.existsSync(output))throw Error('Refusing overwrite');
const files=['fixture.json','same-type-fixture.json','followup-fixture.json','color-metamorphic.json'];
const fixtures=files.map(file=>{const data=fs.readFileSync(path.join(directory,file)),sha=crypto.createHash('sha256').update(data).digest('hex');if(fs.readFileSync(path.join(directory,file.replace('.json','.sha256')),'utf8').split(/\s/)[0]!==sha)throw Error('Fixture modified');return{file,sha,cases:JSON.parse(data).cases};});
const dist=path.join(root,'prototypes/glyph-creature/dist');
function distributionHashes(){const files=fs.readdirSync(path.join(dist,'assets')).filter(f=>f.endsWith('.js')).concat(['../program.html']);return Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(dist,'assets',f))).digest('hex')]));}
const beforeHashes=distributionHashes();
const executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser=await chromium.launch({headless:true,...(fs.existsSync(executablePath)?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const requests=[],errors=[],rows=[];let phase='startup',cold,warm,stress;
context.on('request',request=>{const host=new URL(request.url()).hostname;if(!['127.0.0.1','localhost'].includes(host))requests.push({phase,host,method:request.method(),resourceType:request.resourceType()});});
page.on('pageerror',e=>errors.push(e.message));
const images=path.join(root,'.local/physical-twist-evaluation',run);fs.mkdirSync(images,{recursive:true});
async function openPage(){await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__PROGRAM_ART__);await page.keyboard.press('Enter');await page.locator('#guide summary').click();await page.locator('#repeat').selectOption('64');await page.locator('#provider').selectOption('browser');}
async function prepare(){const start=performance.now();await page.locator('#prepare-model').click();await page.waitForFunction(()=>!!window.__PROGRAM_ART__.inspect().browserModel,undefined,{timeout:90000});return{wallMs:performance.now()-start,model:await page.evaluate(()=>window.__PROGRAM_ART__.inspect().browserModel)};}
async function feed(item,fixture,{reset=true}={}){
 if(reset){const current=await page.evaluate(()=>window.__PROGRAM_ART__.inspect());if(current.timings.length||current.count>1){await page.locator('#reset').click();await page.keyboard.press('Enter');}}
 const before=await page.evaluate(()=>window.__PROGRAM_ART__.inspect());if(!before.terminalOpen)await page.keyboard.press('Enter');
 const began=performance.now();await page.locator('#text-input').fill(item.text);await page.locator('#text-input').press('Enter');
 await page.waitForFunction(previous=>window.__PROGRAM_ART__.inspect().timings.length>previous,before.timings.length,{timeout:35000});
 const after=await page.evaluate(()=>window.__PROGRAM_ART__.inspect());if(after.provider!=='browser')throw Error('Semantic model provider is not selected');
 const row={id:item.id,group:item.group,fixture,wallMs:performance.now()-began,output:after.resolution,error:null,timing:after.timings.at(-1),scene:after.scene,count:after.count,characters:after.characters,batches:after.batches.length,batchData:after.batches,previousBatchInksRetained:before.batches.every((b,i)=>after.batches[i]?.ink===b.ink),previousCharactersRetained:before.characters.every(v=>after.characters.includes(v)),previousBatchesRetained:after.batches.length===before.batches.length+1};
 rows.push(row);console.log(`${fixture}/${item.id}: ${row.output?.reason} ${row.timing?.totalMs.toFixed(0)} ms ${row.count} glyphs`);
 if(item.group==='single'||item.group==='white-history'||['end-tube-sphere-ja','through-box-ring-en','scope-thick-body-thin-neck','same-spheres-above-en','fresh-through-sphere-ring-ja'].includes(item.id)){
  await page.waitForTimeout(1200);await page.screenshot({path:path.join(images,`${item.id}.png`)});
 }
 return row;
}
try{
 await openPage();phase='cold-model-preparation';cold=await prepare();await page.locator('#guide summary').click();phase='interpretation-and-render';
 for(const fixture of fixtures)for(const item of fixture.cases)await feed(item,fixture.file);
 phase='history-sequence';await page.locator('#reset').click();await page.keyboard.press('Enter');
 for(const id of ['single-sphere','scope-thick-body-thin-neck','ordinary-ja'])await feed(fixtures[0].cases.find(c=>c.id===id),'history-sequence',{reset:false});
 phase='white-history';await page.locator('#reset').click();await page.keyboard.press('Enter');
 for(const item of [{id:'white-thin-tube-big-sphere',group:'white-history',text:'白い細い棒の先に大きな球'},{id:'blue-sphere-box-after-white',group:'white-history',text:'青い球の上に箱'}])await feed(item,'white-history',{reset:false});
 phase='warm-model-preparation';await openPage();warm=await prepare();await page.locator('#guide summary').click();
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});phase='synthetic-4x-throttle';stress=await feed(fixtures[0].cases.find(c=>c.id==='through-box-ring-en'),'synthetic-4x-throttle');await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
}finally{
 await browser.close();const afterHashes=distributionHashes();
 const report={runId:run,evaluationUse:'Regression/acceptance using previously evaluated synthetic fixtures; followup retains separate first CPU figures.',distributionHashes:beforeHashes,distributionUnchanged:JSON.stringify(beforeHashes)===JSON.stringify(afterHashes),fixtures:fixtures.map(({file,sha})=>({file,sha})),cold,warm,stress,rows,requests,errors,summary:{cases:rows.length,completedUnder10s:rows.filter(r=>r.timing?.totalMs<=10000).length,completedUnder30s:rows.filter(r=>r.timing?.totalMs<=30000).length,finiteFrames:rows.filter(r=>r.scene?.finite).length,inferenceExternalRequests:requests.filter(r=>!['startup','cold-model-preparation','warm-model-preparation'].includes(r.phase)).length},limitations:['M5 32GB host is not the requested 16GB laptop CPU/iGPU target.','4x CDP throttling is synthetic stress, not a hardware or RAM test.','firstFrameMs is the initial partially forming frame; totalMs includes the 3.95s absorption completion.','renderCpuP95Ms is CPU time spent in render(), not frame interval or GPU time.','fill/Enter does not verify real OS Japanese IME composition.','Model preparation/download are separately reported, not excluded silently from generation.','An unsupported geometry relation may turn a semantically correct Program into UI hold.'],screenshots:'.local/physical-twist-evaluation/'+run};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,cold,warm,errors,distributionUnchanged:report.distributionUnchanged},null,2));
}
