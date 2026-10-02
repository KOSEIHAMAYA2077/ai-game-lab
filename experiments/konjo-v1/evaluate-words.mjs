import {chromium} from '../../prototypes/glyph-creature/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const label=process.argv[2]??'round1'; if(!/^[a-z0-9-]+$/.test(label))throw Error('label');
const out=new URL(`./lexicon/${label}/`,import.meta.url);mkdirSync(out,{recursive:false});
const cases=JSON.parse(readFileSync(new URL('./lexicon/evaluation-examples.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:4195/');await page.waitForFunction(()=>window.__GLYPH_ART__);
const result=await page.evaluate(examples=>examples.map(example=>{const candidates=window.__GLYPH_ART__.vocabulary(example.text).candidates;const shapes=candidates.map(c=>c.shape);const pass=example.expectedShapes===null?null:example.expectedShapes.length?example.expectedShapes.some(s=>shapes.includes(s)):shapes.length===0;return{...example,candidates,pass}}),cases.examples);
const scored=result.filter(r=>r.pass!==null);writeFileSync(new URL('results.json',out),JSON.stringify({description:'Artificial development examples, not heldout evaluation; expected shapes test inclusion, not unique correctness.',passed:scored.filter(r=>r.pass).length,scored:scored.length,observed:result.filter(r=>r.pass===null).length,results:result},null,2));console.log(JSON.stringify({passed:scored.filter(r=>r.pass).length,total:scored.length,failures:result.filter(r=>r.pass===false),ambiguous:result.filter(r=>r.pass===null)}));}finally{await browser.close()}
