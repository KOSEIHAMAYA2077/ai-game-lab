#!/usr/bin/env python3
"""Summarize fixed prediction logs and diagnostic risk/coverage curves.

This does not write/reselect model thresholds. Diagnostic operating points are not
new test scores at a selected threshold and must never replace frozen headline.
"""
import argparse
import json
from pathlib import Path
from retrieval_v2 import HERE, metrics, alias_hits, write_new

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--predictions", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    data = json.loads(args.predictions.read_text())
    inventory = json.loads((HERE / "captions.json").read_text())["entries"]
    summary = {"source": args.predictions.name, "diagnosticsOnly": True, "frozenThresholdsUnchanged": True, "variants": {}}
    for variant, bymode in data["results"].items():
        variant_summary = {}
        for registry in ["shape", "primitive"]:
            rows = [r for r in bymode["retrieval_only"]["rows"] if r["registry"] == registry]
            if not rows:
                continue
            positives = [r for r in rows if r["target"] is not None]
            directfree = [r for r in positives if not alias_hits(r["text"], [e for e in inventory if e["registry"] == registry])]
            raw = [{"prediction": r["top"][0]["label"] if r["top"] else None} for r in rows]
            result = {"rawTop1": metrics(rows, raw, inventory),
                      "noExactAliasPositives": {"rows": len(directfree), "rawCorrect": sum(r["top"] and r["top"][0]["label"] == r["target"] for r in directfree)},
                      "frozenModes": {}, "riskCoverageDiagnostics": {}}
            for mode in ["retrieval_only", "guarded"]:
                selected = [r for r in bymode[mode]["rows"] if r["registry"] == registry]
                result["frozenModes"][mode] = metrics(selected, selected, inventory)
                points = []
                for score in [0.0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]:
                    for margin in [0.0, 0.04, 0.08, 0.15]:
                        predictions = []
                        for r in selected:
                            top = r["top"][0] if r["top"] else None
                            veto = mode == "guarded" and r["reason"] in ["authored_negation_veto", "authored_single_object_scope"]
                            label = top["label"] if top and not veto and top["score"] >= score and top["margin"] >= margin else None
                            predictions.append({"prediction": label})
                        report = metrics(selected, predictions, inventory)
                        points.append({"score": score, "margin": margin, "positiveCoverage": report["positiveCoverage"], "acceptedExactPrecision": report["acceptedExactPrecision"], "wrongPositive": report["wrongPositive"], "negativeFalsePositive": report["negativeFalsePositive"], "exactCorrect": report["exactCorrect"], "totalAccepted": report["positiveAccepted"] + report["negativeFalsePositive"]})
                result["riskCoverageDiagnostics"][mode] = points
            variant_summary[registry] = result
        summary["variants"][variant] = variant_summary
    write_new(args.output, summary)
    print(json.dumps({v: {reg: {"rawCorrect": r["rawTop1"]["exactCorrect"], "positiveRows": r["rawTop1"]["positiveRows"], "noAlias": r["noExactAliasPositives"], "frozen": {m: (s["exactCorrect"], s["positiveAccepted"], s["wrongPositive"], s["negativeFalsePositive"]) for m, s in r["frozenModes"].items()}} for reg,r in regs.items()} for v,regs in summary["variants"].items()}, ensure_ascii=False))

if __name__ == "__main__":
    main()
