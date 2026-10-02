"""Descriptive post-freeze analysis only; never selects or adjusts a threshold."""
from pathlib import Path
import json, hashlib, collections

HERE=Path(__file__).resolve().parent
def read_lines(name):return [json.loads(s) for s in (HERE/name).read_text().splitlines()]
def write_new(name,data):
    with (HERE/name).open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n')
def ratio(a,b):return a/b if b else None
def metrics(rows):
    pos=[r for r in rows if r['group']=='positive'];hold=[r for r in rows if r['group']=='hold'];amb=[r for r in rows if r['group']=='ambiguous']
    acc=[r for r in pos if r['prediction'] is not None]
    correct=sum(r['prediction']==r['expected_label'] for r in acc)
    family=sum(r['prediction'] in r['permitted_labels'] for r in acc)
    false=sum(r['prediction'] is not None for r in hold)
    return {'positive_n':len(pos),'positive_accepted':len(acc),'positive_exact_correct':correct,'positive_family_correct':family,'positive_coverage':ratio(len(acc),len(pos)),'positive_exact_accuracy':ratio(correct,len(pos)),'positive_accepted_exact_precision':ratio(correct,len(acc)),'positive_accepted_family_precision':ratio(family,len(acc)),'hold_n':len(hold),'hold_false_activations':false,'accepted_unambiguous_exact_precision':ratio(correct,len(acc)+false),'ambiguous_n':len(amb),'ambiguous_accepted':sum(r['prediction'] is not None for r in amb),'hold_by_subtype':{s:{'n':sum(r['subtype']==s for r in hold),'false_activations':sum(r['subtype']==s and r['prediction'] is not None for r in hold)} for s in sorted({r['subtype'] for r in hold})}}

raw=read_lines('raw-predictions.jsonl');ranks=read_lines('raw-rankings.jsonl');rules=read_lines('authored-rules-raw.jsonl')
fixture=json.loads((HERE/'fixture.json').read_text())
frozen=json.loads((HERE/'frozen-fixture.json').read_text())
summary=json.loads((HERE/'summary.json').read_text())
conflicts=[{'id':'ja-P25','expected_label':'shell','author_intent':'fan-shaped ridged shell','catalog_or_caption':'Authored catalog shell is 巻き貝; caption describes spiral shell.','severity':'object subtype differs; exact label has unclear adequacy'}, {'id':'ja-P34','expected_label':'bolt','author_intent':'threaded fastener with hexagonal head','catalog_or_caption':'Authored catalog bolt is 稲妻; caption describes lightning zigzag.','severity':'different word sense; expected exact label is not an adequate object mapping'}, {'id':'en-P24','expected_label':'ribbon','author_intent':'open curling strip, ends unjoined','catalog_or_caption':'Candidate description specifies tied bow loops; catalog aliases include 蝶結び.','severity':'ribbon may mean strip or bow; object subtype differs'}]
excluded={r['id'] for r in conflicts}
supplement={}
for v in summary['metrics']:
    supplement[v]={}
    for mode in ('retrieval_only','guarded'):
        rr=[r for r in raw if r['variant']==v and r['registry']=='shape' and r['mode']==mode and r['id'] not in excluded]
        supplement[v][mode]={'overall':metrics(rr),'ja':metrics([r for r in rr if r['lang']=='ja']),'en':metrics([r for r in rr if r['lang']=='en'])}
write_new('mapping-audit.json',{'audit_timing':'After fixture and candidate freeze, on first candidate/source-catalog access. Never edits frozen expected labels.','human_validation':False,'conflicts':conflicts,'primary_scoring':'All original80positives/40holds/20ambiguous are preserved in summary.json.','supplemental_scope':'Three meaning/subtype conflicts excluded from a descriptive sensitivity subset only:77positives,40holds,20ambiguous;57 unique expected labels. This exclusion was not prospectively frozen and is not a replacement headline benchmark.','sensitivity_metrics':supplement,'remaining_scope':'The remaining77 mappings still lack human validation; their renderer fidelity was not checked. Abstract event/diagram analogues are included, so all60label coverage is not a claim that every row is a volumetric object.'})

baseline={}
for key in ('shape_only_prediction','recognized_scene_prediction'):
    pred=[{**r,'prediction':r[key]} for r in rules]
    baseline[key]={'overall':metrics(pred),'ja':metrics([r for r in pred if r['lang']=='ja']),'en':metrics([r for r in pred if r['lang']=='en']),'candidate_ambiguity_rows':sum(r['choice_ambiguity'] for r in pred),'candidate_ambiguity_positive_rows':sum(r['choice_ambiguity'] and r['group']=='positive' for r in pred),'mapping_sensitivity_77':metrics([r for r in pred if r['id'] not in excluded])}
write_new('authored-rules-summary.json',baseline)

raw_family={}
fixture_byid={r['id']:r for r in fixture['rows']}
for v in summary['metrics']:
    pp=[r for r in ranks if r['variant']==v and r['registry']=='shape' and r['group']=='positive']
    raw_family[v]={'exact_correct':sum(r['raw_top10'][0]['label']==r['expected'] for r in pp),'permitted_family_correct':sum(r['raw_top10'][0]['label'] in fixture_byid[r['id']]['permitted_labels'] for r in pp),'n':len(pp)}

paired=set([f'{lang}-P{i:02}' for lang in ('ja','en') for i in range(1,8)])
paired_results={v:{mode:{lang:metrics([r for r in raw if r['variant']==v and r['registry']=='shape' and r['mode']==mode and r['id'] in paired and r['lang']==lang]) for lang in ('ja','en')} for mode in ('retrieval_only','guarded')} for v in summary['metrics']}

failures={'accepted_wrong_positives':[r for r in raw if r['group']=='positive' and r['prediction'] is not None and r['prediction']!=r['expected_label']], 'clear_hold_false_activations':[r for r in raw if r['group']=='hold' and r['prediction'] is not None], 'selected_128_guarded_rejected_positives':[r for r in raw if r['variant']=='128-float32' and r['registry']=='shape' and r['mode']=='guarded' and r['group']=='positive' and r['prediction'] is None]}
write_new('failure-cases.json',failures)

competition={}
for v in ('1024-float32','128-float32'):
    competition[v]=[{k:r[k] for k in ('id','actual_query','expected','expected_rank','expected_score','raw_top10')} for r in ranks if r['variant']==v and r['registry']=='shape' and r['id'] in {'en-P01','en-P02','en-P08','en-P33','ja-P30','ja-P32'}]

write_new('supplemental-analysis.json',{'raw_top1_exact_vs_permitted_family':raw_family,'matched_first_seven_labels_note':'JA/EN each7positives cover the same exactlabels(condense,cube,cuboid,cylinder,ring,sword,vase), with different independently authored sentences. Descriptive, not paired translations or a pure language-isolation study.','matched_first_seven_labels':paired_results,'caption_competition_examples':competition,'method_note':'Each label takes the maximum across its own captions; same-label captions are collapsed before the top-two-label margin. Different labels/aliases can compete: square descriptions in cube requests, flowers inside a vase request, Japanese くも cloud versus spider, and incidental glass versus hourglass. Caption-count differences also mean maximum aggregation is not uniform across labels.','risk_vs_coverage':'Only the two pre-frozen operating modes are compared. Their thresholds differ as well as guard behavior; no post-hoc grid search or tuned operating point is selected.'})

def pct(x):return '—' if x is None else f'{100*x:.1f}%'
lines=['# Independent synthetic static retrieval evaluation v1','',
'The frozen 128-float32 guarded candidate correctly accepted 23/80 clear requests and falsely activated on 3/40 clear holds. Its positive accepted precision was 23/23 (100%), but accepted precision including clear holds was 23/26 (88.5%). This is evidence for a conservative experimental retrieval option, not a default general Japanese/English intent parser. English coverage was only 2/40 (5%). No app adoption or UI/play/resource validation was performed.','',
'The fixture was AI/manual authored without human annotation. 140 original full sentences contain 80 positive requests, 40 clear holds and 20 ambiguous descriptions; each stratum is JA/EN balanced. All 60 enum labels are represented, but three post-freeze meaning/subtype conflicts and abstract/flat authored shapes limit that coverage claim. Positive words include periphrases, colloquials and intentional typos. Scores are subjective intent-to-authored-label judgments, not human agreement.','',
f'Fixture SHA-256: `{frozen["fixture_sha256"]}`. Scoring SHA-256: `{frozen["scoring_sha256"]}`. Candidate frozen manifest SHA-256: `{summary["candidate_frozen_sha256"]}`. All sentences and scoring prose were authored before candidate-interface information arrived; hashes were recorded after that interface message but before any candidate source, numeric threshold, calibration, caption, or result access. This chronology is disclosed in frozen-fixture.json. No tuning followed evaluation.','',
'## All frozen rows: 60-label retrieval','',
'| Variant/mode | Exact positive | Permitted-family | Coverage | Accepted positive precision | Clear-hold activation | Accepted unambiguous precision | Ambiguous accepted |',
'|---|---:|---:|---:|---:|---:|---:|---:|']
for v in summary['metrics']:
    for mode in ('retrieval_only','guarded'):
        x=summary['metrics'][v]['shape'][mode]['overall']
        lines.append(f'| {v}/{mode} | {x["positive_exact_correct"]}/80 | {x["positive_family_correct"]}/80 | {x["positive_accepted"]}/80 ({pct(x["positive_coverage"])}) | {pct(x["positive_accepted_exact_precision"])} | {x["hold_false_activations"]}/40 | {pct(x["accepted_unambiguous_exact_precision"])} | {x["ambiguous_accepted"]}/20 |')
lines+=['','Only cube/cuboid had prospectively permitted family relaxation. No ring/Möbius, generic flower/rose, animal-family, or broad solid-family equivalence was granted. Exact and permitted-family accepted counts happen to be equal; this does not justify merging labels. Ambiguous acceptance has no correctness target.','',
'| Variant | Raw top1 exact | Raw top1 permitted family | JA raw top1 | EN raw top1 |',
'|---|---:|---:|---:|---:|']
for v in summary['raw_top1']:
    x=summary['raw_top1'][v]['shape'];lines.append(f'| {v} | {x["overall"]["raw_top1_exact_correct"]}/80 | {raw_family[v]["permitted_family_correct"]}/80 | {x["ja"]["raw_top1_exact_correct"]}/40 | {x["en"]["raw_top1_exact_correct"]}/40 |')
lines+=['','The 1024 and 128-float32 raw top1 choices agree on '+str(summary['raw_top1_agreement']['shape']['1024-float32 vs 128-float32']['same'])+'/140 full inputs. Float16 and 128-float32 agree on '+str(summary['raw_top1_agreement']['shape']['128-float32 vs 128-float16']['same'])+'/140 inputs. All thresholded accepted/hold decisions matched between 128-float32 and float16 across both registries/modes. Raw top1 differed on en-P30 (snake versus fireworks), which both variants held. These observations do not prove universal equivalence.','',
'## Japanese and English at frozen guard modes','',
'| Variant/language | Exact positive | Accepted positive | Positive accepted precision | Hold activation | Accepted unambiguous precision |',
'|---|---:|---:|---:|---:|---:|']
for v in ('1024-float32','128-float32','chargram'):
    for lang in ('ja','en'):
        x=summary['metrics'][v]['shape']['guarded'][lang];lines.append(f'| {v}/{lang} | {x["positive_exact_correct"]}/40 | {x["positive_accepted"]}/40 | {pct(x["positive_accepted_exact_precision"])} | {x["hold_false_activations"]}/20 | {pct(x["accepted_unambiguous_exact_precision"])} |')
lines+=['','JA and EN cover different distributions of labels and phrases: the first seven labels overlap, while many of the 60 labels are present only once in one language. This is not a controlled estimate of language-only effects. matched_first_seven_labels in supplemental-analysis.json reports the 14 requests sharing seven exact labels; those are different sentences rather than paired translations. All-language percentages depend on this synthetic distribution.','',
'## Same 60 authored-rule baseline','',
'| Baseline/language | Exact positive | Permitted-family | Positive accepted | Hold activation | Ambiguous accepted |',
'|---|---:|---:|---:|---:|---:|']
for lang in ('overall','ja','en'):
    x=baseline['shape_only_prediction'][lang];lines.append(f'| shapeChoices + interpret/{lang} | {x["positive_exact_correct"]}/{x["positive_n"]} | {x["positive_family_correct"]}/{x["positive_n"]} | {x["positive_accepted"]}/{x["positive_n"]} | {x["hold_false_activations"]}/{x["hold_n"]} | {x["ambiguous_accepted"]}/{x["ambiguous_n"]} |')
lines+=['','The shape baseline calls existing shapeChoices(full_text) and interpret(full_text, DEFAULT_SPEC), preserving the normal deterministic first-candidate behavior. It accepts only when shapeChoices selected at least one shape. All candidate lists and multiple-choice cases are saved. A separate recognized_scene_prediction diagnostic includes count/motion/color recognition that can retain the default sphere without selecting a new shape; it is not the main comparable shape-only baseline. No rules or app state were changed.','',
'## Separately mapped six-primitive subset','',
'Only 27 positive requests have an explicit prospectively frozen sphere/box/tube/ring/blade/vase mapping (JA7, EN20). No other authored shape is forced into this registry. All 40 clear hold and 20 ambiguous row was also submitted, giving 87 inputs per variant/mode.','',
'| Variant/mode | Primitive exact | Positive accepted | Positive accepted precision | Hold activation | Ambiguous accepted |',
'|---|---:|---:|---:|---:|---:|']
for v in summary['metrics']:
    for mode in ('retrieval_only','guarded'):
        x=summary['metrics'][v]['primitive'][mode]['overall'];lines.append(f'| {v}/{mode} | {x["positive_exact_correct"]}/27 | {x["positive_accepted"]}/27 | {pct(x["positive_accepted_exact_precision"])} | {x["hold_false_activations"]}/40 | {x["ambiguous_accepted"]}/20 |')
lines+=['','This six-way result is a separate retrieval task, not a 60-class model score. The candidate is not a trained head; fixed caption max-cosine retrieval and thresholding supply decisions.','',
'## Mapping validity and failure evidence','',
'Three post-freeze mapping conflicts remain in all original scores: ja-P25 fan-shaped shell versus authored spiral shell; ja-P34 threaded fastener versus authored lightning bolt; en-P24 open ribbon strip versus a tied bow caption. mapping-audit.json records these and a 77 positive sensitivity subset. This subset is post-hoc, not a replacement prospective score; the remaining mappings also lack human validation. Renderer fidelity is untested.','',
'| Variant/mode, mapping sensitivity | Exact positive | Positive accepted | Hold activation |',
'|---|---:|---:|---:|']
for v in ('1024-float32','128-float32'):
    for mode in ('retrieval_only','guarded'):
        x=supplement[v][mode]['overall'];lines.append(f'| {v}/{mode} | {x["positive_exact_correct"]}/77 | {x["positive_accepted"]}/77 | {x["hold_false_activations"]}/40 |')
lines+=['','The selected guarded 128 candidate still activates on ja-H02(`さっき剣って言ったけど取り消す。何も作らなくていい。`), ja-H09(the hypothetical quoted cube input), and ja-H20(the contradictory equal-edge/triple-edge box). These show missed cancellation language, quotation/mention intent, and geometric contradiction. A regex veto prevents some negatives, but also rejects legitimate single-object requests containing `with`, `and`, `without` or Japanese absence/relative phrases. For example, a vase whose bottom is closed and mouth open remains one object.','',
'1024 retrieval confused en-P01 smooth glass marble with hourglass; en-P02 solid die with square; and en-P33 misspelled flower vase with flower. Different label captions/aliases compete even when nouns describe parts or usecases. Each label collapses its own captions by maximum score before the top-two-label margin, so the margin is not between duplicate same-label captions; variable caption counts and broad aliases still influence competition. raw-rankings.jsonl and supplemental-analysis.json preserve top 10 and expected ranks/scores.','',
'Mean pooling cannot generally recover order or relational roles. The evaluator supplied full sentences exactly; no extracted short phrases inflated accuracy. Passing a word/description retrieval test is not evidence of understanding prohibition, negation scope, quotes, contradictory attributes, or composition. The guard_modes use separately calibrated fixed thresholds, so their changes combine threshold and rule effects. Only these pre-frozen operating points are compared; no post-hoc operating threshold was selected.','',
'## Provenance, timing, and scope','',
'Caption/alias and calibration full-text overlap was 0 under exact and Unicode-NFKC/lowercase/whitespace normalized complete-string comparisons. The audit covers all identifiable candidate task strings; pretrained training text is unavailable, so no pretraining non-overlap claim is made. Shared geometry labels, properties and short vocabulary are intentional. Raw decisions preserve actual full query text, guard-normalized text, scores, margins, timing, token metadata and interface hashes. No evaluation exceptions or stderr warnings occurred.','',
'Candidate loads including integrity checks and caption-index creation were '+', '.join(f'{v}:{ms:.1f}ms' for v,ms in summary['load_timing_ms'].items())+'. Query timings are in summary.json; setup/query results are CPU-process observations in the locked-screen multi-agent Mac session. They are not app RAM, idle CPU, screen behavior, IME, play quality or end-user latency measurements. No network was used by this evaluator.','',
'Retain the 128-float32 guarded variant as an optional experiment on explicitly requested known geometry and independently inspect its holds; do not promote it as a general semantic parser or default replacement. This fixture supports a limited conditional retrieval benefit but also shows sparse English acceptance and remaining false activation. Any attempted guard/caption/threshold improvements must use fresh independently authored prospective data; these 140 rows are now regression material.','',
'Files: fixture.json + frozen-fixture.json + SCORING_METHOD.md; raw-predictions.jsonl and raw-rankings.jsonl; summary.json; failure-cases.json; authored-rules-raw.jsonl/summary/provenance; mapping-audit.json; overlap-audit.json; supplemental-analysis.json; run-provenance.json.','']
with (HERE/'REPORT.md').open('x') as f:f.write('\n'.join(lines))
print(json.dumps({'baseline':baseline['shape_only_prediction'],'mapping_sensitivity':supplement,'raw_family':raw_family},ensure_ascii=False,indent=2))
