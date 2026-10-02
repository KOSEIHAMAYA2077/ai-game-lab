"""Offline, synthetic-input CPU/Metal comparison. No game source is changed.

Use a separately verified llama-server binary and GGUF; this script does not
download or execute model-provided Python. RSS sampling currently targets macOS.
"""
import argparse
import hashlib
import json
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def request(base, route, body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    req = urllib.request.Request(base + route, data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as res:
        return json.load(res)


def valid_contract(value):
    if not isinstance(value, dict) or set(value) != {"act", "parts", "rel"}:
        return False
    if value["act"] not in {"make", "keep", "unsupported"}:
        return False
    if not isinstance(value["parts"], list) or len(value["parts"]) > 4:
        return False
    if not isinstance(value["rel"], list) or len(value["rel"]) > 4:
        return False
    ids = set()
    for part in value["parts"]:
        if not isinstance(part, dict) or set(part) != {"id", "shape", "n", "size", "stretch", "color"}:
            return False
        if part["id"] not in {"a", "b", "c", "d"} or part["id"] in ids:
            return False
        ids.add(part["id"])
        if part["shape"] not in {"sphere", "box", "cylinder", "cone", "torus"}:
            return False
        if type(part["n"]) is not int or not 1 <= part["n"] <= 8:
            return False
        if part["size"] not in {"normal", "small", "large"}:
            return False
        if part["stretch"] not in {"none", "x", "y", "z"}:
            return False
        if part["color"] not in {"white", "red", "yellow", "blue", "green", "purple", "black"}:
            return False
    if sum(p["n"] for p in value["parts"]) > 12:
        return False
    if value["act"] != "make" and (value["parts"] or value["rel"]):
        return False
    if value["act"] == "make" and not value["parts"]:
        return False
    for rel in value["rel"]:
        if not isinstance(rel, dict) or set(rel) != {"a", "b", "type"}:
            return False
        if rel["a"] not in ids or rel["b"] not in ids or rel["a"] == rel["b"]:
            return False
        if rel["type"] not in {"above", "below", "left", "right", "inside", "around", "concentric", "chain", "cross", "touch"}:
            return False
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--server", type=Path, required=True)
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--label", required=True)
    p.add_argument("--fixture", type=Path, default=ROOT / "heldout.json")
    p.add_argument("--backend", choices=["cpu", "metal"], default="cpu")
    p.add_argument("--no-grammar", action="store_true",
                   help="Diagnostic reuse of the frozen cases, without constrained decoding")
    p.add_argument("--port", type=int, default=4210)
    args = p.parse_args()
    prompt = (ROOT / "prompt.txt").read_text()
    schema = json.loads((ROOT / "schema.json").read_text())
    fixture = json.loads(args.fixture.read_text())
    cases = fixture if isinstance(fixture, list) else fixture["cases"]
    base = "http://127.0.0.1:" + str(args.port)
    # Avoid interfering with any process already serving this port.
    try:
        request(base, "/health")
    except urllib.error.URLError:
        pass
    else:
        raise RuntimeError("The chosen test port is already in use")
    cmd = [str(args.server.resolve()), "--model", str(args.model.resolve()),
           "--ctx-size", "2048", "--threads", "4", "--threads-batch", "4",
           "--parallel", "1", "--batch-size", "256", "--ubatch-size", "128",
           "--reasoning", "off", "--no-cache-prompt", "--host", "127.0.0.1",
           "--cors-origins", "http://127.0.0.1", "--port", str(args.port)]
    if args.backend == "cpu":
        cmd += ["--device", "none", "--gpu-layers", "0", "--no-op-offload", "--no-kv-offload"]
    else:
        cmd += ["--gpu-layers", "99"]
    local = ROOT.parent.parent / ".local" / "runtime"
    local.mkdir(parents=True, exist_ok=True)
    log = (local / (args.label + ".log")).open("w")
    started = time.monotonic()
    server = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT)
    stop = threading.Event()
    samples = []

    def sample_rss():
        while not stop.wait(0.25):
            value = subprocess.run(["ps", "-o", "rss=", "-p", str(server.pid)],
                                   capture_output=True, text=True).stdout.strip()
            if value.isdigit():
                samples.append(int(value) * 1024)

    monitor = threading.Thread(target=sample_rss, daemon=True)
    monitor.start()
    results = {"label": args.label, "backend": args.backend,
               "hardware": "Apple M5, 32GB shared RAM; not a 16GB Intel/AMD laptop",
               "threads": 4, "context": 2048, "max_output_tokens": 512,
               "temperature": 0, "seed": 17, "prompt_cache": False,
               "grammar": not args.no_grammar,
               "fixture_sha256": hashlib.sha256(args.fixture.read_bytes()).hexdigest(),
               "prompt_sha256": hashlib.sha256((ROOT / "prompt.txt").read_bytes()).hexdigest(),
               "schema_sha256": hashlib.sha256((ROOT / "schema.json").read_bytes()).hexdigest(),
               "cases": []}
    try:
        while time.monotonic() - started < 60:
            if server.poll() is not None:
                raise RuntimeError("Test server exited; inspect the local log")
            try:
                if request(base, "/health").get("status") == "ok":
                    break
            except urllib.error.URLError:
                time.sleep(0.2)
        else:
            raise RuntimeError("Model startup exceeded 60 seconds")
        results["startup_seconds"] = round(time.monotonic() - started, 3)
        for case in cases:
            body = {"messages": [{"role": "system", "content": prompt},
                                 {"role": "user", "content": case["text"]}],
                    "temperature": 0, "seed": 17, "max_tokens": 512,
                    "response_format": {"type": "json_schema", "json_schema":
                        {"name": "glyph_shape", "strict": True, "schema": schema}}}
            if args.no_grammar:
                del body["response_format"]
            at = time.monotonic()
            response = request(base, "/v1/chat/completions", body)
            raw = response["choices"][0]["message"].get("content", "")
            try:
                parsed = json.loads(raw)
            except (ValueError, TypeError):
                parsed = None
            item = {"id": case["id"], "input": case["text"],
                    "seconds": round(time.monotonic() - at, 3), "raw": raw,
                    "parsed": parsed, "contract_ok": valid_contract(parsed),
                    "finish_reason": response["choices"][0]["finish_reason"],
                    "usage": response.get("usage"), "timings": response.get("timings")}
            results["cases"].append(item)
            print(json.dumps({"label": args.label, "id": item["id"],
                              "seconds": item["seconds"], "contract_ok": item["contract_ok"]}), flush=True)
    finally:
        server.terminate()
        try:
            server.wait(timeout=8)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()
        stop.set()
        monitor.join(timeout=2)
        log.close()
        results["peak_server_rss_bytes_sampled"] = max(samples, default=0)
        results["rss_note"] = "server only, 250ms samples; excludes OS/browser, may miss brief peaks"
        results["server_exit_code"] = server.returncode
        (ROOT / (args.label + ".json")).write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
