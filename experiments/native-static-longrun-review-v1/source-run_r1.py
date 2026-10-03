#!/usr/bin/env python3
# coding: utf-8
"""Artificial-input observation of one pinned native CLI, not a widget test."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import selectors
import subprocess
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def save(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def digest(path):
    raw = path.read_bytes()
    return len(raw), hashlib.sha256(raw).hexdigest()


def verify_freeze():
    freeze = json.loads((HERE / "FREEZE-R1.json").read_text())
    for row in freeze["files"]:
        size, sha = digest(ROOT / row["path"])
        assert size == row["bytes"] and sha == row["sha256"], row["path"]
    return freeze


def cpu_seconds(value):
    result = 0.0
    for component in value.split(":"):
        result = result * 60 + float(component)
    return result


def main():
    assert not (HERE / "RUN-R1.json").exists(), "Do not overwrite a run"
    freeze = verify_freeze()
    cfg = json.loads((HERE / "QUERIES-R1.json").read_text())
    duration = cfg["scheduledDurationSeconds"]
    work = HERE / "work"
    work.mkdir(exist_ok=True)
    time_log = open(HERE / "TIME-R1.log", "wb")
    native = ROOT / "experiments/native-static-japanese-v1/native-static-r5"
    proc = subprocess.Popen(["/usr/bin/time", "-l", str(native)], cwd=ROOT,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=time_log, bufsize=0)
    t0 = time.monotonic()
    started = utc()
    pid = None
    # /usr/bin/time is the owned parent. Only its exact immediate child is read.
    for _ in range(100):
        found = subprocess.run(["/usr/bin/pgrep", "-P", str(proc.pid)],
                               capture_output=True, text=True)
        ids = [int(x) for x in found.stdout.split() if x.isdigit()]
        if len(ids) == 1:
            comm = subprocess.run(["/bin/ps", "-p", str(ids[0]), "-o", "comm="],
                                  capture_output=True, text=True).stdout.strip()
            if Path(comm).name == "native-static-r5":
                pid = ids[0]
                break
        time.sleep(.02)
    assert pid is not None, "Exact owned child not found"
    save("RUN-R1.json", {"startedUTC": started, "nativePID": pid,
                        "timeWrapperPID": proc.pid, "driverPID": os.getpid(),
                        "scheduledDurationSeconds": duration,
                        "scope": "Pinned native CPU CLI only, artificial inputs"})
    (work / "owned-pids.json").write_text(json.dumps({"native": pid, "time": proc.pid,
                                                    "driver": os.getpid()}))
    sel = selectors.DefaultSelector()
    sel.register(proc.stdout, selectors.EVENT_READ)
    buffer = b""
    queries, samples, failure = [], [], None
    next_sample, next_ordinary = 0, 0
    pending_long = list(cfg["longOffsetsSeconds"])
    ordinary_index = 0

    def query(text, kind, scheduled):
        nonlocal buffer
        sent = time.monotonic()
        request = json.dumps({"text": text, "registry": "shape"}, ensure_ascii=False).encode() + b"\n"
        proc.stdin.write(request)
        proc.stdin.flush()
        deadline = sent + 15
        while b"\n" not in buffer:
            remain = deadline - time.monotonic()
            if remain <= 0:
                raise TimeoutError("Native response deadline 15s")
            if not sel.select(min(remain, 1)):
                continue
            chunk = os.read(proc.stdout.fileno(), 65536)
            if not chunk:
                raise EOFError("Native EOF before reply")
            buffer += chunk
            if len(buffer) > 1048576:
                raise ValueError("Driver reply frame exceeded 1MiB")
        line, buffer = buffer.split(b"\n", 1)
        reply = json.loads(line)
        received = time.monotonic()
        queries.append({"kind": kind, "scheduledOffsetSeconds": scheduled,
                        "sentElapsedSeconds": sent - t0, "receivedUTC": utc(),
                        "rpcMilliseconds": (received - sent) * 1000,
                        "requestBytes": len(request), "requestSHA256": hashlib.sha256(request).hexdigest(),
                        "reply": reply})
        save("QUERIES-RAW-R1.json", queries)

    try:
        print(json.dumps({"startedUTC": started, "nativePID": pid, "duration": duration}), flush=True)
        while True:
            elapsed = time.monotonic() - t0
            if elapsed >= duration:
                break
            if elapsed >= next_ordinary:
                query(cfg["ordinary"][ordinary_index % len(cfg["ordinary"])],
                      "ordinary", next_ordinary)
                ordinary_index += 1
                next_ordinary += cfg["ordinaryIntervalSeconds"]
            if pending_long and elapsed >= pending_long[0]:
                scheduled = pending_long.pop(0)
                query(cfg["longText"], "long4000", scheduled)
            if elapsed >= next_sample:
                observed = time.monotonic()
                ps = subprocess.run(["/bin/ps", "-p", str(pid), "-o", "pid=,ppid=,rss=,time=,stat="],
                                    capture_output=True, text=True)
                fields = ps.stdout.split()
                if ps.returncode == 0 and len(fields) == 5 and int(fields[0]) == pid and int(fields[1]) == proc.pid:
                    samples.append({"observedUTC": utc(), "elapsedSeconds": observed - t0,
                                    "residentBytes": int(fields[2]) * 1024,
                                    "cumulativeCPUSeconds": cpu_seconds(fields[3]), "state": fields[4]})
                else:
                    samples.append({"observedUTC": utc(), "elapsedSeconds": observed - t0,
                                    "missing": True, "psExit": ps.returncode})
                save("SAMPLES-R1.json", samples)
                if next_sample % 600 == 0:
                    print(json.dumps({"elapsedSeconds": round(elapsed, 2), "queries": len(queries),
                                      "lastSample": samples[-1]}), flush=True)
                next_sample += cfg["sampleIntervalSeconds"]
            time.sleep(min(.5, max(.01, duration - (time.monotonic() - t0))))
        proc.stdin.close()
        proc.stdin = None
        proc.wait(timeout=15)
        tail = proc.stdout.read()
        if buffer + tail:
            raise ValueError("Unexpected output after final JSONL reply")
    except Exception as exc:
        failure = {"class": type(exc).__name__, "message": str(exc), "observedUTC": utc()}
        # On failure terminate only this exact child and its owned time wrapper.
        if proc.poll() is None:
            try:
                os.kill(pid, 15)
            except ProcessLookupError:
                pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
    finally:
        elapsed = time.monotonic() - t0
        sel.close()
        time_log.close()
        verify_freeze()
        result = {"startedUTC": started, "endedUTC": utc(), "elapsedSeconds": elapsed,
                  "scheduledDurationSeconds": duration, "queryCount": len(queries),
                  "ordinaryCount": sum(q["kind"] == "ordinary" for q in queries),
                  "longCount": sum(q["kind"] == "long4000" for q in queries),
                  "sampleCount": len(samples), "validSampleCount": sum(not s.get("missing") for s in samples),
                  "exitCode": proc.returncode, "failure": failure,
                  "sourceModelFreezeUnchanged": True, "modelSemanticScoring": False,
                  "GUIOSGPUHumanEvaluations": 0, "defaultAdoption": False,
                  "freezeSHA256": hashlib.sha256((HERE / "FREEZE-R1.json").read_bytes()).hexdigest()}
        save("SUMMARY-R1.json", result)
        print(json.dumps(result), flush=True)
    return 0 if failure is None and proc.returncode == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
