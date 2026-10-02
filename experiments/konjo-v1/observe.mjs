import {chromium} from '../../prototypes/glyph-creature/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const label=process.argv[2]??'observation-v1';if(!/^[a-z0-9-]+$/.test(label))throw Error('label');
const folder=new URL(`./${label}/`,import.meta.url);mkdirSync(folder,{recursive:false});
const sourceFiles=['language.ts','lexical.ts','association-graph.ts','shape-catalog.ts','expanded-surfaces.ts','scene.ts','main.ts','data/konjo-wordnet.json'];
const hash=()=>Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(new URL(`../../prototypes/glyph-creature/src/${f}`,import.meta.url))).digest('hex')]));
const before=hash(),records=[],errors=[],external=[];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4195\/|data:|blob:)/.test(r.url()))external.push(r.url())});
 for(const shape of ['teapot','knot','rose']){
  await page.goto('http://127.0.0.1:4195/');await page.waitForFunction(()=>window.__GLYPH_ART__);await page.keyboard.press('Enter');await page.locator('#guide summary').click();await page.locator('#repeat').selectOption('1');await page.locator('#text-input').fill('白'+'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(160).slice(0,4094));await page.locator('#text-input').press('Enter');await page.locator('#choose-form').click();const button=page.locator(`[data-shape="${shape}"]`);await button.evaluate(el=>el.closest('details').open=true);await button.click();
  const real=await page.evaluate(async()=>{const api=window.__GLYPH_ART__;for(let i=0;i<12;i++)api.step(1000);api.pause(false);for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);const stamps=[];for(let i=0;i<361;i++)stamps.push(await new Promise(requestAnimationFrame));const intervals=stamps.slice(1).map((v,i)=>v-stamps[i]),s=[...intervals].sort((a,b)=>a-b);return{intervals,medianMs:s[179],p95Ms:s[341],elapsedMs:stamps.at(-1)-stamps[0],glyphs:api.inspect().count,agent:navigator.userAgent}});
  await page.evaluate(()=>{const a=window.__GLYPH_ART__;a.pause();for(let i=0;i<60;i++)a.step(60000)});const later=await page.evaluate(()=>window.__GLYPH_ART__.inspect());if(!later.scene.finite||later.spec.shape!==shape)throw Error('long-time invalid');await page.screenshot({path:new URL(`${shape}-3600.png`,folder).pathname});records.push({shape,real,simulatedAfter:later.time,finite:later.scene.finite});
 }
 const after=hash();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Sources changed');
 writeFileSync(new URL('results.json',folder),JSON.stringify({completed:true,sourceBefore:before,sourceAfter:after,records,errors,external,note:'rAF intervals are short real-time observations on this Mac, separate from one-hour equivalent time advancement; no general-PC or long real-time guarantee.'},null,2));console.log(JSON.stringify(records.map(r=>({shape:r.shape,glyphs:r.real.glyphs,medianMs:r.real.medianMs,p95Ms:r.real.p95Ms,elapsedMs:r.real.elapsedMs,finite:r.finite}))));if(errors.length||external.length)throw Error('browser errors');
}finally{await browser.close()}
