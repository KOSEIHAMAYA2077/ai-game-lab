"""Evaluate the independently frozen fixture; never calibrate or change parameters."""
import os
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
import sys, json, hashlib, time, datetime, re, unicodedata, importlib.util, traceback
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CAND = ROOT/'experiments/static-japanese-retrieval-v1'
FROZEN_CAND_SHA = 'ee83896eb1f074a787a8f587d12577761c399b224d5b5a8675351c5b5884abe1'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write_new(path, data):
    with path.open('x') as f: json.dump(data,f,ensure_ascii=False,indent=2); f.write('\n')
def normalized(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',s).lower()).strip()
def ratio(a,b): return a/b if b else None
def stats(vals):
    if not vals: return None
    vals=sorted(vals)
    return {'n':len(vals),'median_ms':median(vals),'p95_ms':vals[int((len(vals)-1)*.95)],'max_ms':vals[-1]}

freeze=json.loads((HERE/'frozen-fixture.json').read_text())
assert sha(HERE/'fixture.json')==freeze['fixture_sha256']
assert sha(HERE/'SCORING_METHOD.md')==freeze['scoring_sha256']
assert sha(CAND/'frozen-candidate-v2.json')==FROZEN_CAND_SHA
frozen=json.loads((CAND/'frozen-candidate-v2.json').read_text())
for file,key in [('captions.json','captionsSha256'),('method-plan-v2.json','methodSha256'),('retrieval_v2.py','runtimeSha256'),('calibration.json','calibrationSha256')]:
    assert sha(CAND/file)==frozen[key],file
fixture=json.loads((HERE/'fixture.json').read_text())
rows=fixture['rows']
inventory=json.loads((CAND/'captions.json').read_text())['entries']
spec=importlib.util.spec_from_file_location('frozen_static_retrieval_v2',CAND/'retrieval_v2.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

sources=[]
for entry in inventory:
    for field in ('captions','aliases'):
        for text in entry[field]:sources.append({'source':'captions.json','field':field,'registry':entry['registry'],'label':entry['label'],'text':text})
cal=json.loads((CAND/'calibration.json').read_text())
for row in cal['rows']:sources.append({'source':'calibration.json','id':row['id'],'text':row['text']})
overlaps=[]
for row in rows:
    for source in sources:
        if normalized(row['text'])==normalized(source['text']):
            overlaps.append({'id':row['id'],'exact_bytes':row['text']==source['text'],'normalized_full_text_match':True,'source':source})
write_new(HERE/'overlap-audit.json',{'fixture_sha256':freeze['fixture_sha256'],'audited_sources':{'candidate_caption_and_alias_strings':sum(x['source']=='captions.json' for x in sources),'candidate_calibration_rows':len(cal['rows'])},'normalization':'Unicode NFKC + lowercase + whitespace collapse; complete strings only','overlaps':overlaps,'training_scope':'Candidate has no additional task-training corpus; pretrained model training text is unavailable, so pretraining overlap is not audited. Source descriptions derive from the same authored geometry inventory; this shared label/geometry vocabulary is deliberate and not evidence of full-text leakage.'})

raw_file=(HERE/'raw-predictions.jsonl').open('x')
ranking_file=(HERE/'raw-rankings.jsonl').open('x')
all_results={}; load_timings={}; failures=[]
started=time.perf_counter()
for variant in frozen['thresholds']:
    before=time.perf_counter()
    retriever=module.Retriever(module.DEFAULT_LOCAL,variant,inventory)
    load_timings[variant]=(time.perf_counter()-before)*1000
    variant_results={}
    for registry in ('shape','primitive'):
        submitted=rows if registry=='shape' else [r for r in rows if r['group']!='positive' or r['primitive'] is not None]
        registry_results={}
        for row in submitted:
            expected=row['expected_label'] if registry=='shape' else row['primitive']
            t=time.perf_counter(); ranks,meta=retriever.rank(row['text'],registry);elapsed=(time.perf_counter()-t)*1000
            rank_record={'variant':variant,'registry':registry,'id':row['id'],'lang':row['lang'],'group':row['group'],'actual_query':row['text'],'expected':expected,'raw_top10':ranks[:10],'expected_rank':next((i+1 for i,x in enumerate(ranks) if x['label']==expected),None),'expected_score':next((x['score'] for x in ranks if x['label']==expected),None),'encoding':meta,'elapsed_ms':elapsed}
            ranking_file.write(json.dumps(rank_record,ensure_ascii=False)+'\n');ranking_file.flush()
        for mode in ('retrieval_only','guarded'):
            predictions=[]
            for row in submitted:
                t=time.perf_counter()
                try:
                    prediction=retriever.predict(row['text'],registry,frozen['thresholds'][variant][registry][mode],mode=='guarded')
                    error=None
                except Exception:
                    error=traceback.format_exc();prediction={'prediction':None,'source':'error','reason':'exception','top':[]};failures.append({'variant':variant,'registry':registry,'mode':mode,'id':row['id'],'error':error})
                elapsed=(time.perf_counter()-t)*1000
                record={'variant':variant,'registry':registry,'mode':mode,'id':row['id'],'lang':row['lang'],'group':row['group'],'subtype':row['subtype'],'actual_query':row['text'],'internal_scope_normalized_query':module.normalized(row['text']) if mode=='guarded' else None,'candidate_encoding_input':'original full actual_query; no keyword extraction, translation, or evaluator truncation','expected_label':row['expected_label'] if registry=='shape' else row['primitive'],'permitted_labels':row['permitted_labels'] if registry=='shape' else ([row['primitive']] if row['primitive'] else []),'primitive':row['primitive'],'elapsed_ms':elapsed,'error':error,**prediction}
                raw_file.write(json.dumps(record,ensure_ascii=False)+'\n');raw_file.flush();predictions.append(record)
            registry_results[mode]=predictions
        variant_results[registry]=registry_results
    all_results[variant]=variant_results
raw_file.close();ranking_file.close()

def metrics(predictions,lang=None):
    pred=[r for r in predictions if lang is None or r['lang']==lang]
    pos=[r for r in pred if r['group']=='positive'];holds=[r for r in pred if r['group']=='hold'];amb=[r for r in pred if r['group']=='ambiguous']
    accepted=[r for r in pos if r['prediction'] is not None]
    exact=sum(r['prediction']==r['expected_label'] for r in accepted)
    family=sum(r['prediction'] in r['permitted_labels'] for r in accepted)
    false=sum(r['prediction'] is not None for r in holds)
    return {'submitted':len(pred),'positive_n':len(pos),'positive_accepted':len(accepted),'positive_coverage':ratio(len(accepted),len(pos)),'positive_exact_correct':exact,'positive_exact_accuracy':ratio(exact,len(pos)),'positive_family_correct':family,'positive_family_accuracy':ratio(family,len(pos)),'positive_accepted_exact_precision':ratio(exact,len(accepted)),'positive_accepted_family_precision':ratio(family,len(accepted)),'hold_n':len(holds),'hold_false_activations':false,'hold_false_activation_rate':ratio(false,len(holds)),'accepted_unambiguous_exact_precision':ratio(exact,len(accepted)+false),'accepted_unambiguous_family_precision':ratio(family,len(accepted)+false),'ambiguous_n':len(amb),'ambiguous_accepted':sum(r['prediction'] is not None for r in amb),'ambiguous_acceptance_rate':ratio(sum(r['prediction'] is not None for r in amb),len(amb)),'hold_by_subtype':{s:{'n':sum(r['subtype']==s for r in holds),'false_activations':sum(r['subtype']==s and r['prediction'] is not None for r in holds)} for s in sorted({r['subtype'] for r in holds})},'query_timing':stats([r['elapsed_ms'] for r in pred]),'errors':sum(r['error'] is not None for r in pred)}

summary={v:{reg:{mode:{'overall':metrics(pr),'ja':metrics(pr,'ja'),'en':metrics(pr,'en')} for mode,pr in modes.items()} for reg,modes in regs.items()} for v,regs in all_results.items()}
rankings=[json.loads(s) for s in (HERE/'raw-rankings.jsonl').read_text().splitlines()]
raw_summary={}
for v in frozen['thresholds']:
    raw_summary[v]={}
    for reg in ('shape','primitive'):
        rr=[r for r in rankings if r['variant']==v and r['registry']==reg]
        raw_summary[v][reg]={}
        for lang in (None,'ja','en'):
            pp=[r for r in rr if r['group']=='positive' and (lang is None or r['lang']==lang)]
            exact=sum(bool(r['raw_top10']) and r['raw_top10'][0]['label']==r['expected'] for r in pp)
            raw_summary[v][reg][lang or 'overall']={'positive_n':len(pp),'raw_top1_exact_correct':exact,'raw_top1_exact_accuracy':ratio(exact,len(pp)),'expected_top3':sum(r['expected_rank'] is not None and r['expected_rank']<=3 for r in pp)}

agreements={}
for reg in ('shape','primitive'):
    tops={v:{r['id']:(r['raw_top10'][0]['label'] if r['raw_top10'] else None) for r in rankings if r['variant']==v and r['registry']==reg} for v in frozen['thresholds']}
    agreements[reg]={}
    for a,b in [('1024-float32','128-float32'),('1024-float32','128-float16'),('128-float32','128-float16')]:
        disagreements=[{'id':id,'left':tops[a][id],'right':tops[b][id]} for id in tops[a] if tops[a][id]!=tops[b][id]]
        agreements[reg][a+' vs '+b]={'same':len(tops[a])-len(disagreements),'total':len(tops[a]),'disagreements':disagreements}

label_coverage={}
for variant,regs in all_results.items():
    label_coverage[variant]={}
    for mode,pr in regs['shape'].items():
        pp=[r for r in pr if r['group']=='positive']
        label_coverage[variant][mode]={label:{'n':sum(r['expected_label']==label for r in pp),'accepted':sum(r['expected_label']==label and r['prediction'] is not None for r in pp),'exact_correct':sum(r['expected_label']==label and r['prediction']==label for r in pp)} for label in fixture['allowed_labels']}

report={'fixture_sha256':freeze['fixture_sha256'],'scoring_sha256':freeze['scoring_sha256'],'candidate_frozen_sha256':FROZEN_CAND_SHA,'metrics':summary,'raw_top1':raw_summary,'raw_top1_agreement':agreements,'positive_label_coverage':label_coverage,'load_timing_ms':load_timings,'total_elapsed_ms':(time.perf_counter()-started)*1000,'exception_failures':failures,'overlap_count':len(overlaps),'scoring':'Independent frozen expected exact labels and explicit permitted_labels; candidate family graph not used. Ambiguous rows excluded from correctness denominators. No threshold/fixture tuning.'}
write_new(HERE/'summary.json',report)
write_new(HERE/'run-provenance.json',{'started_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runtime_python':sys.version,'evaluation_script_sha256':sha(HERE/'evaluate.py'),'candidate_runtime_sha256':sha(CAND/'retrieval_v2.py'),'model_manifest_sha256':sha(module.DEFAULT_LOCAL/'model-manifest.json'),'candidate_thresholds':frozen['thresholds'],'actual_query_calls':sum(len(pr) for regs in all_results.values() for modes in regs.values() for pr in modes.values()),'separate_raw_rank_calls':len(rankings),'input_delivery':'Every call receives the original full fixture text without shortening, translation, keyword extraction or prompting. Guard normalization recorded; tokenizer processing is frozen candidate behavior.','network':'No network calls or downloads made by evaluator. Local model assets read only.','platform_scope':'Locked-screen Mac, CPU-only Python process; query/load timings here do not measure whole-app resources or UI behavior.'})
print(json.dumps({'shape':{v:{mode:data['overall'] for mode,data in r['shape'].items()} for v,r in summary.items()},'primitive':{v:{mode:data['overall'] for mode,data in r['primitive'].items()} for v,r in summary.items()},'raw_top1':raw_summary,'overlap_count':len(overlaps),'exceptions':len(failures)},ensure_ascii=False,indent=2))
