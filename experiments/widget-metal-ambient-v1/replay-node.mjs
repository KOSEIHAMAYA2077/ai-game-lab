import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..');
const bundle=resolve(repo,process.argv[2]??''),out=resolve(repo,process.argv[3]??'');
if(!process.argv[2]||!process.argv[3]||!out.startsWith(resolve(here,'work')+'/'))throw new Error('bundle and new owned work output required');
try{await access(out);throw new Error('preserve outputs');}catch(e){if(e.code!=='ENOENT')throw e;}
const context=createContext({});runInContext(await readFile(bundle,'utf8'),context,{timeout:10000});
const evaluate=(name,json)=>{context.artificialJSON=json;const value=JSON.parse(runInContext(`AmbientNativeReceiver.${name}(artificialJSON)`,context,{timeout:10000}));delete context.artificialJSON;return value;};
const manual=evaluate('evaluateManualJSON',await readFile(resolve(here,'fixtures/manual-r1.json'),'utf8'));
const original=evaluate('evaluateOriginal20JSON',await readFile(resolve(repo,'experiments/ambient-javascriptcore-v1/CASES-R3.json'),'utf8'));
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'manual12.json'),JSON.stringify(manual,null,2)+'\n',{flag:'wx'});
await writeFile(resolve(out,'original20.json'),JSON.stringify(original,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({manual12Passed:manual.passed,original20Passed:original.passed}));
if(manual.passed!==12||original.passed!==20)process.exitCode=1;
