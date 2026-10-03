"""Artificial measurement records: invalid/truncated counters must not pass."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("independent_resource_collector", Path(__file__).with_name("collect_r1.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class IdleValidationTest(unittest.TestCase):
    def setUp(self):
        self.summary = {"idle": {"planned_seconds": 600, "elapsed_seconds": 600.0,
            "cpu_start_seconds": 2.04, "cpu_end_seconds": 2.10,
            "cpu_delta_seconds": 0.06, "cpu_percent_one_core": 0.01,
            "started_batch_seconds": 100.0, "rss_samples": 2,
            "rss_min_bytes": 500, "rss_max_bytes": 600, "mean_rss_bytes": 550.0}}
        self.samples = [{"seconds": 99.0, "rss_bytes": 900},
                        {"seconds": 100.0, "rss_bytes": 500},
                        {"seconds": 101.0, "rss_bytes": 600},
                        {"seconds": 701.0, "rss_bytes": 10}]

    def test_full_interval_excludes_later_shutdown_sample(self):
        checked = collector.idle_check(self.summary, self.samples)
        self.assertEqual(checked["status"], "complete_600_seconds")
        self.assertEqual(checked["later_samples_excluded"], 1)
        self.assertEqual(checked["rss_min_bytes"], 500)
        self.assertAlmostEqual(checked["cpu_percent_one_core_recomputed"], 0.01)

    def test_short_completed_window_is_truncated(self):
        self.summary["status"] = "completed"
        self.summary["idle"]["elapsed_seconds"] = 300.0
        self.summary["idle"]["cpu_percent_one_core"] = 0.02
        self.assertEqual(collector.idle_check(self.summary, self.samples)["status"], "truncated")

    def test_counter_decrease_is_invalid(self):
        self.summary["idle"]["cpu_end_seconds"] = 1.0
        self.assertEqual(collector.idle_check(self.summary, self.samples)["status"], "invalid_counter")

    def test_wrong_percentage_or_rss_fails(self):
        for key, value in [("cpu_percent_one_core", 1.0), ("rss_min_bytes", 10), ("rss_samples", 10)]:
            summary = copy.deepcopy(self.summary)
            summary["idle"][key] = value
            with self.subTest(key=key):
                self.assertEqual(collector.idle_check(summary, self.samples)["status"], "aggregate_mismatch")

    def test_missing_end_counter_is_incomplete(self):
        del self.summary["idle"]["cpu_end_seconds"]
        self.assertEqual(collector.idle_check(self.summary, self.samples)["status"], "incomplete")

    def test_nan_and_zero_interval_fail(self):
        for value in [float("nan"), 0.0]:
            self.summary["idle"]["elapsed_seconds"] = value
            with self.subTest(value=value):
                self.assertEqual(collector.idle_check(self.summary, self.samples)["status"], "invalid_counter")


if __name__ == "__main__":
    unittest.main()
