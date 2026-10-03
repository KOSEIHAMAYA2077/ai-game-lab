#!/usr/bin/env python3
"""Independent audit of frozen dense static heads; dev and source only."""
import base64,collections,hashlib,importlib.util,json,pathlib,sys
import numpy as np
sys.dont_write_bytecode=True
REVIEW=pathlib.Path(__file__).resolve().parent;TASK=REVIEW.parent;REPO=TASK.parent.parent
sys.path.insert(0,str(TASK))
from check_parity import normalize,sha

def load(path):return json.loads(path.read_text())
def imports(path,name):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def softmax(x,w,b):
    logits=x@w+b;logits-=np.max(logits,axis=1,keepdims=True);exp=np.exp(logits);return exp/np.sum(exp,axis=1,keepdims=True)
def groups(rows,p,labels,gate=None):
    order=np.argmax(p,axis=1);maximum=np.max(p,axis=1);sorted_p=np.sort(p,axis=1);margin=sorted_p[:,-1]-sorted_p[:,-2]
    if gate:order=order.copy();order[(maximum<gate['score'])|(margin<gate['margin'])]=labels.index('hold')
    result={}
    for i,row in enumerate(rows):
        key='hold' if row['label']=='hold' else 'named' if '/name/' in row['family'] else 'description'
        group=result.setdefault(key,dict(count=0,correct=0));group['count']+=1;group['correct']+=labels[order[i]]==row['label']
    for group in result.values():group['accuracy']=group['correct']/group['count']
    return result

def main():
    frozen=load(TASK/'FREEZE.json');issues=[];freeze_checks={}
    for relative,expected in frozen['files'].items():
        # All files listed by this freeze are source/corpus/model/teacher curation.
        if 'evaluation' in pathlib.Path(relative).parts:raise RuntimeError('evaluation path in freeze unexpectedly requested')
        freeze_checks[relative]=sha(TASK/relative)==expected
        if not freeze_checks[relative]:issues.append(dict(check='freeze_file_hash',file=relative))
    encoder=imports(TASK/'static-candidate/export_features.py','frozen_static_features').StaticFeatureEncoder()
    training_module=imports(TASK/'train_static.py','frozen_static_train')
    expected_configs=[dict(lr=lr,l2=l2,epochs=160,batch=128) for lr in [.02,.06] for l2 in [.0001,.005]]
    if training_module.CONFIGS!=expected_configs:issues.append(dict(check='four_config_grid'))
    candidate_results=[]
    cache={}
    for kind,basekind in [('static-seed','seed'),('static-bonsai8','bonsai8')]:
        corpus=load(TASK/'artifacts'/f'{kind}-corpus.json');model=load(TASK/'artifacts'/f'{kind}-model.json');report=load(TASK/'artifacts'/f'{kind}-training.json');base=load(TASK/'artifacts'/f'{basekind}-corpus.json')
        if corpus!=base:issues.append(dict(kind=kind,check='same_source_corpus'))
        heads={}
        for head in ['shape','length','width','bend']:
            rows=[r for r in corpus if r['head']==head];train=[r for r in rows if r['split']=='train'];dev=[r for r in rows if r['split']=='dev'];labels=model['heads'][head]['labels'];counts=np.bincount([labels.index(r['label']) for r in train],minlength=len(labels));cw=(len(train)/(len(labels)*np.maximum(1,counts))).astype(np.float32)
            trainkeys={normalize(r['text']) for r in train};devkeys={normalize(r['text']) for r in dev};family_train={r['family'] for r in train};family_dev={r['family'] for r in dev}
            if trainkeys&devkeys or family_train&family_dev:issues.append(dict(kind=kind,head=head,check='train_dev_overlap'))
            if len(train)!=report[head]['trainCount'] or len(dev)!=report[head]['devCount']:issues.append(dict(kind=kind,head=head,check='split_counts'))
            for row in dev:
                if row['text'] not in cache:
                    encoded=encoder.encode(row['text']);assert encoded['vector'] is not None,encoded['hold'];cache[row['text']]=np.asarray(encoded['vector'],np.float32)
            x=np.stack([cache[r['text']] for r in dev]);h=model['heads'][head];w=np.frombuffer(base64.b64decode(h['weights']),dtype='<f4').reshape(128,len(labels));b=np.asarray(h['bias'],np.float32)
            if not np.isfinite(w).all() or not np.isfinite(b).all():issues.append(dict(kind=kind,head=head,check='nonfinite_parameters'))
            p=softmax(x,w,b);predictions=report[head]['predictions'];maximum=np.max(p,axis=1);sorted_p=np.sort(p,axis=1);margins=sorted_p[:,-1]-sorted_p[:,-2];top=np.argmax(p,axis=1)
            # Accelerate may set floating-point status flags on valid matmul.
            # Check the output, then use a separate float64 scalar contraction.
            if not np.isfinite(x).all() or not np.isfinite(p).all():
                raise ValueError('nonfinite dev feature/probability: '+kind+'/'+head)
            z64=np.einsum('ij,jk->ik',x.astype(np.float64),w.astype(np.float64),optimize=False)+b.astype(np.float64)
            z64-=np.max(z64,axis=1,keepdims=True);p64=np.exp(z64);p64/=np.sum(p64,axis=1,keepdims=True)
            f64_error=float(np.max(np.abs(p.astype(np.float64)-p64)))
            f64_top_matches=int(np.sum(top==np.argmax(p64,axis=1)))
            if not np.isfinite(p64).all() or f64_error>1e-6 or f64_top_matches!=len(dev):
                issues.append(dict(kind=kind,head=head,check='independent_float64_softmax',maxProbabilityError=f64_error,topMatches=f64_top_matches))
            if len(predictions)!=len(dev):issues.append(dict(kind=kind,head=head,check='dev_prediction_count'))
            top_matches=0;max_score_error=0.;max_margin_error=0.
            for i,(r,saved) in enumerate(zip(dev,predictions)):
                if (r['text'],r['label'],r['family'])!=(saved['text'],saved['label'],saved['family']):issues.append(dict(kind=kind,head=head,check='prediction_not_exact_dev_row',family=r['family']))
                top_matches+=labels[int(top[i])]==saved['prediction'];max_score_error=max(max_score_error,abs(float(maximum[i])-saved['score']));max_margin_error=max(max_margin_error,abs(float(margins[i])-saved['margin']))
            if top_matches!=len(dev) or max_score_error>1e-6 or max_margin_error>1e-6:issues.append(dict(kind=kind,head=head,check='saved_dev_predictions_recompute',topMatches=top_matches,maxScoreError=max_score_error,maxMarginError=max_margin_error))
            trials=report[head]['trials'];selected=max(trials,key=lambda r:r['objective'])
            if len(trials)!=4 or [t['config'] for t in trials]!=expected_configs or selected['config']!=report[head]['selectedConfig']:issues.append(dict(kind=kind,head=head,check='four_trial_dev_selection'))
            if head=='shape':
                raw=groups(dev,p,labels);objective=float(np.mean([g['accuracy'] for g in raw.values()]));gate_trials=[]
                for score in [0,.1,.2,.3,.4,.5]:
                    for margin in [0,.05,.1,.15]:
                        gate=dict(score=score,margin=margin);group=groups(dev,p,labels,gate);gate_trials.append(dict(gate=gate,objective=float(np.mean([g['accuracy'] for g in group.values()])),groups=group))
                gate_selected=max(gate_trials,key=lambda t:(t['objective'],t['groups']['hold']['accuracy'],-t['gate']['score'],-t['gate']['margin']))
                if gate_selected['gate']!=model['thresholds'] or len(report[head]['gateSelection'])!=24 or raw!=report[head]['rawGroups'] or gate_selected['groups']!=report[head]['gatedGroups']:issues.append(dict(kind=kind,check='dev_gate_search_recompute'))
                gate_result=gate_selected
            else:
                y=np.asarray([labels.index(r['label']) for r in dev]);objective=float(np.mean([np.mean(top[y==i]==i) for i in range(len(labels)) if np.any(y==i)]))
            if abs(objective-report[head]['selectedObjective'])>1e-12:issues.append(dict(kind=kind,head=head,check='selected_config_objective_recompute',computed=objective,saved=report[head]['selectedObjective']))
            correct_by_label={label:dict(count=sum(r['label']==label for r in dev),correct=sum(r['label']==label and labels[int(top[i])]==label for i,r in enumerate(dev))) for label in labels}
            if correct_by_label!=report[head]['byLabel']:issues.append(dict(kind=kind,head=head,check='per_label_recompute'))
            heads[head]=dict(train=len(train),dev=len(dev),classTrainCounts=dict(zip(labels,map(int,counts))),classWeights=dict(zip(labels,map(float,cw))),effectiveWeightedCountPerClass=dict(zip(labels,[float(n*v) for n,v in zip(counts,cw)])),meanClassWeightAcrossRows=float(np.dot(counts,cw)/len(train)),selectedConfig=selected['config'],selectedDevObjective=objective,fourTrialMaxVerified=True,devPredictionsTop1Match=top_matches,maxScoreError=max_score_error,maxMarginError=max_margin_error,allFeaturesAndProbabilitiesFinite=True,float64ScalarProbabilityMaxError=f64_error,float64Top1Matches=f64_top_matches)
        meta=report['meta']
        if sha(TASK/'artifacts'/f'{kind}-model.json')!=meta['modelSha256'] or sha(TASK/'artifacts'/f'{kind}-corpus.json')!=meta['corpusSha256']:issues.append(dict(kind=kind,check='report_model_corpus_sha'))
        candidate_results.append(dict(kind=kind,sourceCorpusIdentical=corpus==base,heads=heads,devGate=gate_result,modelSha256=sha(TASK/'artifacts'/f'{kind}-model.json'),corpusSha256=sha(TASK/'artifacts'/f'{kind}-corpus.json')))
    a=load(TASK/'artifacts/static-seed-model.json');b=load(TASK/'artifacts/static-bonsai8-model.json');seed=load(TASK/'artifacts/static-seed-corpus.json');teacher=load(TASK/'artifacts/static-bonsai8-corpus.json')
    attr_same={h:a['heads'][h]==b['heads'][h] for h in ['length','width','bend']}
    attr_rows_same={h:[r for r in seed if r['head']==h]==[r for r in teacher if r['head']==h] for h in ['length','width','bend']}
    if not all(attr_same.values()) or not all(attr_rows_same.values()):issues.append(dict(check='static_teacher_attribute_confounded'))
    if a['featureModel']!=b['featureModel']:issues.append(dict(check='static_feature_model_changed'))
    result=dict(freezeHashesMatch=all(freeze_checks.values()),freezeFileChecks=freeze_checks,sourceHashes={name:sha(TASK/name) for name in ['train.py','train_static.py','predict_static.py','static-candidate/export_features.py']},fourConfigGrid=expected_configs,candidates=candidate_results,teacherAddition=dict(attributeHeadsByteIdentical=attr_same,attributeRowsIdentical=attr_rows_same,featureModelIdentical=a['featureModel']==b['featureModel']),uniqueDevFeatureTextsRecomputed=len(cache),issues=issues,scope='Frozen sources/models, seed/teacher corpora and development predictions only. No holdout read, model/artifact modification, training or new model selection. Nonselected trial objectives were checked by source and maxima, not refitted.')
    (REVIEW/'static-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(freezeHashesMatch=result['freezeHashesMatch'],candidates=[dict(kind=r['kind'],sourceCorpusIdentical=r['sourceCorpusIdentical'],headObjectives={k:v['selectedDevObjective'] for k,v in r['heads'].items()},devGate=r['devGate']) for r in candidate_results],teacherAddition=result['teacherAddition'],uniqueDevFeatureTextsRecomputed=len(cache),issues=issues),ensure_ascii=False,indent=2))
if __name__=='__main__':main()
