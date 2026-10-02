"""Read-only arithmetic/source audit from repository root. No model/AppKit/GPU call."""
import collections
import hashlib
import json
from pathlib import Path

OWN = Path("experiments/widget-metal-ambient-review-v1")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit():
    report = {"version": "saved-native-ambient-audit-r1", "callbacks": {}, "pins": {}}
    for name in ["CALLBACKS-R2-FIRST-R1.json", "CALLBACKS-EDITOR-R1-NEGATIVE-R1.json", "CALLBACKS-BUILD-R5-REGRESSION-R1.json"]:
        data = json.loads((OWN / name).read_text())
        groups = {}
        for group in data["groups"]:
            rows = [row for row in data["rows"] if row["group"] == group]
            groups[group] = {"passed": sum(row["passed"] for row in rows), "total": len(rows)}
        assert groups == data["groups"], name
        assert data["GPUOperations"] == 0
        assert not any(data[key] for key in ["actualWindow", "actualNativeIME", "globalOSInputCapture", "logsContainSyntheticText"])
        report["callbacks"][name] = groups
    for name in ["SOURCE-PIN-R1.json", "SOURCE-PIN-R2.json"]:
        pin = json.loads((OWN / name).read_text())
        for row in pin["checks"]:
            assert sha(Path(row["path"])) == row["sha256"], row["path"]
        report["pins"][name] = dict(collections.Counter(row["group"] for row in pin["checks"]))
    old = json.loads((OWN / "JSON-BOUNDARY-OLD-R2.json").read_text())
    new = json.loads((OWN / "JSON-BOUNDARY-NEW-R2.json").read_text())
    for data in [old, new]:
        assert data["sendErrorCount"] == len(data["sendErrors"])
        assert data["bodyCount"] == 256 and data["bodyUTF16"] == 65536
        assert all(data[key] for key in ["idsCorrect", "prefixChecks", "textsPreserved", "inkPreserved"])
        assert data["guardBudgetBytes"] == 256 * (256 * 6 + 64) + 8192
        assert data["nativeDecodedViewReencodedBytes"] == 139704
    assert old["sendErrorCount"] == 33 and new["sendErrorCount"] == 0
    assert old["firstSendError"] == {"commandIndex": 481, "op": "commit"}
    assert (OWN / "snapshot-r1/Glyphs.metal").read_bytes() == Path("desktop/glyph-metal-lab-v4/Sources/Glyphs.metal").read_bytes()
    report["knownGuardFailures"] = {"old": 33, "new": 0}
    report["fixedSchemaBudgetBytes"] = 417792
    report["teacherShaderByteMatch"] = True
    report["recalculationFailures"] = 0
    return report


if __name__ == "__main__":
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
