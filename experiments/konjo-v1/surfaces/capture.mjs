import { chromium } from '../../../prototypes/glyph-creature/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourceHashes=()=>Object.fromEntries(['expanded-surfaces.ts','shape-catalog.ts','language.ts','shapes.ts','surface-frame.ts'].map(path=>[path,createHash('sha256').update(readFileSync(new URL(`../../../prototypes/glyph-creature/src/${path}`,import.meta.url))).digest('hex')]));
const before=sourceHashes();
const version=process.argv[2]??'v1',folder=new URL(`./${version}/`,import.meta.url).pathname;
mkdirSync(folder,{recursive:true});
let shapes=['cone','cylinder','capsule','pyramid','diamond','octahedron','heart','egg','droplet','moon','cloud','mushroom','leaf','apple','pear','pumpkin','shell','fish','bird','snake','turtle','spider','lotus','rose','sun','snowflake','gear','bolt','bottle','cup','teapot','umbrella','bell','lantern','crown','knot','wave','ribbon'];
if(process.argv[3])shapes=shapes.filter(shape=>process.argv[3].split(',').includes(shape));
const natural=process.argv[4]==='natural';
const names={teapot:'ティーポット',bird:'鳥',rose:'薔薇',knot:'結び目'};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:960,height:800},deviceScaleFactor:1});
const errors=[],requests=[],records=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});page.on('request',r=>requests.push(r.url()));
try{
for(const shape of shapes){
 await page.goto('http://127.0.0.1:4195/');await page.waitForFunction(()=>!!window.__GLYPH_ART__);await page.evaluate(()=>window.__GLYPH_ART__.reset(927));
 await page.keyboard.press('Enter');if(!await page.locator('#repeat').isVisible())await page.locator('#guide summary').click();await page.locator('#repeat').selectOption(natural?'64':'1');
 await page.locator('#text-input').fill(natural?`白い文字が${names[shape]??shape}の表面を流れる`:'白'+'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(160).slice(0,4094));await page.locator('#text-input').press('Enter');
 await page.locator('#choose-form').click();
 const button=page.locator(`#quick-forms [data-shape="${shape}"]`);
 await button.evaluate(el=>{let parent=el.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}});
 await button.click();
 await page.evaluate(()=>{window.__GLYPH_ART__.pause();for(let i=0;i<12;i++)window.__GLYPH_ART__.step(1000)});
 const state=await page.evaluate(()=>window.__GLYPH_ART__.inspect());
 if(state.spec.shape!==shape||!state.scene.finite)throw Error(`${shape} incorrect or nonfinite: ${state.spec.shape}`);
 await page.screenshot({path:`${folder}${shape}.png`});
 records.push({shape,count:state.count,finite:state.scene.finite,time:state.time});
}
const after=sourceHashes(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
writeFileSync(`${folder}results.json`,JSON.stringify({records,before,after,sourceStable,errors,externalRequests:requests.filter(url=>!url.startsWith('http://127.0.0.1:4195')&&!url.startsWith('data:')),naturalPhrase:natural,note:'Screenshots after 12 simulated seconds. UI clicks select each form.'},null,2));
if(!sourceStable)throw Error('Source changed during capture');
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({folder,shapes:records.length,errors:errors.length}));
}finally{await browser.close()}
