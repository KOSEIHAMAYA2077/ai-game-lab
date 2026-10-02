"""Independent arithmetic on reused author709; never a fresh-candidate run."""
import json
import math
from pathlib import Path

OWN = Path("experiments/native-static-japanese-review-v1")
AUTHOR = Path("experiments/native-static-japanese-v1")


def distance(actual, expected):
    if actual is None or expected is None:
        return 0.0 if actual is expected else math.inf
    if len(actual) != len(expected) or not all(math.isfinite(x) for x in actual):
        return math.inf
    return max((abs(a - b) for a, b in zip(actual, expected)), default=0.0)


def audit():
    expected = json.loads((AUTHOR / "EXPECTED-R1.json").read_text())
    native = json.loads((AUTHOR / "NATIVE-R5.json").read_text())
    index = {row["id"]: row for row in expected["cases"]}
    assert len(index) == len(expected["cases"]) == len(native["cases"]) == 709
    groups, failures = {}, []
    maxima = {"meanAbs": 0.0, "vectorAbs": 0.0, "scoreAbs": 0.0}
    for row in native["cases"]:
        original = index[row["id"]]
        ref, actual = original["expected"], row["encoding"]
        assert original["group"] == row["group"]
        checks = {"ids": actual["tokens"].get("ids") == ref["ids"],
                  "pieces": actual["tokens"].get("pieces") == ref["pieces"],
                  "normalization": actual["tokens"].get("normalization") == ref["normalization"],
                  "pretokenized": actual["tokens"].get("pretokenizedWholeNormalization") == ref["pretokenizedWholeNormalization"],
                  "hold": actual.get("hold") == ref["hold"]}
        mean = distance(actual.get("mean"), ref["mean"])
        vector = distance(actual.get("vector"), ref["vector"])
        maxima["meanAbs"] = max(maxima["meanAbs"], mean)
        maxima["vectorAbs"] = max(maxima["vectorAbs"], vector)
        checks["mean"] = mean <= 1e-5
        checks["vector"] = vector <= 1e-5
        for registry in ["shape", "primitive"]:
            actual_rank, ref_rank = row["ranks"][registry], ref["ranks"][registry]
            actual_by_label = {rank["label"]: rank for rank in actual_rank}
            ref_by_label = {rank["label"]: rank for rank in ref_rank}
            labelset = len(actual_by_label) == len(actual_rank) and actual_by_label.keys() == ref_by_label.keys()
            score = max((abs(actual_by_label[label]["score"] - rank["score"]) for label, rank in ref_by_label.items() if label in actual_by_label), default=0.0)
            maxima["scoreAbs"] = max(maxima["scoreAbs"], score)
            checks[registry + "Scores"] = labelset and score <= 1e-5 and all(math.isfinite(rank["score"]) for rank in actual_rank)
            checks[registry + "Top1"] = ([rank["label"] for rank in actual_rank[:1]] == [rank["label"] for rank in ref_rank[:1]])
            checks[registry + "FullOrderDiagnostic"] = [rank["label"] for rank in actual_rank] == [rank["label"] for rank in ref_rank]
            checks[registry + "CaptionChoiceDiagnostic"] = labelset and all(actual_by_label[label]["captionIndex"] == rank["captionIndex"] for label, rank in ref_by_label.items())
        group = groups.setdefault(row["group"], {"total": 0, "passed": 0})
        group["total"] += 1
        if all(checks.values()):
            group["passed"] += 1
        else:
            failures.append({"id": row["id"], "keys": [key for key, value in checks.items() if not value]})
    return {"version": "independent-saved-known709-arithmetic-r1", "nativeCalls": 0,
            "population": "Author known709 reused regression, not manual20 or additional4",
            "fixedAuthorNumericGate": 1e-5, "top1Gate": "exact", "groups": groups,
            "failures": failures, "maxima": maxima, "semanticEvaluation": False,
            "sourceExpectedFileUnchanged": True, "wholeAppRAM": False}


if __name__ == "__main__":
    result = audit()
    with (OWN / "KNOWN709-AUDIT-R1.json").open("x") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps({key: result[key] for key in ["nativeCalls", "groups", "failures", "maxima"]}))
