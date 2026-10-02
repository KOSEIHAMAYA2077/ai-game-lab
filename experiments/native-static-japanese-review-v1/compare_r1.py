"""Saved-output arithmetic only. No native calls and no tuning."""
import json
import math
from pathlib import Path

OWN = Path("experiments/native-static-japanese-review-v1")


def error(actual, expected):
    if not isinstance(actual, list) or len(actual) != len(expected):
        return None
    if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in actual):
        return None
    return max((abs(a - b) for a, b in zip(actual, expected)), default=0.0)


def compare(answer, reference):
    actual = answer["encoding"]
    expected = reference["encoding"]
    tokens = actual["tokens"]
    checks = {}
    checks["idsExact"] = tokens.get("ids") == expected["ids"]
    checks["piecesExactDiagnostic"] = tokens.get("pieces") == expected["pieces"]
    checks["normalizationExact"] = tokens.get("normalization") == expected["normalization"]
    checks["pretokenizedWholeExactDiagnostic"] = tokens.get("pretokenizedWholeNormalization") == expected["pretokenizedWholeNormalization"]
    checks["unknownFraction"] = abs(actual["unknownFraction"] - expected["unknownFraction"]) <= 1e-12
    checks["holdSame"] = actual.get("hold") == expected["hold"]
    mean_error = error(actual.get("mean"), expected["mean"])
    checks["meanBound"] = mean_error is not None and mean_error <= 1e-6
    vector_error = None
    if expected["hold"] is not None:
        checks["vectorState"] = actual.get("vector") is None and answer["ranks"] == []
    else:
        vector_error = error(actual.get("vector"), expected["vector"])
        checks["vectorState"] = vector_error is not None and vector_error <= 1e-5
    actual_ranks, expected_ranks = answer["ranks"], reference["ranks"]
    actual_by_label = {row["label"]: row for row in actual_ranks}
    expected_by_label = {row["label"]: row for row in expected_ranks}
    checks["rankLabelSet"] = len(actual_by_label) == len(actual_ranks) and actual_by_label.keys() == expected_by_label.keys()
    score_error = max((abs(actual_by_label[label]["score"] - row["score"]) for label, row in expected_by_label.items() if label in actual_by_label), default=0.0)
    checks["rankScores"] = checks["rankLabelSet"] and score_error <= 1e-5 and all(math.isfinite(row["score"]) for row in actual_ranks)
    caption_lookup = {row["captionIndex"]: row for row in reference["captionScores"]}
    caption_checks = []
    for label, row in actual_by_label.items():
        best = expected_by_label.get(label)
        selected = caption_lookup.get(row["captionIndex"])
        caption_checks.append(best is not None and selected is not None and selected["label"] == label and
                              (row["captionIndex"] == best["captionIndex"] or best["score"] - selected["score"] <= 2e-5))
    checks["captionIndexWithinFrozenTie"] = checks["rankLabelSet"] and all(caption_checks)
    ordered = True
    if checks["rankLabelSet"]:
        for i, left in enumerate(actual_ranks):
            for right in actual_ranks[i + 1:]:
                if expected_by_label[right["label"]]["score"] - expected_by_label[left["label"]]["score"] > 2e-5:
                    ordered = False
    else:
        ordered = False
    checks["rankOrderWithinFrozenTie"] = ordered
    top = not actual_ranks and not expected_ranks
    if actual_ranks and expected_ranks and actual_ranks[0]["label"] in expected_by_label:
        top = expected_ranks[0]["score"] - expected_by_label[actual_ranks[0]["label"]]["score"] <= 2e-5
    checks["top1WithinFrozenTie"] = top
    # Pieces/pretokenized fields were frozen as useful exact diagnostics, not new gate additions.
    diagnostics = ["piecesExactDiagnostic", "pretokenizedWholeExactDiagnostic"]
    required = {key: value for key, value in checks.items() if key not in diagnostics}
    return {"passed": all(required.values()), "checks": checks, "meanAbsMax": mean_error,
            "vectorAbsMax": vector_error, "scoreAbsMax": score_error,
            "failureKeys": [key for key, value in required.items() if not value]}


def main():
    native = json.loads((OWN / "NATIVE-FIRST-R1.json").read_text())
    oracle = json.loads((OWN / "ORACLE-R2.json").read_text())
    index = {row["id"]: row["result"] for rows in oracle["groups"].values() for row in rows}
    rows = [{"id": row["id"], "population": row["population"], **compare(row["answer"], index[row["id"]])} for row in native["rows"]]
    groups = {population: {"total": sum(row["population"] == population for row in rows),
                           "passed": sum(row["population"] == population and row["passed"] for row in rows)} for population in oracle["groups"]}
    summary = {"version": "independent-native-static-parity-r1", "groups": groups, "rows": rows,
               "nativeProcessExitCode": native["processExitCode"], "nativeFailure": native["failure"],
               "candidateRetuning": 0, "originalFixtureChanges": 0, "thresholdChanges": 0,
               "semanticEvaluation": False, "humanEvaluation": False, "wholeWidgetRAM": False}
    with (OWN / "PARITY-FIRST-R1.json").open("x") as stream:
        json.dump(summary, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"groups": groups, "failures": [{"id": row["id"], "keys": row["failureKeys"]} for row in rows if not row["passed"]]}))


if __name__ == "__main__":
    main()
