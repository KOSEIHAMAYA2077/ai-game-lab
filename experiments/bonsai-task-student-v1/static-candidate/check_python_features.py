#!/usr/bin/env python3
"""Feature-only exporter checks against the existing local Python encoder."""
import hashlib, importlib.util, json, pathlib, subprocess, sys
import numpy as np

sys.dont_write_bytecode = True
HERE = pathlib.Path(__file__).resolve().parent
TASK, REPO = HERE.parent, HERE.parents[2]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

def main():
    source = HERE / 'export_features.py'
    frozen_sha = json.loads((TASK / 'FREEZE.json').read_text())['files']['static-candidate/export_features.py']
    assert sha(source) == frozen_sha
    encoder = module(source, 'frozen_feature_exporter').StaticFeatureEncoder()
    oracle_source = REPO / 'experiments/static-japanese-retrieval-v1/retrieval.py'
    oracle = module(oracle_source, 'existing_feature_oracle').StaticEncoder(REPO / '.local/static-japanese-v1', '128-float16')
    fixtures = json.loads((TASK / 'training-review/parity-fixtures-r2.json').read_text())
    fixtures += [dict(id='added.mask', text='花瓶  <mask> 球体'), dict(id='added.special', text='<s>花瓶</s>'), dict(id='added.unk', text='<unk>')]
    rows, issues = [], []
    for fixture in fixtures:
        text = fixture['text']
        new = encoder.encode(text, True)
        if len(text) > 512:
            ok = new['hold'] == 'input_limit'
            rows.append(dict(id=fixture['id'], exporterContractOnly=True, hold=new['hold'], passCheck=ok))
            if not ok: issues.append(dict(id=fixture['id'], check='input_limit'))
            continue
        old, meta = oracle.encode(text)
        old_ids = oracle.tokenizer.encode(text, add_special_tokens=False).ids
        token_equal = old_ids == new['tokenIds']
        hold_equal = meta.get('hold') == new['hold']
        error = float(np.max(np.abs(old - np.asarray(new['vector'], np.float32)))) if old is not None and new['vector'] is not None else 0.
        finite = new['vector'] is None or bool(np.isfinite(new['vector']).all())
        ok = token_equal and hold_equal and finite and error <= 1e-7
        rows.append(dict(id=fixture['id'], tokenIdsEqual=token_equal, holdEqual=hold_equal, hold=new['hold'], tokenCount=new['tokenCount'], maxVectorError=error, allFinite=finite, passCheck=ok))
        if not ok: issues.append(dict(id=fixture['id'], check='existing_python_parity'))
    # Malformed/large records must not consume the valid following record.
    stream = [b'not-json\n', b'{}\n', b'{"id":"wrong-type","text":7}\n',
              json.dumps(dict(text='x' * 66000)).encode() + b'\n',
              json.dumps(dict(id='following', text='花瓶'), ensure_ascii=False).encode() + b'\n']
    replies = [json.loads(line) for line in subprocess.check_output([sys.executable, '-B', str(source)], input=b''.join(stream), cwd=REPO).splitlines()]
    holds = [r['hold'] for r in replies]
    if holds != ['invalid_json', 'invalid_request', 'input_limit', 'jsonl_line_limit', None] or replies[-1]['id'] != 'following' or len(replies[-1]['vector']) != 128:
        issues.append(dict(check='stream_boundary_recovery', holds=holds))
    result = dict(cases=len(rows), oracleCases=sum(not r.get('exporterContractOnly', False) for r in rows),
                  passed=sum(r['passCheck'] for r in rows), maxVectorError=max(r.get('maxVectorError', 0.) for r in rows),
                  jsonlBoundaryHolds=holds, exporterSha256=sha(source), frozenExporterUnchanged=sha(source) == frozen_sha,
                  oracleSha256=sha(oracle_source), metadata=encoder.metadata(), rows=rows, issues=issues,
                  scope='Feature-only checks on AI-authored train/dev examples and synthetic strings. Existing local model/table only; no task-head training, quality model selection, holdout read, downloads, or original source changes. No Swift/JS parity claim.')
    (HERE / 'python-feature-parity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ['rows', 'metadata']}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
