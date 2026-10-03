#!/usr/bin/env python3
"""Compare frozen candidate ingredients; no final evaluation inputs/predictions."""
import collections,hashlib,json,pathlib,sys
REVIEW=pathlib.Path(__file__).resolve().parent;TASK=REVIEW.parent
sys.dont_write_bytecode=True
from check_parity import normalize,sha

def load(path):return json.loads(path.read_text())
def rowkey(row):return (row['head'],normalize(row['text']),row['label'],row['split'],row['family'],row['source'])
def main():
    baseline=load(TASK/'artifacts/seed-corpus.json');base_model=load(TASK/'artifacts/seed-model.json');base_report=load(TASK/'artifacts/seed-training.json');findings=[];issues=[]
    for kind,run in [('bonsai4','r2'),('bonsai8','r3')]:
        path=TASK/'artifacts'/f'{kind}-corpus.json'
        if not path.exists():continue
        corpus=load(path);model=load(TASK/'artifacts'/f'{kind}-model.json');report=load(TASK/'artifacts'/f'{kind}-training.json');curated=load(TASK/'teacher'/f'curated-{run}.json');accepted=[r for r in curated if r['accepted']]
        specs=load(TASK/'seeds/shapes.json');train_lookup={(s['shape'],d['family']):d['text'] for s in specs for d in s['descriptions'] if d['split']=='train'}
        raw_path=TASK/'teacher'/f'raw-{run}.jsonl';raw=[json.loads(line) for line in raw_path.read_text().splitlines() if line];raw_lookup={(r['shape'],r['sourceFamily'],r['text']):r for r in raw}
        accepted_provenance=[]
        for r in accepted:
            key=(r['shape'],r['sourceFamily']);origin=raw_lookup.get((r['shape'],r['sourceFamily'],r['text']))
            ok=key in train_lookup and origin is not None and origin['sourceText']==train_lookup[key]
            accepted_provenance.append(ok)
            if not ok:issues.append(dict(kind=kind,check='accepted_teacher_provenance',shape=r['shape'],family=r['sourceFamily']))
        extra=[r for r in corpus if r['source']=='bonsai-caption-ai-reviewed'];seed_rows=[r for r in corpus if r['source']=='ai-authored-seed'];baseline_set=set(map(rowkey,baseline));seed_set=set(map(rowkey,seed_rows))
        if seed_set!=baseline_set:issues.append(dict(kind=kind,check='seed_rows_changed',removed=len(baseline_set-seed_set),added=len(seed_set-baseline_set)))
        if any(r['head']!='shape' or r['split']!='train' for r in extra):issues.append(dict(kind=kind,check='teacher_nonshape_or_dev'))
        provenance_count=0
        for r in extra:
            matches=[]
            for a in accepted:
                family=a['shape']+'/'+a['sourceFamily']+'/teacher-'+run
                validtexts={wrapper.format(a['text']) for wrapper in ['{}','{}のような形','{}を表現したい','形は{}']}
                if r['family']==family and r['label']==a['shape'] and r['text'] in validtexts:matches.append(a)
            if len(matches)==1:provenance_count+=1
            else:issues.append(dict(kind=kind,check='teacher_row_not_unique_accepted_source',family=r['family']))
        equal_attrs={head:model['heads'][head]==base_model['heads'][head] for head in ['length','width','bend']}
        same_config={key:model[key]==base_model[key] for key in ['dimensions','ngramMin','ngramMax','normalization','hash','seed','epochs']}
        dev_rows_equal={head:{rowkey(r) for r in baseline if r['head']==head and r['split']=='dev'}=={rowkey(r) for r in corpus if r['head']==head and r['split']=='dev'} for head in ['shape','length','width','bend']}
        if not all(equal_attrs.values()):issues.append(dict(kind=kind,check='attribute_models_changed'))
        if not all(same_config.values()):issues.append(dict(kind=kind,check='training_or_feature_config_changed'))
        if not all(dev_rows_equal.values()):issues.append(dict(kind=kind,check='dev_rows_changed'))
        findings.append(dict(kind=kind,teacherRun=run,acceptedTeacherCaptions=len(accepted),extraShapeTrainRows=len(extra),extraTeacherProvenanceVerified=provenance_count,acceptedCaptionProvenanceAllTrain=all(accepted_provenance),seedRowsIdentical=seed_set==baseline_set,attributeHeadsByteIdentical=equal_attrs,configurationIdentical=same_config,devRowsIdentical=dev_rows_equal,devTop1Correct={head:report[head]['devTop1Correct'] for head in ['shape','length','width','bend']},baselineDevTop1Correct={head:base_report[head]['devTop1Correct'] for head in ['shape','length','width','bend']},gate=report['gating']['selected'],baselineGate=base_report['gating']['selected'],files={str(f.relative_to(TASK)):sha(f) for f in [path,TASK/'artifacts'/f'{kind}-model.json',TASK/'artifacts'/f'{kind}-training.json',TASK/'teacher'/f'curated-{run}.json',raw_path]}))
    result=dict(candidates=findings,issues=issues,baselineCorpusSha256=sha(TASK/'artifacts/seed-corpus.json'),baselineModelSha256=sha(TASK/'artifacts/seed-model.json'),scope='Teacher/corpus/development only. No frozen evaluation data. Byte-identical attrs/config/dev data isolate the comparison to extra shape training captions and resulting shape fit/dev-selected gate. This is output-based supervision, not an isolated soft-target/logit distillation claim.')
    (REVIEW/'candidate-effect-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
