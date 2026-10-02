#!/usr/bin/env python3
"""Artificial bounded-domain data and reproducible char-ngram linear student.
No private inputs, transformer teacher inference, or model downloads are used.
"""
import base64, hashlib, json, math, pathlib, re, time, unicodedata
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parent
DIM = 4096
SEED = 231003
LABELS = ['sphere','box','tube','blade','ring','vase','unknown']
RELATIONS = ['end','above','through','none']
# Families are whole phrase/semantic cue groups, not random rows. All expansions
# of a family belong to one partition. Dev families never occur in training.
SHAPES = {
 'sphere': [('explicit-ja','球体|球|玉|ボール'),('round-ja','丸い玉|丸い塊|まんまる|丸い'),('surface-ja','球面|球状|球形'),('explicit-en','sphere|ball|orb'),('round-en','round object|round ball|round solid|round shape'),('dev-round-ja','丸みのある塊|ころころした玉|球のような形'),('dev-round-en','spherical object|rounded sphere|globular ball')],
 'box': [('explicit-ja','立方体|直方体|箱|四角い|四角'),('angular-ja','四角い箱|角ばった箱|角ばった塊|角張った'),('solid-ja','六面体|箱型|箱状|四角形'),('explicit-en','box|cube|cuboid|block'),('angular-en','square box|square solid|rectangular block|angular object'),('dev-angular-ja','角がある箱|四角の塊|六つの面がある箱'),('dev-angular-en','box-shaped object|cube-like solid|rectangular box')],
 'tube': [('explicit-ja','棒|管|筒|円柱|パイプ'),('elongated-ja','円柱の棒|細長い棒|管状|棒状'),('pipe-ja','中が空いた管|筒型|円筒|円筒形'),('explicit-en','tube|rod|pipe|cylinder|stick'),('long-en','long tube|cylindrical rod|hollow pipe|cylindrical object'),('dev-tube-ja','筒のような形|まっすぐな円柱|管の形'),('dev-tube-en','tubular shape|rod-like object|pipe-shaped solid')],
 'blade': [('explicit-ja','剣|刀|刃|刃物|ソード'),('sharp-ja','尖った剣|鋭い刀|刃の形|剣型'),('weapon-ja','長い刀|薄い刃|剣状|刀の形'),('explicit-en','sword|blade|saber'),('sharp-en','sharp blade|pointed sword|thin sword|sharp metal blade'),('dev-blade-ja','先が尖る剣|切れそうな刃|刀のような形'),('dev-blade-en','sword-like shape|blade-shaped object|pointy saber')],
 'ring': [('explicit-ja','輪|輪っか|円環|メビウス|メビウスの輪|ドーナツ'),('loop-ja','輪の形|閉じた輪|輪状|環状'),('hole-ja','穴のある輪|真ん中が空いた輪|ドーナツ型|円環状'),('explicit-en','ring|torus|loop|donut|hoop'),('hole-en','closed loop|circular ring|donut shape|ring with a hole'),('dev-ring-ja','わっか|ぐるっと閉じる輪|輪のような形'),('dev-ring-en','ring-shaped object|loop-like shape|toroidal ring')],
 'vase': [('explicit-ja','花瓶|花入れ|一輪挿し|壺|つぼ'),('container-ja','花を入れる器|花瓶の形|壺型|花器'),('neck-ja','首の細い壺|口が開いた花瓶|首が細い花瓶|口のある壺'),('explicit-en','vase|urn'),('container-en','flower vase|vase with a narrow neck|open vase|flower container'),('dev-vase-ja','花を飾る花瓶|壺のような器|花瓶型の形'),('dev-vase-en','vase-shaped object|urn-like container|vase for flowers')],
 'unknown': [('daily-ja','今日は楽しかった|明日の予定|勉強している|おやすみ|こんにちは|きれいな景色|風が吹いている|あああ'),('outside-ja','ドラゴン|恐竜|宇宙船|鳥|魚|人間|建物|猫|星|花火|クラゲ|城|コーヒー|音楽|愛|雨|雪|月'),('daily-en','hello|good night|my day|the weather is nice|I am working|abstract idea|writing notes'),('outside-en','dragon|spaceship|bird|fish|human|building|cat|star|firework|jellyfish|castle|coffee|music|love|rain|snow|moon'),('ambiguous-ja','球と箱|棒と花瓶|輪と剣|球か箱|形は何でもいい|好きな形|球の話を読む'),('ambiguous-en','sphere and box|ring and sword|any shape|no shape|a story about a box|a spherical dragon|round animal'),('dev-daily-ja','今日の勉強を振り返る|眠たい|星空を眺める|犬が走る|存在とは何か'),('dev-daily-en','the dog is sleeping|I wonder about tomorrow|a pleasant afternoon|novel thought|unseen creature')]
}
REL_FAMILIES = {
 'end': [('jp-tip','物体の先に物体|物体の先端に物体|物体の端に物体|物体の末端に物体|物体の片端に物体'),('jp-object-tip','物体を物体の先につける|物体を物体の先端へ接続|物体の先端には物体を付ける'),('en-tip','object at the tip of object|object at the end of object|object on the end of object|object with object at the tip'),('en-attach','attach object to the end of object|add object to the tip of object|object attached at the end of object'),('dev-jp-end','物体の端っこに物体を置く|物体の先っぽに物体がある|物体の終端へ物体を付ける'),('dev-en-end','object fitted to the tip of object|object joined at the end of object')],
 'above': [('jp-top','物体の上に物体|物体の上方に物体|物体のてっぺんに物体|物体の頂点に物体'),('jp-object-top','物体を物体の上に置く|物体を物体の上方へ載せる|物体の上には物体がある'),('en-top','object above object|object over object|object on top of object'),('en-placement','place object above object|put object on top of object|object sitting above object'),('dev-jp-upper','物体の頭上に物体|物体の真上に物体がある|物体のてっぺんへ物体を載せる'),('dev-en-upper','object rests atop object|object positioned above object')],
 'through': [('jp-pierce','物体を物体が貫く|物体が物体を貫く|物体を貫く物体|物体を物体が突き抜ける'),('jp-center','物体の中を物体が通る|物体の中心を物体が通る|物体に物体を通す|物体の穴に物体を挿す'),('en-through','object through object|object goes through object|pass object through object|object pierced by object'),('en-pierce','object passes through object|object penetrates object|object piercing object'),('dev-jp-penetrate','物体を物体が貫通する|物体の中央を物体が突き抜ける|物体の穴を物体が通り抜ける'),('dev-en-penetrate','object runs through object|object extends through object')],
 'none': [('jp-pair','物体と物体|物体または物体|物体の横に物体|物体の近くに物体|物体の下に物体|物体から物体を見る|物体を見たあと物体を書く'),('en-pair','object and object|object or object|object beside object|object below object|object next to object|object near object|object behind object|a story about object and object'),('jp-negative','物体の先に物体をつけない|物体の上に物体を置かない|物体を物体が貫かない'),('en-negative','do not put object above object|object not through object|never attach object at the end of object'),('dev-jp-unsupported','物体の隣に物体|物体の後ろに物体|物体を物体の下へ置く|物体と物体を並べる'),('dev-en-unsupported','object adjacent to object|object beneath object|object plus object')]
}


def normalize(s): return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC',s).lower()).strip()
def features(s):
    s='^'+normalize(s)+'$'
    pieces=set()
    for n in range(1,6):
        for i in range(len(s)-n+1): pieces.add(s[i:i+n])
    pieces.update('w:'+w for w in re.findall(r'[a-z]+',s))
    ids=set()
    for p in pieces:
        h=2166136261
        for c in p: h=((h ^ ord(c))*16777619)&0xffffffff
        ids.add(h%DIM)
    a=np.array(sorted(ids),dtype=np.int32)
    return a, 1/math.sqrt(max(1,len(a)))


def generate():
    rows=[]
    for label,families in SHAPES.items():
        for family,phrases in families:
            split='dev' if family.startswith('dev-') else 'train'
            for phrase in phrases.split('|'):
                is_en=bool(re.search('[a-z]',phrase))
                wrappers=['{}','a {}','please make {}','draw {}','small {}','large {}','thin {}','twisted {}'] if is_en else ['{}','{}を作る','{}にしたい','形は{}','小さな{}','大きな{}','細い{}','ねじれた{}']
                # Unknown classes use the same harmless request wrappers to avoid
                # request language becoming a proxy for a valid shape.
                for wrapper in wrappers:
                    rows.append(dict(head='primitive',family=label+'/'+family,split=split,label=label,text=wrapper.format(phrase)))
    for label,families in REL_FAMILIES.items():
        for family,phrases in families:
            split='dev' if family.startswith('dev-') else 'train'
            for phrase in phrases.split('|'):
                is_en='object' in phrase
                wrappers=['{}','please {}','draw {}','make {}','I want {}'] if is_en else ['{}','{}にする','{}を作る','{}。','できれば{}']
                for wrapper in wrappers:
                    rows.append(dict(head='relation',family=label+'/'+family,split=split,label=label,text=wrapper.format(phrase)))
    # Duplicate expanded text must remain in only one partition; make it
    # explicit in the report rather than random splitting nearby paraphrases.
    unique={}
    for row in rows:
        key=(row['head'],normalize(row['text']))
        if key in unique:
            if unique[key]['split'] != row['split']: raise ValueError('split collision')
        else: unique[key]=row
    return list(unique.values())


def train(rows,labels):
    train_rows=[r for r in rows if r['split']=='train']
    mapped=[(*features(r['text']), labels.index(r['label'])) for r in train_rows]
    w=np.zeros((DIM,len(labels)),np.float32); bias=np.zeros(len(labels),np.float32)
    rng=np.random.default_rng(SEED)
    losses=[]
    for epoch in range(160):
        lr=.65/(1+epoch*.025)
        loss=0
        for row in rng.permutation(len(mapped)):
            ids,value,target=mapped[row]
            logits=w[ids].sum(axis=0)*value+bias
            e=np.exp(logits-logits.max()); probability=e/e.sum()
            loss-=math.log(max(1e-10,float(probability[target])))
            probability[target]-=1
            w[ids]-=(lr*value)*probability
            bias-=lr*.12*probability
        w*=1-lr*.0008
        if epoch in [0,39,79,119,159]: losses.append([epoch+1,loss/len(mapped)])
    scale=float(np.abs(w).max())/32760 or 1
    quant=np.rint(w/scale).astype('<i2')
    known=np.zeros(DIM,np.uint8)
    for ids,_,_ in mapped: known[ids]=1
    model=dict(labels=labels,scale=scale,bias=[round(float(v),8) for v in bias],weights=base64.b64encode(quant.tobytes()).decode(),known=base64.b64encode(np.packbits(known,bitorder='little').tobytes()).decode())
    w=quant.astype(np.float32)*scale
    output={}
    for split in ['train','dev']:
        selections=[r for r in rows if r['split']==split]
        confusion={label:{other:0 for other in labels} for label in labels}
        correct=0; predictions=[]
        for r in selections:
            ids,value=features(r['text']); logits=w[ids].sum(axis=0)*value+bias
            p=np.exp(logits-logits.max()); p/=p.sum(); order=np.argsort(-p)
            pred=labels[order[0]]; correct+=pred==r['label']; confusion[r['label']][pred]+=1
            predictions.append(dict(text=r['text'],family=r['family'],label=r['label'],prediction=pred,score=float(p[order[0]]),margin=float(p[order[0]]-p[order[1]])))
        output[split]=dict(count=len(selections),correct=correct,accuracy=correct/len(selections),confusion=confusion,failures=[p for p in predictions if p['label']!=p['prediction']],predictions=predictions if split=='dev' else [])
    output['loss']=losses
    return model,output


def write_json(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    start=time.perf_counter(); rows=generate()
    write_json(ROOT/'artificial-corpus.json',rows)
    models={}; reports={}
    for head,labels in [('primitive',LABELS),('relation',RELATIONS)]:
        models[head],reports[head]=train([r for r in rows if r['head']==head],labels)
    artifact=dict(format='glyph-char-student-v1',dimensions=DIM,ngramMin=1,ngramMax=5,normalization='NFKC-lowercase-space',hash='fnv1a-codepoint',seed=SEED,thresholds=dict(primitiveScore=.80,primitiveMargin=.35,primitiveCoverage=.24,relationScore=.78,relationMargin=.30),heads=models)
    write_json(ROOT/'student-model.json',artifact)
    reports['meta']=dict(seed=SEED,dimensions=DIM,epochs=160,trainingSeconds=time.perf_counter()-start,modelBytes=(ROOT/'student-model.json').stat().st_size,corpusSha256=sha(ROOT/'artificial-corpus.json'),modelSha256=sha(ROOT/'student-model.json'),split='whole semantic/phrase family; no random row split',teacher='author-defined six-shape grammar labels, not a neural teacher')
    write_json(ROOT/'training-report.json',reports)
    print(json.dumps(dict(meta=reports['meta'],metrics={h:{s:{k:reports[h][s][k] for k in ['count','correct','accuracy']} for s in ['train','dev']} for h in ['primitive','relation']}),indent=2))
if __name__=='__main__': main()
