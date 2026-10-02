"""Check color invariance without learning, threshold changes, or fixture tuning."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

folder = Path(__file__).resolve().parent
root = folder.parents[2]
sys.path.insert(0,str(root/'experiments/scaffold-program-v1/model'))
from config import relation_query
from predict import ProgramModel, clean_negation, normalize, relation_scope
from color_cases import cases, TEMPLATES


def projection(program):
    if program is None:
        return None
    return {"parts":[{key:part[key] for key in ["primitive","height","width","depth"]} for part in program["parts"]],"relation":program.get("relation")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir',type=Path,required=True)
    args = parser.parse_args()
    model = ProgramModel(args.model_dir)
    baseline = {t['name']:model.interpret(t['base']) for t in TEMPLATES}
    rows = []
    for case in cases():
        result = model.interpret(case['text'])
        base = baseline[case['template']]
        head_input = relation_query(relation_scope(clean_negation(normalize(case['text']))[0]))
        base_head_input = relation_query(relation_scope(clean_negation(normalize(case['base']))[0]))
        expected = result['program'] and [part['primitive'] for part in result['program']['parts']]==case['primitives'] and result['program']['relation']['kind']==case['relation']
        rows.append({**case,'reason':result['reason'],'headInput':head_input,'headInputUnchanged':head_input==base_head_input,'requiredStructureUnchanged':projection(result['program'])==projection(base['program']),'fullProgramUnchanged':result['program']==base['program'],'expectedAccepted':bool(expected),'result':result})
    report = {"label":"Metamorphic development/regression only; all inks × Japanese/English clauses × 3 relations; not independent accuracy","headSha256":hashlib.sha256((root/'experiments/scaffold-program-v1/model/relation-head.json').read_bytes()).hexdigest(),"rows":rows,"summary":{key:sum(row[key] for row in rows) for key in ['headInputUnchanged','requiredStructureUnchanged','fullProgramUnchanged','expectedAccepted']},"count":len(rows)}
    (folder/'metamorphic-cpu.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (folder/'cases.json').write_text(json.dumps({'cases':cases(),'templates':TEMPLATES},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'count':report['count'],'summary':report['summary'],'failures':[{'text':row['text'],'reason':row['reason'],'headInput':row['headInput']} for row in rows if not row['expectedAccepted'] or not row['requiredStructureUnchanged']]},ensure_ascii=False))


if __name__=='__main__':
    main()
