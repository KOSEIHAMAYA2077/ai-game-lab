from pathlib import Path
import json,hashlib,unicodedata,statistics,difflib
from collections import Counter,defaultdict

HERE=Path(__file__).resolve().parent
EXPERIMENT=HERE.parent

def read(path):return json.loads(path.read_text())
def dump(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def rate(correct,total):return {'correct':correct,'total':total,'rate':correct/total if total else None}
def select(rows,category):return [r for r in rows if r['category']==category]
def shape_score(rows):return rate(sum(r['shapeCorrect'] for r in rows),len(rows))
def attr_score(rows,key):return rate(sum(r['attributeCorrect'][key] for r in rows),len(rows))

def analyze():
    raw=[json.loads(s) for s in (HERE/'predictions.jsonl').read_text().splitlines()]
    run=read(HERE/'run-manifest.json')
    assert sha(HERE/'predictions.jsonl')==run['predictionsSHA256']
    assert sha(HERE/'frozen-cases.jsonl')==run['evaluationSHA256']
    assert len(raw)==244*6
    summary={}
    for method in run['methods']:
        rows=[r for r in raw if r['method']==method]
        assert len(rows)==244 and len({r['id'] for r in rows})==244
        positive=[r for r in rows if r['category']!='hold']
        modifier=select(rows,'modifier')
        descriptions=select(rows,'description')
        per_shape={s:shape_score([r for r in descriptions if r['primaryShape']==s]) for s in sorted({r['primaryShape'] for r in descriptions})}
        holds={}
        for sub in ['negation','unrelated']:
            subset=[r for r in rows if r.get('subcategory')==sub]
            holds[sub]={'falseReactions':sum(r['prediction']['shape']!='hold' for r in subset),'total':len(subset),'correctHold':shape_score(subset)}
        attributes={}
        for key,default in [('length','neutral'),('width','neutral'),('bend','straight')]:
            attributes[key]={
                'modifier24':attr_score(modifier,key),'all244':attr_score(rows,key),
                'nonDefaultOnly':attr_score([r for r in modifier if r['expected'][key]!=default],key),
                'labels':{label:attr_score([r for r in modifier if r['expected'][key]==label],key) for label in sorted({r['expected'][key] for r in modifier})},
            }
        times=sorted(r['prediction']['modelMs'] for r in rows)
        summary[method]={
            'shapeByCategory':{c:shape_score(select(rows,c)) for c in ['description','named','hold','modifier']},
            'shapeAll244':shape_score(rows),'shapePositive204':shape_score(positive),
            'descriptionMacro60':sum(x['rate'] for x in per_shape.values())/60,'descriptionByPrimaryShape':per_shape,
            'positiveOutcomes':{'correct':sum(r['shapeCorrect'] for r in positive),'missedAsHold':sum(r['prediction']['shape']=='hold' for r in positive),'wrongOtherShape':sum(not r['shapeCorrect'] and r['prediction']['shape']!='hold' for r in positive),'total':len(positive)},
            'hold':holds,'attributes':attributes,
            'jointAll244':rate(sum(r['jointCorrect'] for r in rows),len(rows)),
            'jointModifier24':rate(sum(r['jointCorrect'] for r in modifier),len(modifier)),
            'predictionTimeMs':{'p50':statistics.median(times),'p95NearestRank':times[231],'maximum':times[-1],'minimum':times[0],'samples':len(times),'scope':'Unwarmed API-internal timing; not end-to-end app latency'},
        }
    bymethod={m:{r['id']:r for r in raw if r['method']==m} for m in run['methods']}
    pairs={}
    for baseline,candidate in [('seed','bonsai4'),('seed','bonsai8'),('static-seed','static-bonsai8')]:
        details={}
        for category in ['description','named','hold','modifier','all']:
            ids=[i for i,r in bymethod[baseline].items() if category=='all' or r['category']==category]
            improved=[i for i in ids if not bymethod[baseline][i]['shapeCorrect'] and bymethod[candidate][i]['shapeCorrect']]
            regressed=[i for i in ids if bymethod[baseline][i]['shapeCorrect'] and not bymethod[candidate][i]['shapeCorrect']]
            details[category]={'improved':len(improved),'regressed':len(regressed),'net':len(improved)-len(regressed),'improvedIds':improved,'regressedIds':regressed,'total':len(ids)}
        pairs[baseline+'->'+candidate]=details
    dump(HERE/'metrics.json',{'methods':summary,'pairedShapeChanges':pairs,'evaluationSHA256':run['evaluationSHA256'],'predictionsSHA256':run['predictionsSHA256'],'provenance':'AI-authored/AI-labelled artificial holdout, not human evaluation'})
    for method,m in summary.items():
        compact={'method':method,'shape':{k:f"{v['correct']}/{v['total']}" for k,v in m['shapeByCategory'].items()},'positive':m['positiveOutcomes'],'holdFalse':{k:v['falseReactions'] for k,v in m['hold'].items()},'modifierHeads':{k:f"{v['modifier24']['correct']}/24" for k,v in m['attributes'].items()},'nonDefaultHeads':{k:v['nonDefaultOnly'] for k,v in m['attributes'].items()}}
        print(json.dumps(compact,ensure_ascii=False))

def normalize(s):
    return ''.join(c for c in unicodedata.normalize('NFKC',s).lower() if not c.isspace() and not unicodedata.category(c).startswith('P'))

def audit():
    evaluation=[json.loads(s) for s in (HERE/'frozen-cases.jsonl').read_text().splitlines()]
    norms={r['id']:normalize(r['text']) for r in evaluation}
    index=defaultdict(set)
    for row in evaluation:
        n=norms[row['id']]
        for i in range(len(n)-7):index[n[i:i+8]].add(row['id'])
    byid={r['id']:r for r in evaluation}
    audit_records=[]
    reports={}
    aliases={'seed-corpus.json':['seed','static-seed'],'bonsai4-corpus.json':['bonsai4'],'bonsai8-corpus.json':['bonsai8','static-bonsai8']}
    for filename,methods in aliases.items():
        path=EXPERIMENT/'artifacts'/filename
        source=read(path)
        groups={}
        for row in source:
            key=(row.get('split','unknown'),row.get('family','unknown'),row['text'])
            group=groups.setdefault(key,{'heads':set(),'labels':set()})
            group['heads'].add(row.get('head','unknown'));group['labels'].add(row.get('label','unknown'))
        per_split={}
        start=len(audit_records)
        eval_families={r['family'] for r in evaluation}
        for split in sorted({key[0] for key in groups}):
            selected=[(key,g) for key,g in groups.items() if key[0]==split]
            per_split[split]={'sourceRows':sum(r.get('split','unknown')==split for r in source),'uniqueTextFamilyRecords':len(selected),'uniqueTexts':len({key[2] for key,g in selected}),'exactFamilyIdOverlap':len(eval_families & {key[1] for key,g in selected})}
        for (split,family,text),group in groups.items():
            source_norm=normalize(text)
            ids=set()
            for i in range(len(source_norm)-7):ids.update(index.get(source_norm[i:i+8],()))
            # Full texts shorter than eight characters are still checked exactly.
            ids.update(r['id'] for r in evaluation if r['text']==text or norms[r['id']]==source_norm)
            for eid in sorted(ids):
                e=byid[eid];n=norms[eid]
                block=difflib.SequenceMatcher(None,n,source_norm,autojunk=False).find_longest_match()
                literal=e['text']==text;normalized=n==source_norm
                if block.size<8 and not literal and not normalized:continue
                coverage=block.size/min(len(n),len(source_norm)) if n and source_norm else 0
                audit_records.append({'evaluationId':eid,'evaluationCategory':e['category'],'evaluationText':e['text'],'corpusFile':filename,'sourceSplit':split,'sourceFamily':family,'sourceText':text,'sourceHeads':sorted(group['heads']),'sourceLabels':sorted(group['labels']),'literalExact':literal,'normalizedExact':normalized,'longestContiguousPhrase':n[block.a:block.a+block.size],'matchingChars':block.size,'shorterTextCoverage':coverage,'strongConfirmationTarget':block.size>=12 or (block.size>=8 and coverage>=.4)})
        current=audit_records[start:]
        for split,s in per_split.items():
            matches=[r for r in current if r['sourceSplit']==split]
            for name,field in [('literalExact','literalExact'),('normalizedExact','normalizedExact'),('strongPhrase','strongConfirmationTarget')]:
                selected=[r for r in matches if r[field]]
                s[name]={'pairs':len(selected),'evaluationCases':len({r['evaluationId'] for r in selected}),'evaluationIds':sorted({r['evaluationId'] for r in selected})}
            s['anyPhrase8']={'pairs':len(matches),'evaluationCases':len({r['evaluationId'] for r in matches})}
            s['maximumMatchingChars']=max((r['matchingChars'] for r in matches),default=0)
        reports[filename]={'sha256':sha(path),'methodsUsingCorpus':methods,'totalRows':len(source),'uniqueTextFamilyRecords':len(groups),'splits':per_split}
    out=HERE/'overlap-details.jsonl'
    out.write_text(''.join(json.dumps(r,ensure_ascii=False,separators=(',',':'))+'\n' for r in audit_records))
    result={'normalization':'NFKC + lowercase + whitespace and Unicode punctuation removal','phraseThresholdCharacters':8,'strongReviewCriterion':'12+ contiguous chars OR 8+ chars and >=40% of shorter normalized text','interpretation':'A substring match is a review flag, not proof of shared provenance or leakage. Matching natural shape features is expected in the same ontology. No candidate or label adjustments follow this audit.','corpora':reports,'detailsFile':out.name,'detailsSHA256':sha(out),'evaluationSHA256':sha(HERE/'frozen-cases.jsonl'),'candidateFreezeSHA256':sha(EXPERIMENT/'FREEZE.json'),'sameCorpusAliasChecks':{'static-seedEqualsSeed':sha(EXPERIMENT/'artifacts/static-seed-corpus.json')==sha(EXPERIMENT/'artifacts/seed-corpus.json'),'static-bonsai8EqualsBonsai8':sha(EXPERIMENT/'artifacts/static-bonsai8-corpus.json')==sha(EXPERIMENT/'artifacts/bonsai8-corpus.json')}}
    dump(HERE/'overlap-summary.json',result)
    print(json.dumps({'overlap':reports,'detailRecords':len(audit_records)},ensure_ascii=False))

if __name__=='__main__':
    analyze()
    audit()
