"""Bounded, sequential CPU llama-server comparison using caller-owned fixtures.

No model download, imported model code, global input capture, or app change.
Only the Popen child is stopped. Raw replies/requests/logs stay in .local.
"""
import argparse
import hashlib
import http.client
import json
import math
import os
import re
import socket
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LABEL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$")
MAX_RESPONSE = 4 * 1024 * 1024


class DeadlineExceeded(Exception):
    def __init__(self, partial=b""):
        self.partial = partial
        super().__init__("deadline_exceeded")


class ResponseLimitExceeded(Exception):
    def __init__(self, partial=b""):
        self.partial = partial
        super().__init__("response_limit_exceeded")


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + ".pending")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2,
                                    allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def remaining(deadline):
    value = deadline - time.monotonic()
    if value <= 0:
        raise DeadlineExceeded()
    return value


def request(port, route, body, deadline, max_response=MAX_RESPONSE):
    """A wall deadline covers connect, headers and every bounded body read.

    llama stream=False is required. Chunked *HTTP transport* is supported;
    an SSE token stream is rejected rather than being counted as a JSON reply.
    """
    conn = http.client.HTTPConnection("127.0.0.1", port,
                                      timeout=remaining(deadline))
    data = None if body is None else json.dumps(body, ensure_ascii=False,
                                                allow_nan=False).encode("utf-8")
    raw = bytearray()
    response = None
    timed_out = threading.Event()

    def abort_at_deadline():
        timed_out.set()
        sock = conn.sock
        if sock is None and response is not None and response.fp is not None:
            sock = getattr(getattr(response.fp, "raw", None), "_sock", None)
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        # Closing HTTPResponse from this thread races response.read1().
        # shutdown wakes it; the request thread owns close in finally.

    watchdog = threading.Timer(remaining(deadline), abort_at_deadline)
    watchdog.daemon = True
    watchdog.start()
    try:
        conn.request("GET" if body is None else "POST", route, body=data,
                     headers={"Content-Type": "application/json"})
        if conn.sock:
            conn.sock.settimeout(remaining(deadline))
        response = conn.getresponse()
        content_type = response.getheader("Content-Type", "")
        if "text/event-stream" in content_type.lower():
            raise ValueError("unexpected_event_stream")
        while True:
            timeout = remaining(deadline)
            # HTTPResponse retains the socket after Connection: close.
            sock = conn.sock
            if sock is None and response.fp is not None:
                sock = getattr(getattr(response.fp, "raw", None), "_sock", None)
            if sock is not None:
                sock.settimeout(timeout)
            block = response.read1(min(65536, max_response + 1 - len(raw)))
            if not block:
                break
            raw.extend(block)
            if len(raw) > max_response:
                raise ResponseLimitExceeded(bytes(raw))
        remaining(deadline)
        return response.status, bytes(raw)
    except DeadlineExceeded as exc:
        if raw and not exc.partial:
            exc.partial = bytes(raw)
        raise
    except (TimeoutError, socket.timeout) as exc:
        raise DeadlineExceeded(bytes(raw)) from exc
    except (OSError, http.client.HTTPException) as exc:
        if timed_out.is_set():
            raise DeadlineExceeded(bytes(raw)) from exc
        raise
    finally:
        watchdog.cancel()
        conn.close()


def strict_json(text):
    def reject_constant(value):
        raise ValueError("nonfinite_json_number")
    return json.loads(text, parse_constant=reject_constant)


def parse_shape_content(content):
    if not isinstance(content, str):
        return None
    try:
        return strict_json(content)
    except (ValueError, TypeError):
        return None


def valid_contract(value):
    """Finite 12-shape proposal contract; not semantic quality grading."""
    if not isinstance(value, dict) or set(value) != {"action", "shape", "color", "count", "motion"}:
        return False
    if not isinstance(value["action"], str) or value["action"] not in {"propose", "hold"}:
        return False
    if type(value["count"]) is not int or not 1 <= value["count"] <= 8:
        return False
    if value["shape"] is not None and (not isinstance(value["shape"], str) or value["shape"] not in {"sphere", "box", "mobius", "vase", "sword", "jellyfish", "flower", "fireworks", "tree", "bird", "fish", "snake"}):
        return False
    if value["color"] is not None and (not isinstance(value["color"], str) or value["color"] not in {"white", "red", "blue", "yellow", "green"}):
        return False
    if value["motion"] is not None and (not isinstance(value["motion"], str) or value["motion"] not in {"still", "flow", "pulse"}):
        return False
    if value["action"] == "hold":
        return value["shape"] is None and value["color"] is None and value["count"] == 1 and value["motion"] is None
    return value["shape"] is not None


def finite_number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def reported_metrics(response):
    usage = response.get("usage") if isinstance(response, dict) else None
    timings = response.get("timings") if isinstance(response, dict) else None
    result = {}
    if isinstance(usage, dict):
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            if type(usage.get(key)) is int and usage[key] >= 0:
                result[key] = usage[key]
    if isinstance(timings, dict):
        for key in ("prompt_ms", "predicted_ms", "predicted_per_second", "prompt_per_second"):
            if finite_number(timings.get(key)):
                result["server_" + key] = timings[key]
    return result


def port_owner(port):
    executable = "/usr/sbin/lsof"
    r = subprocess.run([executable, "-nP", "-iTCP:" + str(port),
                        "-sTCP:LISTEN", "-Fp"], capture_output=True,
                       text=True, timeout=2)
    owners = set()
    for line in r.stdout.splitlines():
        if re.fullmatch(r"p[0-9]+", line):
            owners.add(int(line[1:]))
    return owners


def assert_owned(server, port):
    if server.poll() is not None:
        raise RuntimeError("owned_server_exited")
    if port_owner(port) != {server.pid}:
        raise RuntimeError("port_owner_mismatch")


def stop_owned(server):
    if server is None:
        return {"method": "not_started", "exit_code": None}
    if server.poll() is not None:
        return {"method": "already_exited", "exit_code": server.returncode}
    server.terminate()
    method = "owned_sigterm"
    try:
        server.wait(timeout=5)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait(timeout=5)
        method = "owned_sigkill_after_5s"
    return {"method": method, "exit_code": server.returncode}


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--server", type=Path, required=True)
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--label", required=True)
    p.add_argument("--prompt", type=Path, required=True)
    p.add_argument("--fixture", type=Path, required=True)
    p.add_argument("--port", type=int, default=4220)
    p.add_argument("--batch-seconds", type=float, default=900)
    p.add_argument("--public-dir", type=Path, default=ROOT / "results")
    p.add_argument("--private-dir", type=Path, default=ROOT / ".local")
    args = p.parse_args(argv)
    if not LABEL.fullmatch(args.label) or not 1024 <= args.port <= 65535:
        p.error("safe label and port 1024..65535 required")
    if not math.isfinite(args.batch_seconds) or args.batch_seconds <= 0:
        p.error("positive finite batch deadline required")
    for path in (args.server, args.model, args.prompt, args.fixture):
        if not path.is_file():
            p.error("required input file missing")
    public = args.public_dir / args.label
    private = args.private_dir / args.label
    if public.exists() or private.exists():
        p.error("label already exists; preserve prior run and use a new label")
    public.mkdir(parents=True)
    private.mkdir(parents=True)
    prompt = json.loads(args.prompt.read_text(encoding="utf-8"))
    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    fixture_cases = fixture if isinstance(fixture, list) else fixture["cases"]
    # Never feed expected/rationale/group metadata to the model.
    cases = [{"id": c.get("case_id", c.get("id")), "text": c.get("text")}
             if isinstance(c, dict) else c for c in fixture_cases]
    if not isinstance(prompt, dict) or set(prompt) - {"messages", "response_format", "chat_template_kwargs"}:
        p.error("prompt supports messages, response_format and chat_template_kwargs")
    if not isinstance(prompt.get("messages"), list) or not prompt["messages"]:
        p.error("prompt messages required")
    if any(not isinstance(m, dict) or set(m) != {"role", "content"}
           or m["role"] not in {"system", "user", "assistant"}
           or not isinstance(m["content"], str) for m in prompt["messages"]):
        p.error("invalid prompt message")
    if not isinstance(cases, list) or not cases:
        p.error("nonempty fixtures required")
    case_ids = set()
    for case in cases:
        if not isinstance(case, dict) or not isinstance(case.get("id"), str) or not LABEL.fullmatch(case["id"]) or not isinstance(case.get("text"), str):
            p.error("fixture requires safe id and string text")
        if case["id"] in case_ids:
            p.error("duplicate fixture id")
        case_ids.add(case["id"])
    command = [str(args.server.resolve()), "--model", str(args.model.resolve()),
               "--ctx-size", "2048", "--threads", "4", "--threads-batch", "4",
               "--parallel", "1", "--batch-size", "256", "--ubatch-size", "128",
               "--reasoning", "off", "--no-cache-prompt", "--host", "127.0.0.1",
               "--port", str(args.port), "--device", "none", "--gpu-layers", "0",
               "--no-op-offload", "--no-kv-offload"]
    summary = {"version": "small-model-sweep-runtime-r2", "label": args.label,
               "backend": "cpu", "threads": 4, "threads_batch": 4,
               "context_tokens": 2048, "max_output_tokens": 256,
               "temperature": 0, "seed": 17, "stream": False,
               "prompt_cache": False, "startup_deadline_seconds": 60,
               "query_deadline_seconds": 30,
               "batch_deadline_seconds": args.batch_seconds,
               "model_file_bytes": args.model.stat().st_size,
               "fixture_count": len(cases), "cases": [], "status": "not_started",
               "startup_seconds": None, "failure_type": None,
               "hardware_note": "Caller must record host separately; not proof of a 16GB laptop or whole widget",
               "rss_note": "Owned server RSS only, ps samples every 250ms, sampled peak may miss brief peaks; driver, OS and UI excluded"}
    hash_started = time.monotonic()
    summary.update(model_file_sha256=sha256(args.model),
                   runtime_binary_sha256=sha256(args.server),
                   prompt_sha256=sha256(args.prompt),
                   fixture_sha256=sha256(args.fixture),
                   driver_sha256=sha256(__file__))
    summary["preflight_hash_seconds"] = round(time.monotonic() - hash_started, 6)
    summary["startup_cache_note"] = "Input files are hashed before startup; startup is not a controlled cold file-cache measurement"
    save(public / "summary.json", summary)
    save(private / "request-config.json", {"command": command,
                                           "prompt": prompt, "cases": cases})
    server = None
    stop = threading.Event()
    samples = []
    exports = []
    monitor = None
    started = time.monotonic()
    batch_deadline = started + args.batch_seconds
    log = (private / "server.log").open("wb")
    try:
        # Binding proves preflight availability without querying another app.
        # It is inside cleanup/reporting, so occupied-port failures are saved.
        with socket.socket() as reserved:
            reserved.bind(("127.0.0.1", args.port))
        server = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                  stdout=log, stderr=subprocess.STDOUT,
                                  start_new_session=True)
        save(private / "owned-process.json", {"pid": server.pid,
                                              "command": command})

        def sample_rss():
            while not stop.is_set():
                if server.poll() is not None:
                    break
                try:
                    r = subprocess.run(["ps", "-o", "rss=", "-p", str(server.pid)],
                                       capture_output=True, text=True, timeout=2)
                    value = r.stdout.strip()
                    samples.append({"seconds": round(time.monotonic() - started, 6),
                                    "rss_bytes": int(value) * 1024 if value.isdigit() else None})
                except (OSError, subprocess.TimeoutExpired):
                    samples.append({"seconds": round(time.monotonic() - started, 6), "rss_bytes": None})
                stop.wait(0.25)

        monitor = threading.Thread(target=sample_rss, daemon=True)
        monitor.start()
        health_deadline = min(started + 60, batch_deadline)
        while True:
            remaining(health_deadline)
            if server.poll() is not None:
                summary["status"] = "startup_failed"
                raise RuntimeError("owned_server_exited")
            owners = port_owner(args.port)
            if owners and owners != {server.pid}:
                raise RuntimeError("port_owner_mismatch")
            if owners == {server.pid}:
                try:
                    status, raw = request(args.port, "/health", None,
                                          min(health_deadline, time.monotonic() + 0.5), 65536)
                    if status == 200 and json.loads(raw).get("status") == "ok":
                        break
                except (OSError, DeadlineExceeded, ValueError, http.client.HTTPException):
                    pass
            time.sleep(min(0.1, remaining(health_deadline)))
        summary["startup_seconds"] = round(time.monotonic() - started, 6)
        summary["status"] = "running"
        save(public / "summary.json", summary)
        for case in cases:
            remaining(batch_deadline)
            assert_owned(server, args.port)
            body = dict(prompt)
            body["messages"] = prompt["messages"] + [{"role": "user", "content": case["text"]}]
            body.update(temperature=0, seed=17, max_tokens=256, stream=False, cache_prompt=False)
            save(private / (case["id"] + "-request.json"), body)
            at = time.monotonic()
            item = {"id": case["id"], "status": "not_started", "seconds": None,
                    "http_status": None, "response_bytes": None, "json_ok": False,
                    "contract_ok": False, "finish_reason": None, "metrics": {}}
            try:
                status, raw = request(args.port, "/v1/chat/completions", body,
                                      min(at + 30, batch_deadline))
                item["seconds"] = round(time.monotonic() - at, 6)
                (private / (case["id"] + "-response.bin")).write_bytes(raw)
                item["http_status"] = status
                item["response_bytes"] = len(raw)
                response = strict_json(raw)
                save(private / (case["id"] + "-response.json"), response)
                item["metrics"] = reported_metrics(response)
                choice = response["choices"][0]
                content = choice["message"].get("content")
                exports.append({"case_id": case["id"], "raw_text": content if isinstance(content, str) else "", "status": "ok" if status == 200 and isinstance(content, str) else "error"})
                parsed = parse_shape_content(content)
                item["json_ok"] = parsed is not None
                item["contract_ok"] = valid_contract(parsed)
                reason = choice.get("finish_reason")
                item["finish_reason"] = reason if reason in {"stop", "length", "tool_calls", "content_filter"} else "other"
                item["status"] = "reply" if status == 200 else "http_error"
                if item["contract_ok"]:
                    item["parsed_contract"] = parsed
                tokens = item["metrics"].get("completion_tokens")
                if tokens is not None and item["seconds"] > 0:
                    item["metrics"]["completion_tokens_per_client_second"] = tokens / item["seconds"]
            except DeadlineExceeded as exc:
                (private / (case["id"] + "-partial-response.bin")).write_bytes(exc.partial)
                exports.append({"case_id": case["id"], "raw_text": "", "status": "timeout"})
                item["status"] = "timeout"
                item["seconds"] = round(time.monotonic() - at, 6)
                summary["cases"].append(item)
                summary["status"] = "batch_timeout" if batch_deadline <= at + 30 else "query_timeout"
                save(public / "summary.json", summary)
                raise
            except ResponseLimitExceeded as exc:
                (private / (case["id"] + "-partial-response.bin")).write_bytes(exc.partial)
                exports.append({"case_id": case["id"], "raw_text": "", "status": "error"})
                item["status"] = "response_limit"
                item["seconds"] = round(time.monotonic() - at, 6)
                summary["cases"].append(item)
                summary["status"] = "response_limit"
                save(public / "summary.json", summary)
                raise
            except (KeyError, IndexError, ValueError, TypeError):
                if not any(e["case_id"] == case["id"] for e in exports):
                    exports.append({"case_id": case["id"], "raw_text": "", "status": "error"})
                item["status"] = "invalid_response"
                item["seconds"] = round(time.monotonic() - at, 6)
            except (OSError, http.client.HTTPException):
                exports.append({"case_id": case["id"], "raw_text": "", "status": "error"})
                item["status"] = "transport_error"
                item["seconds"] = round(time.monotonic() - at, 6)
                summary["cases"].append(item)
                summary["status"] = "transport_error"
                save(public / "summary.json", summary)
                raise
            summary["cases"].append(item)
            save(public / "summary.json", summary)
            print(json.dumps({"label": args.label, "id": item["id"],
                              "status": item["status"], "seconds": item["seconds"],
                              "contract_ok": item["contract_ok"]}), flush=True)
        summary["status"] = "completed"
    except BaseException as exc:
        if summary["status"] not in {"startup_failed", "query_timeout", "batch_timeout", "response_limit", "transport_error"}:
            summary["status"] = ("startup_timeout" if summary["startup_seconds"] is None
                                  and isinstance(exc, DeadlineExceeded) else
                                  "batch_timeout" if isinstance(exc, DeadlineExceeded) else
                                  "interrupted" if isinstance(exc, KeyboardInterrupt) else "failed")
        summary["failure_type"] = type(exc).__name__
        (private / "failure.txt").write_text(repr(exc) + "\n", encoding="utf-8")
    finally:
        summary["shutdown"] = stop_owned(server)
        stop.set()
        if monitor is not None:
            monitor.join(timeout=3)
        log.close()
        summary["elapsed_seconds_including_shutdown"] = round(time.monotonic() - started, 6)
        summary["rss_samples"] = len(samples)
        valid_samples = [s["rss_bytes"] for s in samples if s["rss_bytes"] is not None]
        summary["valid_rss_samples"] = len(valid_samples)
        summary["peak_server_rss_bytes_sampled"] = max(valid_samples, default=None)
        summary["last_server_rss_bytes_sampled"] = valid_samples[-1] if valid_samples else None
        summary["unattempted_case_ids"] = [c["id"] for c in cases if c["id"] not in {i["id"] for i in summary["cases"]}]
        (private / "responses.jsonl").write_text("".join(json.dumps(e, ensure_ascii=False, allow_nan=False) + "\n" for e in exports), encoding="utf-8")
        save(public / "rss-samples.json", samples)
        save(public / "summary.json", summary)
    return 0 if summary["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
