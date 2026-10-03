"""Artificial child lifecycle and persisted failures; no actual model."""
import json
import os
import socket
import subprocess
import sys
import unittest
import uuid
from pathlib import Path

import run_r2 as driver
from test_r1 import Handler
import http.server
import threading


class LifecycleTests(unittest.TestCase):
    def run_fake(self, mode="ok", seconds=5, occupied_port=None):
        root = driver.ROOT / ".local" / ("fake-" + uuid.uuid4().hex)
        root.mkdir(parents=True)
        # The wrapper is private because its interpreter path is host-specific.
        executable = root / "fake-server"
        executable.write_text("#!" + sys.executable + "\n" +
                              (driver.ROOT / "fake_server_r1.py").read_text(encoding="utf-8"), encoding="utf-8")
        executable.chmod(0o755)
        model = root / "dummy-model.txt"
        model.write_text(mode)
        prompt = root / "prompt.json"
        prompt.write_text(json.dumps({"messages": [{"role": "system", "content": "synthetic"}], "chat_template_kwargs": {"enable_thinking": False}}))
        fixture = root / "fixture.json"
        fixture.write_text(json.dumps({"cases": [{"case_id": "fake1", "text": "synthetic", "expected": "never include this in model input"}]}))
        if occupied_port is None:
            with socket.socket() as free:
                free.bind(("127.0.0.1", 0))
                port = free.getsockname()[1]
        else:
            port = occupied_port
        result = driver.main(["--server", str(executable), "--model", str(model),
                              "--prompt", str(prompt), "--fixture", str(fixture),
                              "--label", "synthetic", "--port", str(port),
                              "--batch-seconds", str(seconds),
                              "--public-dir", str(root / "public"),
                              "--private-dir", str(root / "private")])
        summary = json.loads((root / "public/synthetic/summary.json").read_text())
        if (root / "private/synthetic/owned-process.json").exists():
            pid = json.loads((root / "private/synthetic/owned-process.json").read_text())["pid"]
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)
        return result, summary, root

    def test_owned_success_and_original_export(self):
        result, summary, root = self.run_fake()
        self.assertEqual(result, 0)
        self.assertEqual(summary["status"], "completed")
        self.assertEqual(summary["shutdown"]["method"], "owned_sigterm")
        exports = (root / "private/synthetic/responses.jsonl").read_text().splitlines()
        self.assertEqual(len(exports), 1)
        self.assertEqual(json.loads(exports[0])["case_id"], "fake1")
        raw = json.loads((root / "private/synthetic/fake1-response.json").read_text())
        self.assertEqual(json.loads(exports[0])["raw_text"], raw["choices"][0]["message"]["content"])
        self.assertNotIn("expected", json.dumps(raw["test_received"]))
        self.assertFalse(raw["test_received"]["chat_template_kwargs"]["enable_thinking"])
        self.assertEqual(raw["test_received"]["max_tokens"], 256)

    def test_owned_timeout_saved_and_stopped(self):
        result, summary, root = self.run_fake("slow", 1.5)
        self.assertEqual(result, 1)
        self.assertEqual(summary["status"], "batch_timeout")
        self.assertEqual(summary["cases"][0]["status"], "timeout")
        exports = json.loads((root / "private/synthetic/responses.jsonl").read_text())
        self.assertEqual(exports["status"], "timeout")

    def test_foreign_listener_untouched(self):
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            result, summary, _ = self.run_fake(occupied_port=server.server_port)
            self.assertEqual(result, 1)
            self.assertEqual(summary["status"], "failed")
            self.assertEqual(summary["shutdown"]["method"], "not_started")
            status, _ = driver.request(server.server_port, "/ok", None, driver.time.monotonic() + 1)
            self.assertEqual(status, 200)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
