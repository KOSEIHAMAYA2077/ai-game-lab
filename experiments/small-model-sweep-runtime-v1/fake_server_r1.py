#!/usr/bin/env python3
"""Artificial llama-shaped HTTP server; no model library or weights."""
import argparse
import http.server
import json
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--host")
parser.add_argument("--port", type=int)
parser.add_argument("--model", type=Path)
args, _ = parser.parse_known_args()
mode = args.model.read_text(encoding="utf-8")


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, value):
        body = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        self.reply({"status": "ok"})

    def do_POST(self):
        raw = self.rfile.read(int(self.headers["Content-Length"]))
        request = json.loads(raw)
        if mode == "slow":
            time.sleep(3)
        value = {"action": "hold", "shape": None, "color": None, "count": 1, "motion": None}
        self.reply({"choices": [{"message": {"content": json.dumps(value)}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 1, "completion_tokens": 5, "total_tokens": 6},
                    "test_received": request})


http.server.HTTPServer((args.host, args.port), Handler).serve_forever()
