#!/usr/bin/env python3
"""Pinned, local-only 128-F16 StaticEmbedding feature export; no learned head.
Use the already-installed .local/static-japanese-v1/venv/bin/python -B.
Mean recipe follows the existing retrieval.py and NativeStaticR5.swift.
"""
import argparse,hashlib,json,os,pathlib,sys,time
os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
import numpy as np
from tokenizers import Tokenizer
import tokenizers
HERE=pathlib.Path(__file__).resolve().parent
REPO=HERE.parents[2]
REVISION='95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3'
TABLE_SHA='65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201'
TOKENIZER_SHA='833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9'
DIMS=128; VOCAB=32768; MAX_CHARS=512; MAX_LINE_BYTES=65536

def sha(path):
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1048576),b''):digest.update(block)
    return digest.hexdigest()

class StaticFeatureEncoder:
    def __init__(self,model_dir=None):
        started=time.perf_counter();local=pathlib.Path(model_dir) if model_dir else REPO/'.local/static-japanese-v1'
        manifest=json.loads((local/'model-manifest.json').read_text())
        if manifest['model']!='hotchpotch/static-embedding-japanese' or manifest['revision']!=REVISION:raise ValueError('unsupported model pin')
        record=next(r for r in manifest['tables'] if r['file']=='table-128-float16.bin')
        if record['shape']!=[VOCAB,DIMS] or record['dtype']!='float16' or record['bytes']!=VOCAB*DIMS*2 or record['sha256']!=TABLE_SHA:raise ValueError('unsupported table manifest')
        table_path=local/'tables'/record['file'];tokenizer_path=local/'source'/REVISION/'0_StaticEmbedding/tokenizer.json'
        if table_path.stat().st_size!=VOCAB*DIMS*2 or sha(table_path)!=TABLE_SHA:raise ValueError('table pin mismatch')
        if tokenizer_path.stat().st_size>3000000 or sha(tokenizer_path)!=TOKENIZER_SHA:raise ValueError('tokenizer pin mismatch')
        if tokenizers.__version__!='0.22.1':raise ValueError('requires already-installed tokenizers 0.22.1')
        self.table=np.memmap(table_path,dtype='<f2',mode='r',shape=(VOCAB,DIMS))
        self.tokenizer=Tokenizer.from_file(str(tokenizer_path));self.tokenizer.no_padding();self.tokenizer.no_truncation()
        self.initialization_ms=(time.perf_counter()-started)*1000
        self.manifest_sha=sha(local/'model-manifest.json')
    def metadata(self):
        return dict(format='glyph-static-feature-v1',model='hotchpotch/static-embedding-japanese',revision=REVISION,dimensions=DIMS,tableBytes=VOCAB*DIMS*2,tableSha256=TABLE_SHA,tokenizerSha256=TOKENIZER_SHA,modelManifestSha256=self.manifest_sha,tokenizersVersion=tokenizers.__version__,numpyVersion=np.__version__,inputMaxUnicodeScalars=MAX_CHARS,tokenLimit=4000,pooling='Float32 block-64 mean; L2 normalized',automaticSpecialTokens=False,initializationMs=self.initialization_ms,scope='Feature exporter only. No caption ranking, task head, training, threshold, or quality evaluation.')
    def encode(self,text,debug=False):
        started=time.perf_counter();ids=[];unknown=0.
        def answer(vector=None,hold=None,mean=None):
            row=dict(dimensions=DIMS,vector=vector.tolist() if vector is not None else None,hold=hold,tokenCount=len(ids),unknownFraction=unknown,encodingMs=(time.perf_counter()-started)*1000)
            if debug:row.update(tokenIds=ids,mean=mean.tolist() if mean is not None else None)
            return row
        if not isinstance(text,str) or len(text)>MAX_CHARS:return answer(hold='input_limit')
        if any(0xd800<=ord(c)<=0xdfff for c in text):return answer(hold='invalid_unicode')
        ids=self.tokenizer.encode(text,add_special_tokens=False).ids
        if len(ids)>4000:return answer(hold='token_limit')
        if ids and (min(ids)<0 or max(ids)>=VOCAB):return answer(hold='invalid_token_id')
        unknown=ids.count(3)/len(ids) if ids else 0.
        total=np.zeros(DIMS,dtype=np.float32)
        for start in range(0,len(ids),64):total+=self.table[ids[start:start+64]].astype(np.float32).sum(axis=0,dtype=np.float32)
        if ids:total/=np.float32(len(ids))
        if not np.isfinite(total).all():return answer(hold='nonfinite_vector')
        norm=np.float32(np.linalg.norm(total))
        # Native R5 checks empty before unknown; preserve that priority.
        hold='empty_vector' if norm<=1e-12 else 'unknown_tokens' if unknown>.8 else None
        return answer(vector=total/norm if hold is None else None,hold=hold,mean=total)
    def reply(self,row,debug=False):
        if not isinstance(row,dict) or 'text' not in row:return dict(id=row.get('id') if isinstance(row,dict) else None,dimensions=DIMS,vector=None,hold='invalid_request',tokenCount=0,unknownFraction=0.,encodingMs=0.)
        return dict(id=row.get('id'),**self.encode(row['text'],debug))

def input_lines(stream):
    while True:
        line=stream.readline(MAX_LINE_BYTES+1)
        if not line:return
        if len(line)>MAX_LINE_BYTES:
            while not line.endswith(b'\n'):
                line=stream.readline(MAX_LINE_BYTES+1)
                if not line:break
            yield None;continue
        yield line

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--model-dir',type=pathlib.Path);parser.add_argument('--metadata',action='store_true');parser.add_argument('--debug',action='store_true');args=parser.parse_args()
    encoder=StaticFeatureEncoder(args.model_dir)
    if args.metadata:print(json.dumps(encoder.metadata(),ensure_ascii=False,allow_nan=False));return
    for line in input_lines(sys.stdin.buffer):
        if line is None:response=dict(id=None,dimensions=DIMS,vector=None,hold='jsonl_line_limit',tokenCount=0,unknownFraction=0.,encodingMs=0.)
        else:
            try:response=encoder.reply(json.loads(line.decode('utf-8')),args.debug)
            except (UnicodeError,json.JSONDecodeError):response=dict(id=None,dimensions=DIMS,vector=None,hold='invalid_json',tokenCount=0,unknownFraction=0.,encodingMs=0.)
        print(json.dumps(response,ensure_ascii=False,allow_nan=False),flush=True)
if __name__=='__main__':main()
