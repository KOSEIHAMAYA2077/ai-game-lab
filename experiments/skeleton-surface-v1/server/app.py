"""Loopback-only API. Runtime never contacts a remote service or logs inputs."""
from __future__ import annotations
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import time
from interpreter import Embeddings, Interpreter, MODEL_ID, REVISION, MAX_TEXT, MIN_SCORE, MIN_MARGIN

MAX_BODY = 32768


def handler_for(interpreter: Interpreter, load_ms: float, port: int, origins: set[str]):
    class Handler(BaseHTTPRequestHandler):
        server_version = "GlyphScaffold/0.1"

        def log_message(self, *_args):
            pass

        def allowed(self):
            if self.headers.get("Host") not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
                self.respond(403, {"error": "Loopback host required"}, False)
                return False
            if self.headers.get("Origin") not in origins | {None}:
                self.respond(403, {"error": "Origin not allowed"}, False)
                return False
            return True

        def respond(self, code, data=None, cors=True):
            body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode() if data is not None else b""
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if cors and self.headers.get("Origin") in origins:
                self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            if not self.allowed():
                return
            if self.path not in ("/health", "/interpret"):
                return self.respond(404, {"error": "Not found"})
            self.send_response(204)
            if self.headers.get("Origin") in origins:
                self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
                self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            if not self.allowed():
                return
            if self.path != "/health":
                return self.respond(404, {"error": "Not found"})
            self.respond(200, {"ok": True, "semanticReady": interpreter.embeddings is not None, "model": MODEL_ID,
                "revision": REVISION, "provider": "CPUExecutionProvider", "modelLoadMs": round(load_ms, 3),
                "maxTextCharacters": MAX_TEXT, "maxTokens": 128, "families": ["vase", "sword", "mobius", "ring", "sphere", "cube"],
                "threshold": {"score": MIN_SCORE, "margin": MIN_MARGIN}, "storesInput": False, "sendsInput": False,
                "generationIncludes": "model chooses bounded family/attributes; browser constructs surface and places glyphs"})

        def do_POST(self):
            if not self.allowed():
                return
            if self.path != "/interpret":
                return self.respond(404, {"error": "Not found"})
            if self.headers.get_content_type() != "application/json":
                return self.respond(415, {"error": "Use application/json"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.respond(400, {"error": "Invalid Content-Length"})
            if not 0 < length <= MAX_BODY:
                return self.respond(413, {"error": "Request too large or empty"})
            try:
                data = json.loads(self.rfile.read(length).decode("utf-8"), parse_constant=lambda _value: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
                if not isinstance(data, dict):
                    raise ValueError("JSON object required")
                result = interpreter.interpret(data.get("text"), data.get("previous"))
            except (ValueError, UnicodeDecodeError) as error:
                return self.respond(400, {"error": str(error).split(": line")[0]})
            except Exception:
                return self.respond(500, {"error": "Local interpretation failed"})
            self.respond(200, result)
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4213)
    parser.add_argument("--frontend-port", type=int, default=4212)
    parser.add_argument("--model-dir", type=Path, default=Path(__file__).resolve().parents[3] / ".local/semantics-model")
    args = parser.parse_args()
    started = time.perf_counter()
    embeddings = Embeddings(args.model_dir)
    load_ms = (time.perf_counter()-started)*1000
    origins = {f"http://127.0.0.1:{args.frontend_port}", f"http://localhost:{args.frontend_port}"}
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(Interpreter(embeddings), load_ms, args.port, origins))
    print(f"Glyph scaffold API ready on loopback port {args.port}; CPU; model load {load_ms:.0f} ms; no input logging", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
