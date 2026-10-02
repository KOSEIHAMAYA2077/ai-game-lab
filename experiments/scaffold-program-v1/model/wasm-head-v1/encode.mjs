// Training/validation embeddings from the same browser runtime as production.
// Synthetic data only; no independent accuracy fixture is read.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(resolve(process.cwd(), 'package.json'));
const { chromium } = require('@playwright/test');
const root = resolve(process.cwd(), '../..');
const modelFolder = resolve(root, 'experiments/scaffold-program-v1/model');
const inputPath = process.argv[2] ? resolve(process.argv[2]) : resolve(modelFolder, 'wasm-head-v1/masked-inputs.json');
const outputPath = process.argv[3] ? resolve(process.argv[3]) : resolve(modelFolder, 'wasm-head-v1/embeddings.json');
const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
const config = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/scaffold-language.json'), 'utf8'));
const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4222/program.html');
await page.waitForLoadState('networkidle');
const result = await page.evaluate(async({payload,config})=>{
  const {PreTrainedTokenizer}=await import('/node_modules/.vite/deps/@huggingface_transformers.js');
  const ort=await import('/node_modules/.vite/deps/onnxruntime-web_wasm.js');
  const sha=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  let downloadedBytes=0;
  const checked=async name=>{
    const entry=config.files.find(v=>v.file===name);
    const cache=await caches.open(`glyph-model-${config.revision}`);
    const cached=await cache.match(entry.url);
    const buffer=cached ? await cached.arrayBuffer() : await (await fetch(entry.url,{credentials:'omit',referrerPolicy:'no-referrer'})).arrayBuffer();
    if(buffer.byteLength!==entry.bytes || await sha(buffer)!==entry.sha256) throw new Error('Pinned checksum mismatch');
    if(!cached){downloadedBytes+=buffer.byteLength;await cache.put(entry.url,new Response(buffer));}
    return buffer;
  };
  const prepared=performance.now();
  const [tokenizerBytes,tokenizerConfigBytes,modelBytes]=await Promise.all(['tokenizer.json','tokenizer_config.json','onnx/model_qint8_arm64.onnx'].map(checked));
  const tokenizer=new PreTrainedTokenizer(JSON.parse(new TextDecoder().decode(tokenizerBytes)),JSON.parse(new TextDecoder().decode(tokenizerConfigBytes)));
  ort.env.wasm.numThreads=1;
  ort.env.logLevel='error';
  ort.env.wasm.wasmPaths={wasm:new URL('/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',location.href).href,mjs:new URL('/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',location.href).href};
  const session=await ort.InferenceSession.create(modelBytes,{executionProviders:['wasm']});
  const preparationMs=performance.now()-prepared;
  const embed=async texts=>{
    const rows=texts.map(text=>{
      const ids=tokenizer(text,{return_tensor:false,truncation:false,padding:false}).input_ids;
      return ids.length>128?[ids[0],...ids.slice(-127)]:ids;
    });
    const length=Math.max(...rows.map(v=>v.length));
    const ids=new BigInt64Array(texts.length*length).fill(BigInt(tokenizer.pad_token_id));
    const mask=new BigInt64Array(ids.length);
    rows.forEach((tokens,row)=>tokens.forEach((id,token)=>{ids[row*length+token]=BigInt(id);mask[row*length+token]=1n;}));
    const feed={};
    for(const name of session.inputNames){
      if(name==='input_ids')feed[name]=new ort.Tensor('int64',ids,[texts.length,length]);
      if(name==='attention_mask')feed[name]=new ort.Tensor('int64',mask,[texts.length,length]);
      if(name==='token_type_ids')feed[name]=new ort.Tensor('int64',new BigInt64Array(ids.length),[texts.length,length]);
    }
    const outputs=await session.run(feed);
    const hidden=outputs[session.outputNames[0]], [batch,len,dimension]=hidden.dims;
    const data=hidden.data;
    const vectors=[];
    for(let row=0;row<batch;row++){
      const vector=new Float32Array(dimension);
      let count=0;
      for(let token=0;token<len;token++){
        if(mask[row*len+token]===0n)continue;
        count++;
        for(let c=0;c<dimension;c++)vector[c]+=data[(row*len+token)*dimension+c];
      }
      let norm=0;
      for(let c=0;c<dimension;c++){vector[c]/=Math.max(1,count);norm+=vector[c]**2;}
      norm=Math.sqrt(norm)||1;
      for(let c=0;c<dimension;c++)vector[c]/=norm;
      vectors.push(Array.from(vector));
    }
    return vectors;
  };
  const started=performance.now();
  const rows=[];
  for(const text of payload.inputs)rows.push({text,vector:(await embed([text]))[0]});
  const embeddingMs=performance.now()-started;
  // Preserve production caption/descriptor/background batch-8 references;
  // only runtime queries and the new head's training use batch=1.
  const staticGroups=[Object.entries(config.captions).flatMap(([family,descriptions])=>[...descriptions,...config.aliases[family]]),Object.values(config.descriptors).flatMap(values=>values.map(([,description])=>description)),config.background];
  const staticRows=[];
  for(const group of staticGroups)for(let i=0;i<group.length;i+=8){
    const texts=group.slice(i,i+8),vectors=await embed(texts);
    texts.forEach((text,j)=>staticRows.push({text,vector:vectors[j]}));
  }
  const probes=payload.inputs.slice(0,8);
  const batched=await embed(probes);
  const batchDifference=probes.map((text,i)=>({text,maxVectorDifference:Math.max(...batched[i].map((v,c)=>Math.abs(v-rows.find(row=>row.text===text).vector[c])))}));
  return {provider:'wasm',batchSize:1,staticReferenceBatchSize:8,preparationMs,embeddingMs,downloadedBytes,rows,staticRows,batchDifference,userAgent:navigator.userAgent};
},{payload,config});
await browser.close();
const body=JSON.stringify({label:payload.label??'Artificial training/validation only; deployment batch=1; no independent evaluation text',model:config.model,revision:config.revision,...result})+'\n';
writeFileSync(outputPath,body);
console.log(JSON.stringify({preparationMs:result.preparationMs,embeddingMs:result.embeddingMs,rows:result.rows.length,downloadedBytes:result.downloadedBytes,maxBatchDifference:Math.max(...result.batchDifference.map(row=>row.maxVectorDifference)),sha256:createHash('sha256').update(body).digest('hex')}));
