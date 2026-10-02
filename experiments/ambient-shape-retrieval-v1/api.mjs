import fs from 'node:fs';
import path from 'node:path';
import './retriever.js';
export const weights=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'weights-r1.json'),'utf8'));
export const retriever=globalThis.AmbientShapeRetrieval.createRetriever(weights);
export const predict=(text,options)=>retriever.predict(text,options);
export const rank=text=>retriever.rank(text);
export const info=retriever.info;
