#!/usr/bin/env python3
"""Summarize the five frozen candidates on development rows only."""
import collections, hashlib, json, pathlib, statistics

HERE = pathlib.Path(__file__).resolve().parent
TASK = HERE.parent
KINDS = ['seed', 'bonsai4', 'bonsai8', 'static-seed', 'static-bonsai8']
DEFAULTS = dict(length='neutral', width='neutral', bend='straight')

def read(path):
    return json.loads(path.read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def accuracy(rows, prediction):
    correct = sum(r['label'] == prediction(r) for r in rows)
    return dict(count=len(rows), correct=correct,
                accuracy=correct / len(rows) if rows else None)

def group_name(row):
    return 'hold' if row['label'] == 'hold' else 'named' if '/name/' in row['family'] else 'nameFreeDescription'

def main():
    frozen = read(TASK / 'FREEZE.json')
    issues, candidates, file_hashes = [], [], {}
    base = read(TASK / 'artifacts/seed-corpus.json')
    for kind in KINDS:
        paths = {suffix: TASK / 'artifacts' / (kind + '-' + suffix + '.json')
                 for suffix in ['corpus', 'model', 'training']}
        corpus, model, report = (read(paths[key]) for key in ['corpus', 'model', 'training'])
        for path in paths.values():
            relative = str(path.relative_to(TASK))
            file_hashes[relative] = sha(path)
            if relative in frozen['files'] and file_hashes[relative] != frozen['files'][relative]:
                issues.append(dict(kind=kind, check='frozen_hash', file=relative))
        shape = report['shape']['predictions']
        gate = model['thresholds']
        def gated(r):
            rejected = r['score'] < gate['score'] or r['margin'] < gate['margin']
            rejected |= r.get('coverage', 1.) < gate.get('coverage', 0.)
            return 'hold' if rejected else r['prediction']
        grouped = {}
        for group in ['named', 'nameFreeDescription', 'hold']:
            rows = [r for r in shape if group_name(r) == group]
            grouped[group] = dict(raw=accuracy(rows, lambda r: r['prediction']),
                                  gated=accuracy(rows, gated),
                                  distinctSourceFamilies=len({r['family'] for r in rows}))
        shape_summary = dict(
            overallRaw=accuracy(shape, lambda r: r['prediction']),
            overallGated=accuracy(shape, gated), groups=grouped,
            equalGroupRawAccuracy=statistics.mean(g['raw']['accuracy'] for g in grouped.values()),
            equalGroupGatedAccuracy=statistics.mean(g['gated']['accuracy'] for g in grouped.values()),
            gate=gate, selectionObjective=report['shape'].get('selectionObjective', 'fixed training configuration; dev-only gate'))
        attrs = {}
        for head, default in DEFAULTS.items():
            rows = report[head]['predictions']
            labels = model['heads'][head]['labels']
            by_label = {label: accuracy([r for r in rows if r['label'] == label], lambda r: r['prediction']) for label in labels}
            attrs[head] = dict(
                overall=accuracy(rows, lambda r: r['prediction']), byLabel=by_label,
                macroPerLabelAccuracy=statistics.mean(g['accuracy'] for g in by_label.values()),
                defaultLabel=default,
                default=accuracy([r for r in rows if r['label'] == default], lambda r: r['prediction']),
                nonDefault=accuracy([r for r in rows if r['label'] != default], lambda r: r['prediction']),
                predictedLabels=dict(collections.Counter(r['prediction'] for r in rows)),
                selectionObjective=report[head].get('selectionObjective', 'fixed training configuration'))
        dev_equal = {}
        for head in ['shape'] + list(DEFAULTS):
            dev = [r for r in corpus if r['head'] == head and r['split'] == 'dev']
            reference = [r for r in base if r['head'] == head and r['split'] == 'dev']
            dev_equal[head] = dev == reference
            predicted = report[head]['predictions']
            if len(dev) != len(predicted) or any((r['text'], r['label'], r['family']) != (p['text'], p['label'], p['family']) for r, p in zip(dev, predicted)):
                issues.append(dict(kind=kind, head=head, check='predictions_not_exact_dev'))
            if not dev_equal[head]:
                issues.append(dict(kind=kind, head=head, check='dev_changed'))
        candidates.append(dict(kind=kind, modelSha256=file_hashes[str(paths['model'].relative_to(TASK))],
                               corpusSha256=file_hashes[str(paths['corpus'].relative_to(TASK))],
                               trainingReportSha256=file_hashes[str(paths['training'].relative_to(TASK))],
                               sameDevAsSeed=dev_equal, shape=shape_summary, attributes=attrs))
    for relative, expected in frozen['files'].items():
        if 'evaluation' in pathlib.Path(relative).parts:
            raise ValueError('unexpected evaluation path')
        file_hashes[relative] = sha(TASK / relative)
        if file_hashes[relative] != expected:
            issues.append(dict(check='frozen_hash', file=relative))
    result = dict(scope='AI-authored development set only. No holdout input or prediction read. Summaries use raw head predictions; shape gating is applied separately. Attr metrics are not end-to-end gated return values.',
                  units='Shape dev = 960 named modifier combinations + 60 held descriptive families x 4 wrappers + 12 hold sentences. Wrappers within a family are correlated, not independent semantic examples.',
                  defaultsContract='Absent whole-body length/width/bend instruction -> neutral/neutral/straight. Native narrow neck, long legs, or curved geometry is not an explicit global transform.',
                  freezeHashesMatch=not any(i['check'] == 'frozen_hash' for i in issues),
                  sameDevAllFive=all(all(c['sameDevAsSeed'].values()) for c in candidates),
                  candidates=candidates, sha256=file_hashes,
                  observedRuntimeSourceSha256={
                      str(path.relative_to(TASK.parents[1])): sha(path)
                      for path in [TASK.parents[1] / 'prototypes/glyph-creature/src/task-student-v1/inference.mjs']
                      if path.exists()}, issues=issues)
    (HERE / 'dev-grouped-all-five.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(issues=issues, rows=[dict(kind=c['kind'], shape=c['shape'], nonDefaultAttrs={h:a['nonDefault'] for h,a in c['attributes'].items()}) for c in candidates]), ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
