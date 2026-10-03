#!/usr/bin/env python3
"""Independent corpus/split/report/gate audit. Reads no evaluation folder."""
import argparse,base64,collections,hashlib,json,math,pathlib,sys
import numpy as np
sys.dont_write_bytecode=True
from check_parity import normalize,python_result,sha
REVIEW=pathlib.Path(__file__).resolve().parent
TASK=REVIEW.parent
REPO=TASK.parent.parent
HEADS=['shape','length','width','bend']
DEFAULT={'length':'neutral','width':'neutral','bend':'straight'}
def load(path):return json.loads(path.read_text())
def gate_search(predictions):
    positive=[r for r in predictions if r['label']!='hold'];negative=[r for r in predictions if r['label']=='hold'];trials=[]
    for score in [.1,.2,.3,.4,.5,.6]:
        for margin in [0,.05,.1,.15]:
            for coverage in [0,.2]:
                labels=[r['prediction'] if r['score']>=score and r['margin']>=margin and r['coverage']>=coverage else 'hold' for r in predictions]
                pa=sum(label==r['label'] for label,r in zip(labels,predictions) if r['label']!='hold')/max(1,len(positive))
                ha=sum(label=='hold' for label,r in zip(labels,predictions) if r['label']=='hold')/max(1,len(negative))
                trials.append(dict(score=score,margin=margin,coverage=coverage,objective=(pa+ha)/2,positiveAccuracy=pa,holdAccuracy=ha))
    return max(trials,key=lambda r:(r['objective'],r['holdAccuracy'],r['positiveAccuracy'],-r['score'],-r['margin'])),trials

def main():
    arg=argparse.ArgumentParser();arg.add_argument('--kind',default='seed',choices=['seed','bonsai4','bonsai8']);args=arg.parse_args()
    corpus_path=TASK/'artifacts'/f'{args.kind}-corpus.json';model_path=TASK/'artifacts'/f'{args.kind}-model.json';training_path=TASK/'artifacts'/f'{args.kind}-training.json'
    corpus=load(corpus_path);model=load(model_path);training=load(training_path)
    shapes=load(TASK/'seeds/shapes.json');holds=load(TASK/'seeds/holds.json');transforms=load(TASK/'seeds/transforms.json')
    source_specs={};canonical={}
    for shape in shapes:
        canonical[shape['shape']]=shape['name']
        source_specs[(shape['shape'],shape['shape']+'/name')]=dict(split='train',text=set([shape['name']]+shape['aliases']))
        for d in shape['descriptions']:source_specs[(shape['shape'],shape['shape']+'/'+d['family'])]=dict(split=d['split'],text={d['text']})
    for hold in holds:
        key=('hold','hold/'+hold['family']);source_specs.setdefault(key,dict(split=hold['split'],text=set()))['text'].add(hold['text'])
    phrases={q['family']:(t['head'],t['value'],q) for t in transforms for q in t['phrases']}
    # family is unique for a semantic grouping, so it can have multiple phrases;
    # collect the complete set, rather than relying on the last phrase above.
    allphrases=collections.defaultdict(list)
    for t in transforms:
        for q in t['phrases']:allphrases[q['family']].append((t['head'],t['value'],q))
    issues=[];by_head={};base_default_count=0;modified_count=0;teacher_count=0
    for head in HEADS:
        rows=[r for r in corpus if r['head']==head];keys=[normalize(r['text']) for r in rows]
        if len(keys)!=len(set(keys)):issues.append(dict(check='duplicate_normalized_text',head=head))
        train=[r for r in rows if r['split']=='train'];dev=[r for r in rows if r['split']=='dev']
        if {normalize(r['text']) for r in train}&{normalize(r['text']) for r in dev}:issues.append(dict(check='train_dev_text_overlap',head=head))
        if {r['family'] for r in train}&{r['family'] for r in dev}:issues.append(dict(check='train_dev_family_overlap',head=head))
        labels=model['heads'][head]['labels'];q=np.frombuffer(base64.b64decode(model['heads'][head]['weights']),dtype='<i2')
        known=base64.b64decode(model['heads'][head]['known'])
        if q.size!=model['dimensions']*len(labels) or len(known)!=(model['dimensions']+7)//8:issues.append(dict(check='quantized_layout',head=head))
        if max(abs(int(x)) for x in q)>32760:issues.append(dict(check='int16_range',head=head))
        predictions=training[head]['predictions'];lookup={(normalize(r['text']),r['family'],r['label']) for r in dev}
        if len(predictions)!=len(dev) or any((normalize(r['text']),r['family'],r['label']) not in lookup for r in predictions):issues.append(dict(check='predictions_not_exact_dev_rows',head=head))
        correct=0;max_error=0.;max_margin_error=0.;coverage_error=0.;recomputed=[]
        for pred in predictions:
            scores=python_result(model,pred['text'],head,True);first,second=scores[:2]
            correct+=first['label']==pred['label'];max_error=max(max_error,abs(first['score']-pred['score']));max_margin_error=max(max_margin_error,abs(first['score']-second['score']-pred['margin']));coverage_error=max(coverage_error,abs(first['coverage']-pred['coverage']))
            if first['label']!=pred['prediction']:issues.append(dict(check='dev_top1_recalculation',head=head,family=pred['family']))
            recomputed.append(dict(label=pred['label'],prediction=first['label'],score=first['score'],margin=first['score']-second['score'],coverage=first['coverage']))
        if correct!=training[head]['devTop1Correct']:issues.append(dict(check='dev_correct_count',head=head))
        if training[head]['trainCount']!=len(train) or training[head]['devCount']!=len(dev):issues.append(dict(check='reported_split_counts',head=head))
        confusion=collections.Counter((r['label'],r['prediction']) for r in predictions)
        by_head[head]=dict(devConfusion=[dict(expected=k[0],predicted=k[1],count=n) for k,n in sorted(confusion.items())],train=len(train),dev=len(dev),recomputedDevCorrect=correct,trainFamilies=len({r['family'] for r in train}),devFamilies=len({r['family'] for r in dev}),maxFloat32ScoreError=max_error,maxFloat32MarginError=max_margin_error,maxCoverageError=coverage_error,quantizedCoefficients=int(q.size),maxAbsQuantized=max(abs(int(x)) for x in q))
        if head=='shape':shape_preds=recomputed
    # Validate seeded base attribute labels and canonical-only global modifier labels.
    for row in corpus:
        if row['source']!='ai-authored-seed':teacher_count+=1;continue
        shape=row['label'] if row['head']=='shape' else None
        matched=False
        for (source_shape,family),source in source_specs.items():
            if row['family']==family:
                texts=source['text'] if row['head']!='shape' or source_shape=='hold' else {w.format(text) for text in source['text'] for w in ['{}','{}のような形','{}を表現したい','形は{}']}
                if row['text'] not in texts or row['split']!=source['split']:issues.append(dict(check='base_seed_provenance',head=row['head'],family=family))
                expected=source_shape if row['head']=='shape' else DEFAULT[row['head']]
                if row['label']!=expected:issues.append(dict(check='base_default_attribute_or_shape',head=row['head'],family=family))
                if row['head']!='shape':base_default_count+=1
                matched=True;break
            if row['family'].startswith(family+'/'):
                phrase_family=row['family'][len(family)+1:]
                if source_shape=='hold' or not family.endswith('/name') or phrase_family not in allphrases:continue
                options=allphrases[phrase_family]
                for changed_head,value,phrase in options:
                    text=phrase['text']+' '+canonical[source_shape]
                    if row['text']!=text:continue
                    expected_split='dev' if phrase['split']=='dev' else 'train'
                    expected=source_shape if row['head']=='shape' else value if row['head']==changed_head else DEFAULT[row['head']]
                    if row['split']!=expected_split or row['label']!=expected:issues.append(dict(check='global_modifier_provenance_or_label',head=row['head'],family=row['family']))
                    modified_count+=1;matched=True;break
                if matched:break
        if not matched:issues.append(dict(check='unresolved_seed_provenance',head=row['head'],family=row['family']))
    gate,trials=gate_search(shape_preds)
    saved=training['gating']['selected'];gate_difference={k:(gate[k],saved[k]) for k in gate if abs(gate[k]-saved[k])>1e-9}
    if gate_difference:issues.append(dict(check='independent_gate_selection',differences=gate_difference))
    if {k:gate[k] for k in ['score','margin','coverage']}!=model['thresholds']:issues.append(dict(check='artifact_gate_matches_dev_selection'))
    if len(trials)!=len(training['gating']['candidates']):issues.append(dict(check='gate_candidate_count'))
    meta=training['meta']
    if meta['modelSha256']!=sha(model_path) or meta['corpusSha256']!=sha(corpus_path):issues.append(dict(check='report_artifact_hashes'))
    teacher_run=meta.get('teacherRun') or 'r2'
    rawpath=TASK/'teacher'/f'raw-{teacher_run}.jsonl'
    raw=[json.loads(line) for line in rawpath.read_text().splitlines() if line]
    train_sources={(s['shape'],d['family'],d['text']) for s in shapes for d in s['descriptions'] if d['split']=='train'}
    dev_sources={(s['shape'],d['family'],d['text']) for s in shapes for d in s['descriptions'] if d['split']=='dev'}
    if any((r['shape'],r['sourceFamily'],r['sourceText']) not in train_sources for r in raw):issues.append(dict(check='teacher_raw_source_not_train'))
    if any((r['shape'],r['sourceFamily'],r['sourceText']) in dev_sources for r in raw):issues.append(dict(check='teacher_raw_source_dev'))
    teacher=dict(rawRows=len(raw),sourceFamilies=len({(r['shape'],r['sourceFamily']) for r in raw}),sourceAllTrain=True,sourceDevRows=0,statusCounts=dict(collections.Counter(r['status'] for r in raw)))
    result=dict(kind=args.kind,rows=len(corpus),heads=by_head,baseAttributeRowsWithDefaultLabels=base_default_count,globalModifierRows=modified_count,teacherCorpusRows=teacher_count,gate=gate,gateCandidates=len(trials),teacherSourceRun=teacher_run,teacher=teacher,issues=issues,files={str(path.relative_to(REPO)):sha(path) for path in [TASK/'train.py',corpus_path,model_path,training_path,rawpath]},scope='Seed/train/development artifacts only. Does not read frozen evaluation inputs or predictions.')
    (REVIEW/f'{args.kind}-artifact-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
