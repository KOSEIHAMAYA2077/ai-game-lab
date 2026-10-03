"""Artificial ps TIME outputs only: no ps, port checks or server/model calls."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

DRIVER_PATH = Path(__file__).resolve().parents[1] / "small-model-sweep-resources-v1/run_r2.py"
spec = importlib.util.spec_from_file_location("resource_driver_review", DRIVER_PATH)
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)


class CounterTest(unittest.TestCase):
    def call(self, value):
        with patch.object(driver, "assert_owned") as owned, patch.object(driver.subprocess, "run", return_value=SimpleNamespace(stdout=value)) as query:
            result = driver.cpu_counter(SimpleNamespace(pid=1234), 4220)
            owned.assert_called_once()
            self.assertEqual(query.call_args.args[0], ["ps", "-o", "time=", "-p", "1234"])
            return result

    def test_formats(self):
        for raw, expected in [("00:00.00", 0.0), ("  1:02.34\n", 62.34), ("123:45.67", 7425.67), ("1:02:03.45", 3723.45), ("2-03:04:05.67", 183845.67), ("1-00:00.00", 86400.0)]:
            with self.subTest(raw=raw):
                self.assertAlmostEqual(self.call(raw)[0], expected)

    def test_empty_or_invalid_formats(self):
        for raw in ["", "12", "1:2:3:4", "bad:00", "?-00:01.00"]:
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    self.call(raw)

    def test_ownership_failure_prevents_ps(self):
        with patch.object(driver, "assert_owned", side_effect=RuntimeError("not_owned")), patch.object(driver.subprocess, "run") as query:
            with self.assertRaises(RuntimeError):
                driver.cpu_counter(SimpleNamespace(pid=1234), 4220)
            query.assert_not_called()


if __name__ == "__main__":
    unittest.main()
