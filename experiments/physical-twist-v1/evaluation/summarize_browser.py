"""Regression and metamorphic scoring; no new unknown-language accuracy claim."""
import argparse
import json
from pathlib import Path
from score import score, summarize, quantile

D = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--run', default='browser-ui-physical-1')
a = p.parse_args()
raw = json.loads((D / f'{a.run}.json').read_text())
groups = []
for fixture_info in raw['fixtures']:
    fixture = fixture_info['file']
    cases = {c['id']: c for c in json.loads((D / fixture).read_text())['cases']}
    rows = []
    for row in raw['rows']:
        if row['fixture'] != fixture:
            continue
        value = {**row, **score(cases[row['id']], row['output'], row['error'])}
        value['geometryRejected'] = row['output'].get('reason') == 'unsupported-relation-geometry'
        rows.append(value)
    summary = summarize(rows)
    durations = [r['timing']['totalMs'] for r in rows]
    summary.update(uiCompletionP50Ms=quantile(durations, .5),
                   uiCompletionP95Ms=quantile(durations, .95),
                   uiCompletionMaxMs=max(durations),
                   geometryRejected=sum(r['geometryRejected'] for r in rows))
    groups.append({'fixture': fixture, 'summary': summary, 'rows': rows})

color_cases = {c['id']: c for c in json.loads((D / 'color-metamorphic.json').read_text())['cases']}
color_rows = {r['id']: r for r in raw['rows'] if r['fixture'] == 'color-metamorphic.json'}
colors = []
for id, row in color_rows.items():
    case = color_cases[id]
    base = color_rows[case['baseId']]['output']
    colors.append({'id': id, 'baseId': case['baseId'],
                   'sameProgramAsBase': row['output']['program'] == base['program'],
                   'sameReasonAsBase': row['output']['reason'] == base['reason'],
                   'sameSourceAsBase': row['output']['source'] == base['source'],
                   'originalTextPreserved': row['batchData'][-1]['text'] == case['text'],
                   'requestedInkPreserved': case['ink'] == 'none' or row['batchData'][-1]['ink'] == case['ink']})
color_summary = {'cases': len(colors), **{k: sum(r[k] for r in colors) for k in
                 ['sameProgramAsBase', 'sameReasonAsBase', 'sameSourceAsBase', 'originalTextPreserved', 'requestedInkPreserved']}}

white_rows = [r for r in raw['rows'] if r['fixture'] == 'white-history']
white_case = {'expected': {'parts': [
    {'primitive': 'tube', 'attributes': {'width': {'max': .9}, 'depth': {'max': .9}}},
    {'primitive': 'sphere', 'attributes': {'height': {'min': 1.1}, 'width': {'min': 1.1}, 'depth': {'min': 1.1}}}],
    'relation': 'end'}}
white_checks = []
if len(white_rows) == 2:
    first, second = white_rows
    white_checks = [{'id': first['id'], **score(white_case, first['output'], first['error']),
                     'whiteAddedBatch': first['batchData'][-1]['ink'] == 'white'},
                    {'id': second['id'], 'blueAddedBatch': second['batchData'][-1]['ink'] == 'blue',
                     'whiteBatchRetained': second['batchData'][-2]['ink'] == 'white',
                     'oldBatchInksRetained': second['previousBatchInksRetained'],
                     'oldCharactersRetained': second['previousCharactersRetained']}]

old_file = D.parents[1] / 'scaffold-program-v1/evaluation/browser-ui-2-scored.json'
old = json.loads(old_file.read_text())
old_rows = {r['id']: r for f in old['fixtures'] for r in f['rows']}
comparisons = []
for f in groups[:3]:
    for row in f['rows']:
        previous = old_rows[row['id']]
        comparisons.append({'id': row['id'], 'oldMeaningPass': previous['meaningPass'],
                            'newMeaningPass': row['meaningPass'],
                            'programUnchanged': previous['output']['program'] == row['output']['program']})
history = [r for r in raw['rows'] if r['fixture'] == 'history-sequence']
report = {'runId': a.run, 'evaluationUse': 'Previously evaluated language fixtures used for regression; independent frozen color metamorphism. Not unseen-language accuracy.',
          'summary': raw['summary'], 'fixtures': groups, 'colorMetamorphic': {'summary': color_summary, 'rows': colors},
          'whiteHistory': white_checks,
          'v013Comparison': {'cases': len(comparisons), 'improved': sum(not r['oldMeaningPass'] and r['newMeaningPass'] for r in comparisons),
                             'regressed': sum(r['oldMeaningPass'] and not r['newMeaningPass'] for r in comparisons),
                             'programUnchanged': sum(r['programUnchanged'] for r in comparisons), 'rows': comparisons},
          'historySequence': {'cases': len(history), 'charactersBatchesAndInksRetained': sum(r['previousCharactersRetained'] and r['previousBatchesRetained'] and r['previousBatchInksRetained'] for r in history)},
          'cold': raw['cold'], 'warm': raw['warm'], 'stress': raw['stress'],
          'errors': raw['errors'], 'distributionUnchanged': raw['distributionUnchanged'], 'limitations': raw['limitations']}
out = D / f'{a.run}-scored.json'
if out.exists():
    raise SystemExit('Refusing overwrite')
out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['fixtures', 'stress']}, ensure_ascii=False, indent=2))
print(json.dumps([{'fixture': f['fixture'], 'summary': f['summary']} for f in groups], ensure_ascii=False, indent=2))
