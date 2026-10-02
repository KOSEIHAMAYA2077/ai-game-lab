import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const dist=path.join(root,'.local/widget-v3-release-source-r2/prototypes/glyph-creature/dist');
const require=createRequire(path.join(root,'prototypes/glyph-creature/package.json'));
const {chromium}=require('playwright');
const port=4291;
const log={review_target:'Coordinator-provided HEADc016661 and existing production dist; no Git command issued.',started_utc:new Date().toISOString(),dist_file_hashes:[],requests:[],external_requests:[],console_errors:[],page_errors:[],checks:[],snapshots:[],failures:[]};
const files=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else files.push(p);}}
walk(dist);
log.dist_file_hashes=files.map(p=>({path:path.relative(dist,p),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(dist,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));}catch{res.writeHead(400).end();return;}if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}try{const body=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(404).end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
log.server={port,bind:'127.0.0.1',owned:true};
let browser;
function check(name,passed,evidence){log.checks.push({name,passed,evidence});if(!passed)log.failures.push({name,evidence});}
function save(){fs.writeFileSync(path.join(here,'capture-review-r2-raw.json'),JSON.stringify(log,null,2)+'\n');}
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-networking','--disable-component-update','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:420,height:480},deviceScaleFactor:1});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port===String(port)){log.requests.push({url:route.request().url(),method:route.request().method()});return route.continue();}log.external_requests.push({url:route.request().url(),method:route.request().method()});return route.abort('blockedbyclient');});
  await context.addInitScript(()=>{if(!localStorage.getItem('glyph-widget-state-v1'))localStorage.setItem('glyph-widget-state-v1','review-old-v1-sentinel');if(!localStorage.getItem('glyph-widget-state-v2'))localStorage.setItem('glyph-widget-state-v2','review-old-v2-sentinel');});
  const page=await context.newPage();
  page.on('pageerror',e=>log.page_errors.push(e.message));page.on('console',m=>{if(m.type()==='error')log.console_errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${port}/widget.html`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.__WIDGET_ART__));
  const inspect=()=>page.evaluate(()=>window.__WIDGET_ART__.inspect());
  const storage=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
  const snap=async(name)=>{const result={name,inspect:await inspect(),storage:await storage()};log.snapshots.push(result);return result;};
  const open=async()=>{if(await page.locator('#terminal').isHidden()){await page.locator('#scene').focus();await page.keyboard.press('Enter');}await page.locator('#text-input').waitFor({state:'visible'});};
  const controls=async()=>{await open();if(!(await page.locator('#guide').evaluate(e=>e.open)))await page.locator('#guide > summary').click();};
  const submit=async(text)=>{await page.waitForFunction(()=>!window.__WIDGET_ART__.inspect().busy);await open();await page.locator('#text-input').fill(text);await page.locator('#text-input').press('Enter');await page.waitForFunction(()=>!window.__WIDGET_ART__.inspect().busy,{},{timeout:15000});return inspect();};
  const initial=await snap('initial');
  check('initial-default-rules-no-student-or-worker',initial.inspect.provider==='rules'&&!initial.inspect.tinyClassifier.loaded&&initial.inspect.worker.started===0,initial.inspect);
  check('dynamic-atlas-small-initial',initial.inspect.scene.atlas.dynamic&&initial.inspect.scene.atlas.rows===1,initial.inspect.scene.atlas);
  log.initial_requests=[...log.requests];
  check('no-student-asset-request-at-default',!log.initial_requests.some(r=>/widget-student|student-model/.test(r.url)),log.initial_requests);
  await controls();await page.locator('#repeat').selectOption('1');
  await page.locator('#repeat').selectOption('256');
  const final=await submit('青いメビウスの輪');
  await page.screenshot({path:path.join(here,'qa/r2-blue-mobius-dense.png')});
  await snap('final-dense-blue-mobius');
  log.final_screenshot='qa/r2-blue-mobius-dense.png';
  check('dense-default-mobius-real-webgl',final.spec.shape==='mobius'&&final.scene.program===null&&final.scene.drawn===1536&&final.scene.drawCalls>0&&final.scene.finite&&!final.tinyClassifier.loaded&&final.worker.started===0,{spec:final.spec,scene:final.scene,worker:final.worker,tiny:final.tinyClassifier});
  check('capture-no-external-or-page-error',log.external_requests.length===0&&log.page_errors.length===0,{external:log.external_requests,errors:log.page_errors});
  log.finished_utc=new Date().toISOString();
}catch(e){log.harness_error={message:e.message,stack:e.stack};save();throw e;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));log.cleanup={owned_browser_closed:true,owned_server_closed:true};save();}
console.log(JSON.stringify({checks:log.checks.map(c=>({name:c.name,passed:c.passed})),screenshot:log.final_screenshot}));
