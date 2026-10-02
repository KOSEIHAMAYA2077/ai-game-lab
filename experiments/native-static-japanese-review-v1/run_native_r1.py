"""First fixed-candidate calls; persistent non-TTY JSONL, synthetic inputs only."""
import datetime
import hashlib
import json
import selectors
import subprocess
import time
from pathlib import Path

OWN = Path("experiments/native-static-japanese-review-v1")
BINARY = Path("experiments/native-static-japanese-v1/native-static-r5")
EXPECTED_BINARY_SHA = "52b7ea7fc00d5413fe79ad85e56743e890c36ae2800b7095b7c47a853dde4c74"


def main():
    assert hashlib.sha256(BINARY.read_bytes()).hexdigest() == EXPECTED_BINARY_SHA
    assert not (OWN / "NATIVE-FIRST-R1.json").exists()
    populations = [("manual20", "CASES-R1.json"), ("artifactInformedSpecials4", "CASES-SPECIALS-R1.json")]
    rows, failure, sent = [], None, 0
    start = time.perf_counter()
    process = subprocess.Popen([str(BINARY)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    try:
        for population, filename in populations:
            for case in json.loads((OWN / filename).read_text())["cases"]:
                request = json.dumps({"text": case["text"], "registry": case["registry"]}, ensure_ascii=False).encode("utf-8") + b"\n"
                request_start = time.perf_counter()
                process.stdin.write(request)
                process.stdin.flush()
                sent += 1
                if not selector.select(15):
                    failure = {"kind": "reply-timeout", "id": case["id"], "seconds": 15}
                    raise RuntimeError("reply-timeout")
                line = process.stdout.readline()
                if not line:
                    failure = {"kind": "reply-eof", "id": case["id"]}
                    raise RuntimeError("reply-eof")
                answer = json.loads(line)
                rows.append({"id": case["id"], "population": population, "registry": case["registry"],
                             "driverRoundTripMs": (time.perf_counter() - request_start) * 1000,
                             "replyBytes": len(line), "answer": answer})
        process.stdin.close()
        exit_code = process.wait(timeout=15)
    except Exception as error:
        if failure is None:
            failure = {"kind": type(error).__name__, "message": str(error)}
        if process.poll() is None:
            process.terminate()  # Only this driver's owned child; no unrelated process.
        exit_code = process.wait(timeout=15)
    finally:
        selector.close()
    stderr = process.stderr.read().decode("utf-8", errors="replace")
    tail = process.stdout.read()
    report = {"version": "independent-native-static-first-call-r1", "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "candidateBinarySHA": EXPECTED_BINARY_SHA, "candidateCallsSent": sent, "replies": len(rows),
              "populations": {name: sum(row["population"] == name for row in rows) for name, filename in populations},
              "processExitCode": exit_code, "failure": failure, "stderr": stderr, "unexpectedStdoutTailBytes": len(tail),
              "wallSecondsIncludingChildStartupAndShutdown": time.perf_counter() - start,
              "rows": rows, "actualWindow": False, "GPU": False, "actualIME": False, "OSCapture": False,
              "inputSafetyScope": "Artificial only, max1024UTF16; untrustedJSONL framingbound absent in candidate.",
              "resourceScope": "Native self counters/short per-call component observation; not wholeapp, controlled coldcache,16GB,Windows,calm or longrun."}
    with (OWN / "NATIVE-FIRST-R1.json").open("x") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps({key: report[key] for key in ["candidateCallsSent", "replies", "populations", "processExitCode", "failure", "wallSecondsIncludingChildStartupAndShutdown"]}))
    if failure is not None or exit_code != 0 or len(rows) != 24:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
