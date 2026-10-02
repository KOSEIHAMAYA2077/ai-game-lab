"""Existing local oracle only; writes this new folder, never old models/fixtures."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
import tokenizers
from tokenizers import Tokenizer
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OLD=ROOT/'experiments/static-japanese-retrieval-v1';LOCAL=ROOT/'.local/static-japanese-v1'
REV='95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3'
TOK=LOCAL/'source'/REV/'0_StaticEmbedding/tokenizer.json';TAB=LOCAL/'tables/table-128-float16.bin'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert tokenizers.__version__=='0.22.1' and np.__version__=='2.0.2'
assert sha(TOK)=='833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9'
assert sha(TAB)=='65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201'
tok=Tokenizer.from_file(str(TOK));tok.no_padding();tok.no_truncation();table=np.memmap(TAB,dtype='<f2',mode='r',shape=(32768,128))
inventory=json.loads((OLD/'captions.json').read_text())['entries'];cal=json.loads((OLD/'calibration.json').read_text())['rows'];caps=[{'registry':e['registry'],'label':e['label'],'text':t} for e in inventory for t in e['captions']]
old=[{'id':'old-cal-'+str(i),'group':'old-calibration','text':r['text']} for i,r in enumerate(cal)]+[{'id':'old-caption-'+str(i),'group':'old-caption','text':r['text']} for i,r in enumerate(caps)]
assert len(old)==455
edge=[]
def add(group,text):edge.append({'id':'edge-'+str(len(edge)),'group':group,'text':text})
for t in ['', ' ', '  ', '   x  ', 'a  b','\t\r\n','　ＡＢＣ１２３　','ﾊﾝｶｸｶﾀｶﾅ','ｶﾞﾊﾟ','㍿㌔㍍㎏','ﬁ ﬃ K Å ① Ⅻ','ΟΣ Σ ΣΟΣ İ I ẞ','e\u0301 é A\u030a Å','\u1100\u1161 가','😀🧠💧','👩‍👩‍👧‍👦','𠮷野家𩸽','x\u0000y','x\u200by','x▁y','▁▁x▁','hello-world/日本語',"a's A’S"]:add('manual-unicode',t)
for n in list(range(0,33))+[0x7f,0x85,0x8f,0x9f,0xa0,0x1680,*range(0x2000,0x2010),0x2028,0x2029,0x202f,0x205f,0x2581,0xfeff,0xfffd]:add('nmt-whitespace','A'+chr(n)+'B')
schema=json.loads(TOK.read_text())
for token in schema['added_tokens']:
 for t in [token['content'],'A'+token['content']+'B']:add('added-special',t)
for ws in [' ','   ','\t','\n','\u0085','\u00a0','\u200b','\u3000']:
 for t in [ws+'<mask>','A'+ws+'<mask>'+ws+'B']:add('mask-lstrip',t)
for t in ['<S>','<ＭＡＳＫ>','[UNUSED0]','[unused66]','<s></s><mask>','a<unk>🙂<pad>b'] :add('special-boundary',t)
for t in ['😀'*4000,'a'*4000,'a'*4001,'㍿'*4000,'あ'*4000]:add('limit',t)
def encode(text):
 if len(text)>4000:return {'ids':None,'pieces':None,'mean':None,'vector':None,'hold':'input_limit'}
 enc=tok.encode(text,add_special_tokens=False);ids=enc.ids
 norm=tok.normalizer.normalize_str(text);splits=[p for p,_ in tok.pre_tokenizer.pre_tokenize_str(norm)]
 base={'ids':ids,'pieces':enc.tokens,'normalization':norm,'pretokenizedWholeNormalization':splits,'unknownFraction':ids.count(3)/len(ids) if ids else 0}
 if len(ids)>4000:return dict(base,mean=None,vector=None,hold='token_limit')
 total=np.zeros(128,dtype=np.float32)
 for start in range(0,len(ids),64):total+=table[ids[start:start+64]].astype(np.float32).sum(axis=0,dtype=np.float32)
 mean=total/len(ids) if ids else total
 normval=float(np.linalg.norm(mean));hold='empty_vector' if normval<=1e-12 else 'unknown_tokens' if base['unknownFraction']>.8 else None
 vec=mean/normval if hold is None else None
 return dict(base,mean=mean.tolist(),vector=vec.tolist() if vec is not None else None,hold=hold)
capVectors=[encode(c['text'])['vector'] for c in caps];assert all(v is not None for v in capVectors)
indices={r:([i for i,c in enumerate(caps) if c['registry']==r],np.asarray([v for c,v in zip(caps,capVectors) if c['registry']==r],dtype=np.float32)) for r in ['shape','primitive']}
def rank(vec,registry):
 if vec is None:return []
 ii,m=indices[registry];scores=np.sum(m*np.asarray(vec,dtype=np.float32),axis=1,dtype=np.float32);best={}
 for i,s in zip(ii,scores):
  label=caps[i]['label']
  if label not in best or float(s)>best[label][0]:best[label]=(float(s),i)
 return [{'label':l,'score':s,'captionIndex':i} for l,(s,i) in sorted(best.items(),key=lambda x:(-x[1][0],x[0]))]
cases=[]
for row in old+edge:
 e=encode(row['text']);cases.append(dict(row,expected=dict(e,ranks={r:rank(e['vector'],r) for r in ['shape','primitive']})))
expected={'schema':1,'oracle':{'tokenizers':tokenizers.__version__,'numpy':np.__version__},'purpose':'runtime parity only; old455 calibration/captions and artificial edges, no new quality evaluation','oldCases':len(old),'edgeCases':len(edge),'captionIndex':caps,'cases':cases}
out=HERE/'EXPECTED-R1.json'
with out.open('x') as f:json.dump(expected,f,ensure_ascii=False,separators=(',',':'));f.write('\n')
sources=[TOK,TAB,OLD/'requirements-lock.txt',OLD/'captions.json',OLD/'calibration.json',OLD/'retrieval_v2.py',OLD/'mmap_benchmark.py',OLD/'model-manifest.json',OLD/'numerical-checks.json',OLD/'tokenizer-author-provenance.json',OLD/'static-implementation-source.json',LOCAL/'venv/lib/python3.9/site-packages/tokenizers/tokenizers.abi3.so',HERE/'METHOD-R1.md',HERE/'BRIEF.md',HERE/'freeze_expected.py',HERE/'upstream/MANIFEST.json',out]
manifest={'schema':1,'oldCases':455,'edgeCases':len(edge),'oracle':expected['oracle'],'allBeforeNativeResults':True,'gate':{'IDs':'exact','pieces':'exact','meanAbs':1e-5,'unitAbs':1e-5,'cosineAbs':1e-5,'top1':'exact','scoreSeparatedPair':2e-5},'files':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sources]}
with (HERE/'EXPECTED-FREEZE-R1.json').open('x') as f:json.dump(manifest,f,indent=2);f.write('\n')
print(json.dumps({'old':len(old),'edge':len(edge),'total':len(cases),'expectedBytes':out.stat().st_size,'expectedSHA256':sha(out),'manifestSHA256':sha(HERE/'EXPECTED-FREEZE-R1.json')}))
