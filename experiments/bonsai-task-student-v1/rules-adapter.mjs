import {createServer} from '../../prototypes/glyph-creature/node_modules/vite/dist/node/index.js';
import {fileURLToPath} from 'node:url';
import {ruleAttributes} from '../../prototypes/glyph-creature/src/task-student-v1/rule-modifiers.mjs';
const root=fileURLToPath(new URL('../../prototypes/glyph-creature/',import.meta.url));
const server=await createServer({root,configFile:false,server:{middlewareMode:true,ws:false,hmr:false},appType:'custom'});
const {shapeChoices}=await server.ssrLoadModule('/src/language.ts');
await server.close();
/** Existing 60-shape vocabulary/graph; new explicit whole-body modifier baseline. */
export function predictRule(text) {
  const start=performance.now(), names=shapeChoices(text,true);
  return {shape:names[0]??'hold',...ruleAttributes(text),modelMs:performance.now()-start,source:'existing-shape-rules-plus-new-explicit-modifiers'};
}
