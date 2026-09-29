"""A tiny learned classifier: Unicode character n-grams -> linear scores -> softmax."""
import math
import re
import unicodedata
from collections import Counter

LABELS = ['condense','vortex','orbit','mobius','ring','cube','cuboid','cross','triangle','square','none']

def normalize(text):
    return re.sub(r'[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', ' ', unicodedata.normalize('NFKC', text).lower()).strip(' ')

def grams(text):
    s = '^' + normalize(text) + '$'
    return set(s[i:i+n] for n in (1,2,3) for i in range(len(s)-n+1))

def features(text, vocab, idf):
    gs=grams(text); items=[(vocab[g],idf[vocab[g]]) for g in gs if g in vocab]
    norm=math.sqrt(sum(v*v for _,v in items)) or 1
    chars=set(normalize(text))
    coverage=sum(c in vocab for c in chars)/max(1,len(chars))
    return [(i,v/norm) for i,v in items],coverage

def predict(model,text):
    text=normalize(text)
    if len(text)>256 or not text: return {'label':'none','candidate':'none','score':0,'margin':0,'coverage':0,'reason':'length'}
    vocab={g:i for i,g in enumerate(model['vocabulary'])}
    items,coverage=features(text,vocab,model['idf'])
    logits=model['bias'][:]
    for i,v in items:
        for j,w in enumerate(model['weights'][i]): logits[j]+=v*w
    maximum=max(logits); values=[math.exp(v-maximum) for v in logits]; total=sum(values)
    probs=[v/total for v in values]; order=sorted(range(len(probs)),key=lambda i:-probs[i]); top,second=order[:2]
    score,margin=probs[top],probs[top]-probs[second]
    gates=model['thresholds']; label=model['labels'][top]
    accept=score>=gates['score'] and margin>=gates['margin'] and coverage>=gates['coverage']
    reason='none' if label=='none' else 'accepted' if accept else 'uncertain'
    return {'label':label if accept else 'none','candidate':label,'score':score,'margin':margin,'coverage':coverage,'reason':reason}

def metrics(rows,predictions):
    total=len(rows); negatives=sum(r['label']=='none' for r in rows)
    accepted=sum(p['label']!='none' for p in predictions)
    correct_shapes=sum(p['label']==r['label'] and p['label']!='none' for r,p in zip(rows,predictions))
    fp=sum(r['label']=='none' and p['label']!='none' for r,p in zip(rows,predictions))
    return {'n':total,'accuracy':sum(r['label']==p['label'] for r,p in zip(rows,predictions))/max(1,total),
            'accepted':accepted,'accepted_precision':correct_shapes/max(1,accepted),'shape_recall':correct_shapes/max(1,total-negatives),
            'negative_n':negatives,'false_shape_on_none':fp,'none_false_positive_rate':fp/max(1,negatives)}
