import { readFile,writeFile,access } from 'node:fs/promises';
import { evaluateCore } from '../../desktop/glyph-metal-ambient-cache-v1/Tests/core-replay-r2.mjs';
const [fixture,out]=process.argv.slice(2);
if(!fixture||!out)throw new Error('fixture and new output path required');
try{await access(out);throw new Error('preserve output');}catch(e){if(e.code!=='ENOENT')throw e;}
const result=evaluateCore(JSON.parse(await readFile(fixture,'utf8')));
await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
if(result.runs.some(r=>!r.passed))process.exitCode=1;
