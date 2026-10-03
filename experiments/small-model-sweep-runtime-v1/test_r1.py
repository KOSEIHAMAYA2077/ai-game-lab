"""Synthetic loopback transport + proposal contract tests; zero models."""
import http.server
import json
import threading
import time
import unittest

import run_r2 as driver


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_):
        pass

    def do_GET(self):
        self.close_connection = True
        if self.path == "/slow-header":
            try:
                for byte in b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n":
                    self.wfile.write(bytes([byte]))
                    self.wfile.flush()
                    time.sleep(0.03)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if self.path == "/slow":
            time.sleep(0.3)
        if self.path == "/sse":
            body = b"data: {}\n\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
        elif self.path == "/chunked":
            self.send_response(200)
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            self.wfile.write(b"3\r\n{\"a\r\n4\r\n\":1}\r\n0\r\n\r\n")
            self.wfile.flush()
            return
        elif self.path == "/trickle":
            self.send_response(200)
            self.send_header("Content-Length", "20")
            self.end_headers()
            try:
                for _ in range(20):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(0.03)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        else:
            body = b'{"a":1}' if self.path != "/big" else b"x" * 100
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


class TransportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_regular_json(self):
        status, raw = driver.request(self.port, "/ok", None, time.monotonic() + 1)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw), {"a": 1})

    def test_chunked_transport(self):
        _, raw = driver.request(self.port, "/chunked", None, time.monotonic() + 1)
        self.assertEqual(json.loads(raw), {"a": 1})

    def test_header_deadline(self):
        at = time.monotonic()
        with self.assertRaises(driver.DeadlineExceeded):
            driver.request(self.port, "/slow", None, at + 0.1)
        self.assertLess(time.monotonic() - at, 0.25)

    def test_whole_trickle_deadline(self):
        at = time.monotonic()
        with self.assertRaises(driver.DeadlineExceeded) as caught:
            driver.request(self.port, "/trickle", None, at + 0.12)
        self.assertLess(time.monotonic() - at, 0.3)
        self.assertGreater(len(caught.exception.partial), 0)

    def test_whole_header_trickle_deadline(self):
        at = time.monotonic()
        with self.assertRaises(driver.DeadlineExceeded):
            driver.request(self.port, "/slow-header", None, at + 0.12)
        self.assertLess(time.monotonic() - at, 0.3)

    def test_response_limit(self):
        with self.assertRaises(driver.ResponseLimitExceeded) as caught:
            driver.request(self.port, "/big", None, time.monotonic() + 1, 10)
        self.assertEqual(len(caught.exception.partial), 11)

    def test_unexpected_sse_rejected(self):
        with self.assertRaises(ValueError):
            driver.request(self.port, "/sse", None, time.monotonic() + 1)


class ShapeTests(unittest.TestCase):
    def test_propose(self):
        self.assertTrue(driver.valid_contract({"action": "propose", "shape": "sphere", "color": "red", "count": 2, "motion": "flow"}))

    def test_hold(self):
        self.assertTrue(driver.valid_contract({"action": "hold", "shape": None, "color": None, "count": 1, "motion": None}))

    def test_hold_shape_rejected(self):
        self.assertFalse(driver.valid_contract({"action": "hold", "shape": "sphere", "color": None, "count": 1, "motion": None}))

    def test_bool_count_rejected(self):
        self.assertFalse(driver.valid_contract({"action": "propose", "shape": "sphere", "color": None, "count": True, "motion": None}))

    def test_unhashable_field_rejected(self):
        self.assertFalse(driver.valid_contract({"action": [], "shape": "sphere", "color": None, "count": 1, "motion": None}))

    def test_markdown_not_stripped(self):
        self.assertIsNone(driver.parse_shape_content('```json\n{"action":"hold"}\n```'))

    def test_explanation_not_stripped(self):
        self.assertIsNone(driver.parse_shape_content('Result: {"action":"hold"}'))

    def test_nonfinite_rejected(self):
        self.assertIsNone(driver.parse_shape_content('{"count":NaN}'))

    def test_metrics_reject_invalid_numbers(self):
        self.assertEqual(driver.reported_metrics({"usage": {"completion_tokens": True}, "timings": {"predicted_ms": float("nan")}}), {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
