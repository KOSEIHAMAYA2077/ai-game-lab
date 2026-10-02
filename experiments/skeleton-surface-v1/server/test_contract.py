"""Boundary and HTTP tests; independent semantic accuracy is evaluated separately."""
import json
import math
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app import handler_for
from interpreter import Interpreter, MAX_TEXT, negation_clean, validated_previous


class SpecBoundaries(unittest.TestCase):
    def test_missing_or_unsupported_family_is_rejected(self):
        for value in [None, [], {}, {"family": "dragon"}, {"family": 3}, {"family": []}, {"family": {}}]:
            self.assertIsNone(validated_previous(value))

    def test_hostile_numbers_do_not_reach_geometry(self):
        spec = validated_previous({"family": "vase", "height": 100000, "width": -1000,
                                   "neck": float("nan"), "bend": True, "twist": float("inf")})
        self.assertEqual(spec["height"], 1.8)
        self.assertEqual(spec["width"], .5)
        self.assertEqual(spec["neck"], .45)
        self.assertEqual(spec["bend"], 0.)
        self.assertEqual(spec["twist"], 0.)
        self.assertTrue(all(math.isfinite(spec[key]) for key in ["height", "width", "neck", "bend", "twist"]))

    def test_negated_noun_is_not_left_in_embedding_input(self):
        cleaned, rejected = negation_clean("球体ではなく立方体")
        self.assertTrue(rejected)
        self.assertEqual(cleaned, "立方体")
        self.assertEqual(negation_clean("no sword")[0], "")

    def test_missing_model_does_not_fake_a_generated_shape(self):
        result = Interpreter(None).interpret("花瓶")
        self.assertIsNone(result["spec"])
        self.assertEqual(result["reason"], "model-unavailable")

    def test_text_contract(self):
        for value in [None, [], {"text": "sphere"}, "x" * (MAX_TEXT + 1)]:
            with self.assertRaises(ValueError):
                Interpreter(None).interpret(value)


class LocalHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(Interpreter(None), 0, 0, {"http://127.0.0.1:4212"}))
        cls.port = cls.server.server_address[1]
        cls.server.RequestHandlerClass = handler_for(Interpreter(None), 0, cls.port, {"http://127.0.0.1:4212"})
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path="/health", data=None, headers=None):
        return urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=data, headers=headers or {}), timeout=2)

    def test_health_and_allowlisted_cors(self):
        response = self.request(headers={"Origin": "http://127.0.0.1:4212"})
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:4212")
        data = json.load(response)
        self.assertFalse(data["storesInput"])
        self.assertFalse(data["sendsInput"])
        self.assertFalse(data["semanticReady"])

    def test_external_origin_and_host_are_denied(self):
        for headers in [{"Origin": "https://example.com"}, {"Host": "example.com"}]:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request(headers=headers)
            self.assertEqual(error.exception.code, 403)

    def test_nonfinite_json_is_rejected_without_echo(self):
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.request("/interpret", b'{"text":"private-example", "previous":{"width":NaN}}', {"Content-Type": "application/json"})
        self.assertEqual(error.exception.code, 400)
        body = error.exception.read().decode()
        self.assertNotIn("private-example", body)

    def test_object_and_content_type_are_required(self):
        for body, headers, code in [(b'[]', {"Content-Type": "application/json"}, 400), (b'{"text":"x"}', {}, 415)]:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.request("/interpret", body, headers)
            self.assertEqual(error.exception.code, code)

    def test_valid_missing_model_response_is_a_hold(self):
        data = json.load(self.request("/interpret", b'{"text":"sphere"}', {"Content-Type": "application/json"}))
        self.assertIsNone(data["spec"])
        self.assertEqual(data["source"], "unchanged")


if __name__ == "__main__":
    unittest.main()
