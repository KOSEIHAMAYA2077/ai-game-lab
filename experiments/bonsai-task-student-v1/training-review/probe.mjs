import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [inferencePath,modelPath,fixturePath]=process.argv.slice(2);
const {loadModel,featureIds,scores,predict}=await import(pathToFileURL(inferencePath).href);
const raw=JSON.parse(readFileSync(modelPath,'utf8'));
const model=loadModel(raw);
const fixtures=JSON.parse(readFileSync(fixturePath,'utf8'));
const rows=fixtures.map(f=>({
  ...f,
  featureIds:featureIds(f.text,model.dimensions,model.ngramMin,model.ngramMax),
  heads:Object.fromEntries(['shape','length','width','bend'].map(k=>[k,scores(model,f.text,k)])),
  prediction:predict(model,f.text),
}));
process.stdout.write(JSON.stringify({node:process.version,modelKind:raw.kind,rows}));
