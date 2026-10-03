"""Audit paired original wire bodies and saved CLI config; export no text/path."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
TARGETS = [("bonsai-1.7b-q1", "bonsai-1.7b-q1-resources-r1"),
           ("bonsai-4b-q1", "bonsai-4b-q1-resources-idle-r1")]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def options(command):
    result = {}
    index = 1
    while index < len(command):
        flag = command[index]
        if not flag.startswith("--") or flag in result:
            raise ValueError("unexpected_cli_form")
        if index + 1 < len(command) and not command[index + 1].startswith("--"):
            result[flag] = command[index + 1]
            index += 2
        else:
            result[flag] = True
            index += 1
    return result


def main():
    states = []
    for model_id, label in TARGETS:
        folder = HERE / "results-r1" / model_id
        if not (folder / "diagnosis-r1.json").exists():
            states.append({"model_id": model_id, "state": "not_scored_terminal"})
            continue
        base = REPO / ".local/small-model-sweep-v1"
        old = base / "raw-shape-only" / (model_id + "-shape-only-r1")
        new = base / "raw-resources" / label
        rows = []
        for path in sorted(new.glob("*-request.json")):
            before_path = old / path.name
            a = json.loads(before_path.read_text())
            b = json.loads(path.read_text())
            diff = {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
            rows.append({"case_id": path.name[:-13], "only_max_output_changed": diff == {"max_tokens"},
                "before_max_tokens": a.get("max_tokens"), "after_max_tokens": b.get("max_tokens"),
                "before_request_sha256": sha(before_path), "after_request_sha256": sha(path)})
        if len(rows) != 36 or not all(r["only_max_output_changed"] and r["before_max_tokens"] == 256 and r["after_max_tokens"] == 128 for r in rows):
            raise RuntimeError("wire_request_identity_failure")
        old_config = json.loads((old / "request-config.json").read_text())
        new_config = json.loads((new / "request-config.json").read_text())
        a, b = options(old_config["command"]), options(new_config["command"])
        cli_diff = {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
        cli_checks = {
            "executable_path_same": old_config["command"][0] == new_config["command"][0],
            "only_declared_cli_changes_except_port": cli_diff - {"--port"} == {"--ctx-size", "--batch-size", "--ubatch-size"},
            "context": a["--ctx-size"] == "2048" and b["--ctx-size"] == "1024",
            "batch": a["--batch-size"] == "256" and b["--batch-size"] == "64",
            "ubatch": a["--ubatch-size"] == "128" and b["--ubatch-size"] == "32",
            "frozen_prompt_same": old_config["prompt"] == new_config["prompt"],
            "only_id_and_text": all(set(row) == {"id", "text"} for row in new_config["cases"]),
            "same_fixture_text_order": old_config["cases"] == new_config["cases"],
        }
        if not all(cli_checks.values()):
            raise RuntimeError("cli_config_identity_failure")
        result = {"version": "resource-wire-cli-audit-r1", "model_id": model_id, "label": label,
            "requests": len(rows), "checks": cli_checks, "request_checks": rows,
            "before_config_sha256": sha(old / "request-config.json"), "after_config_sha256": sha(new / "request-config.json"),
            "scope": "Read-only paired requests/config. Export hashes and checks; no original input text, absolute paths or PID."}
        output = folder / "WIRE-CLI-AUDIT-R1.json"
        if output.exists():
            if json.loads(output.read_text()) != result:
                raise RuntimeError("saved_audit_drift")
        else:
            with output.open("x") as handle:
                handle.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        states.append({"model_id": model_id, "state": "wire_cli_verified", "requests": len(rows)})
    print(json.dumps(states))


if __name__ == "__main__":
    main()
