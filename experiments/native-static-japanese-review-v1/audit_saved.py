"""Read-only saved arithmetic and source SHA checks; native calls zero."""
import hashlib
import json
import runpy
from pathlib import Path

OWN = Path("experiments/native-static-japanese-review-v1")


def audit():
    comparator = runpy.run_path(str(OWN / "compare_r1.py"))["compare"]
    known_audit = runpy.run_path(str(OWN / "audit_known709_r2.py"))["audit"]
    native = json.loads((OWN / "NATIVE-FIRST-R1.json").read_text())
    reference = json.loads((OWN / "ORACLE-R2.json").read_text())
    saved = json.loads((OWN / "PARITY-FIRST-R1.json").read_text())
    expected = {row["id"]: row["result"] for rows in reference["groups"].values() for row in rows}
    calculated = [{"id": row["id"], "population": row["population"], **comparator(row["answer"], expected[row["id"]])} for row in native["rows"]]
    assert calculated == saved["rows"]
    assert native["candidateCallsSent"] == native["replies"] == 24
    assert native["processExitCode"] == 0 and native["failure"] is None
    assert native["stderr"] == "" and native["unexpectedStdoutTailBytes"] == 0
    pin = json.loads((OWN / "SOURCE-PIN-R1.json").read_text())
    for row in pin["publicFiles"] + pin["inputFiles"]:
        assert hashlib.sha256(Path(row["path"]).read_bytes()).hexdigest() == row["sha256"], row["path"]
    expected_known = json.loads((OWN / "KNOWN709-AUDIT-R2.json").read_text())
    assert known_audit() == expected_known
    original_fixtures = json.loads((OWN / "FREEZE-R1.json").read_text())["files"]
    for row in original_fixtures:
        assert hashlib.sha256((OWN / row["path"]).read_bytes()).hexdigest() == row["sha256"]
    return {"version": "saved-independent-native-static-audit-r1", "nativeCalls": 0,
            "manual20": saved["groups"]["manual20"], "specials4": saved["groups"]["artifactInformedSpecials4"],
            "known709SeparateTotal": sum(row["total"] for row in expected_known["groups"].values()),
            "sourceSHARechecked": len(pin["publicFiles"]) + len(pin["inputFiles"]),
            "recalculationDifferences": 0, "sourceDrift": 0, "originalMethodFixtureChanges": 0}


if __name__ == "__main__":
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
