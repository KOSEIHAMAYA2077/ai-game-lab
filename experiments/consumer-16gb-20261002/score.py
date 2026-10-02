"""Score frozen synthetic DSL cases without executing any model output.

Only standard-library dependencies. IDs and array order are not semantic labels.
The final score checks required conditions in the finite grammar, not 3D quality.
"""
import argparse
from collections import Counter
import hashlib
from itertools import permutations
import json
import math
from pathlib import Path
import statistics
import unittest

ROOT = Path(__file__).resolve().parent
ATTRIBUTES = ("shape", "size", "stretch", "color")
SYMMETRIC = {"touch", "concentric", "cross", "chain"}


def valid_contract(value):
    """Recheck the frozen runner's structural and bounded-output contract."""
    if not isinstance(value, dict) or set(value) != {"act", "parts", "rel"}:
        return False
    if not isinstance(value["act"], str) or value["act"] not in {"make", "keep", "unsupported"}:
        return False
    if not isinstance(value["parts"], list) or len(value["parts"]) > 4:
        return False
    if not isinstance(value["rel"], list) or len(value["rel"]) > 4:
        return False
    ids = set()
    for part in value["parts"]:
        if not isinstance(part, dict) or set(part) != {"id", "shape", "n", "size", "stretch", "color"}:
            return False
        if any(not isinstance(part[key], str) for key in ("id", *ATTRIBUTES)):
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
    for relation in value["rel"]:
        if not isinstance(relation, dict) or set(relation) != {"a", "b", "type"}:
            return False
        if any(not isinstance(relation[key], str) for key in ("a", "b", "type")):
            return False
        if relation["a"] not in ids or relation["b"] not in ids or relation["a"] == relation["b"]:
            return False
        if relation["type"] not in {"above", "below", "left", "right", "inside", "around", "concentric", "chain", "cross", "touch"}:
            return False
    return True


def object_counts(parts, fields):
    """Permit grouped counts versus split identical unrelated parts."""
    result = Counter()
    for part in parts:
        result[tuple(part[field] for field in fields)] += part["n"]
    return result


def relation_key(relation, binding=None):
    a, b, kind = relation["a"], relation["b"], relation["type"]
    if binding is not None:
        a, b = binding[a], binding[b]
    if kind == "below":
        a, b, kind = b, a, "above"
    elif kind == "right":
        a, b, kind = b, a, "left"
    elif kind in SYMMETRIC:
        a, b = sorted((a, b))
    return kind, a, b


def directional_cycle(keys):
    # Conflicting left/right or above/below chains cannot satisfy an arrangement.
    for kind in ("above", "left", "inside"):
        graph = {}
        for relation_kind, a, b in keys:
            if relation_kind == kind:
                graph.setdefault(a, set()).add(b)

        def visit(node, active, complete):
            if node in active:
                return True
            if node in complete:
                return False
            active.add(node)
            for child in graph.get(node, ()):
                if visit(child, active, complete):
                    return True
            active.remove(node)
            complete.add(node)
            return False

        complete = set()
        if any(visit(node, set(), complete) for node in graph):
            return True
    return False


def matching_bindings(expected, actual, fields):
    # Related count groups keep explicit ID scope. We intentionally do not guess
    # how two different partitions of related count groups share individual items.
    if len(expected) != len(actual):
        return
    for candidates in permutations(actual):
        if all(all(e[field] == a[field] for field in fields) for e, a in zip(expected, candidates)):
            yield {e["id"]: a["id"] for e, a in zip(expected, candidates)}


def permitted_relations(case, actual, binding):
    expected_keys = {relation_key(r, binding) for r in case["expected"]["rel"]}
    actual_keys = {relation_key(r) for r in actual["rel"]}
    if not expected_keys <= actual_keys or directional_cycle(actual_keys):
        return False
    forbidden = case.get("forbidden", {})
    if any(relation_key(r, binding) in actual_keys for r in forbidden.get("relations", [])):
        return False
    if forbidden.get("additionalChainEdges"):
        if {r for r in expected_keys if r[0] == "chain"} != {r for r in actual_keys if r[0] == "chain"}:
            return False
    return True


def relation_match(case, actual, include_attributes):
    expected = case["expected"]
    # Without related nodes, grouping/splitting identical copies is equivalent.
    if not expected["rel"]:
        return not directional_cycle({relation_key(r) for r in actual["rel"]})
    fields = ("shape", "n") + (("size", "stretch", "color") if include_attributes else ())
    return any(permitted_relations(case, actual, binding)
               for binding in matching_bindings(expected["parts"], actual["parts"], fields))


def score_case(case, result):
    value = result.get("parsed") if result is not None else None
    contract_ok = valid_contract(value)
    expected = case["expected"]
    action_ok = isinstance(value, dict) and value.get("act") == expected["act"]
    make = expected["act"] == "make"
    subjects_ok = attributes_ok = relations_ok = None
    conditions_ok = False
    errors = []
    if result is None:
        errors.append("missing_result")
    if not contract_ok:
        errors.append("contract_invalid")
    if not action_ok:
        errors.append("action_mismatch")
    if make:
        subjects_ok = contract_ok and object_counts(expected["parts"], ("shape",)) == object_counts(value["parts"], ("shape",))
        attributes_ok = contract_ok and object_counts(expected["parts"], ATTRIBUTES) == object_counts(value["parts"], ATTRIBUTES)
        relations_ok = contract_ok and subjects_ok and relation_match(case, value, False)
        if not subjects_ok:
            errors.append("missing_or_extra_subject_or_count")
        if not attributes_ok:
            errors.append("part_attributes_or_counts_mismatch")
        if expected["rel"] and not relations_ok:
            errors.append("required_relation_missing_or_contradictory")
        if contract_ok:
            forbidden_shapes = set(case.get("forbidden", {}).get("shapes", []))
            conditions_ok = not any(p["shape"] in forbidden_shapes for p in value["parts"])
            # A single binding must satisfy attributes AND relations. Two separate
            # successful permutations must not conceal swapped colors/locations.
            conditions_ok = conditions_ok and relation_match(case, value, True)
        if attributes_ok and relations_ok and not conditions_ok:
            errors.append("attributes_and_relations_do_not_share_a_valid_binding")
    else:
        conditions_ok = contract_ok and not value["parts"] and not value["rel"]
    exact = bool(contract_ok and action_ok and conditions_ok and
                 (not make or (subjects_ok and attributes_ok and relations_ok)))
    return {"id": case["id"], "input": case["text"], "tags": case.get("tags", []),
            "expected_action": expected["act"], "contract_ok": contract_ok,
            "runner_contract_ok": result.get("contract_ok") if result else None,
            "action_ok": action_ok, "subjects_counts_ok": subjects_ok,
            "attributes_counts_ok": attributes_ok,
            "relations_ok": relations_ok if expected["rel"] else None,
            "semantic_exact": exact, "errors": errors,
            "seconds": result.get("seconds") if result else None}


def metric(cases, field):
    values = [case[field] for case in cases if case[field] is not None]
    return {"correct": sum(bool(value) for value in values), "total": len(values)}


def summarize(run, fixture, source_name):
    by_id = {}
    fixture_by_id = {case["id"]: case for case in fixture["cases"]}
    for result in run["cases"]:
        if result["id"] in by_id:
            raise ValueError("Duplicate result ID: " + result["id"])
        if result["id"] not in fixture_by_id:
            raise ValueError("Unknown result ID: " + result["id"])
        if result.get("input") != fixture_by_id[result["id"]]["text"]:
            raise ValueError("Result input differs from frozen fixture: " + result["id"])
        by_id[result["id"]] = result
    cases = [score_case(case, by_id.get(case["id"])) for case in fixture["cases"]]
    durations = sorted(case["seconds"] for case in cases
                       if isinstance(case["seconds"], (int, float)) and
                       not isinstance(case["seconds"], bool) and math.isfinite(case["seconds"]))
    tags = sorted({tag for case in cases for tag in case["tags"]})
    return {"label": run.get("label", source_name), "source": source_name,
            "hardware": run.get("hardware"), "backend": run.get("backend"),
            "complete": len(by_id) == len(fixture["cases"]),
            "metrics": {name: metric(cases, field) for name, field in
                        (("contract", "contract_ok"), ("action", "action_ok"),
                         ("subjects_counts", "subjects_counts_ok"),
                         ("attributes_counts", "attributes_counts_ok"),
                         ("relations", "relations_ok"), ("semantic_exact", "semantic_exact"))},
            "by_tag": {tag: metric([case for case in cases if tag in case["tags"]], "semantic_exact") for tag in tags},
            "by_action": {action: metric([case for case in cases if case["expected_action"] == action], "semantic_exact")
                          for action in ("make", "keep", "unsupported")},
            "latency_seconds": {"n": len(durations),
                                "median": statistics.median(durations) if durations else None,
                                "p95_nearest_rank": durations[math.ceil(.95 * len(durations)) - 1] if durations else None,
                                "minimum": min(durations) if durations else None,
                                "maximum": max(durations) if durations else None},
            "startup_seconds": run.get("startup_seconds"),
            "peak_server_rss_bytes_sampled": run.get("peak_server_rss_bytes_sampled"),
            "rss_note": run.get("rss_note"),
            "contract_flag_disagreements": [case["id"] for case in cases
                                            if case["runner_contract_ok"] is not None and
                                            case["runner_contract_ok"] != case["contract_ok"]],
            "failures": [{"id": case["id"], "errors": case["errors"]}
                         for case in cases if not case["semantic_exact"]], "cases": cases}


def part(identifier, shape="sphere", **attributes):
    return {"id": identifier, "shape": shape, "n": 1,
            "size": "normal", "stretch": "none", "color": "white", **attributes}


class ScorerTests(unittest.TestCase):
    def example(self, parts, relations=(), forbidden=None):
        return {"id": "self-test", "text": "Synthetic test", "expected":
                {"act": "make", "parts": parts, "rel": list(relations)},
                "forbidden": forbidden or {}}

    def result(self, parts, relations=()):
        return {"parsed": {"act": "make", "parts": parts, "rel": list(relations)}}

    def test_node_renaming_and_inverse_direction(self):
        case = self.example([part("a", "box"), part("b")],
                            [{"a": "b", "b": "a", "type": "above"}])
        result = self.result([part("d"), part("c", "box")],
                             [{"a": "c", "b": "d", "type": "below"}])
        self.assertTrue(score_case(case, result)["semantic_exact"])

    def test_extra_part_fails(self):
        case = self.example([part("a")])
        self.assertFalse(score_case(case, self.result([part("a"), part("b", "box")]))["semantic_exact"])

    def test_count_partition_without_relations(self):
        case = self.example([part("a", n=3)])
        self.assertTrue(score_case(case, self.result([part("a"), part("b"), part("c")]))["semantic_exact"])

    def test_color_and_relation_need_the_same_binding(self):
        case = self.example([part("a", color="red"), part("b", color="blue")],
                            [{"a": "a", "b": "b", "type": "left"}])
        result = self.result([part("a", color="blue"), part("b", color="red")],
                             [{"a": "a", "b": "b", "type": "left"}])
        scored = score_case(case, result)
        self.assertTrue(scored["attributes_counts_ok"])
        self.assertTrue(scored["relations_ok"])
        self.assertFalse(scored["semantic_exact"])

    def test_explicit_gap_rejects_touch(self):
        touching = {"a": "a", "b": "b", "type": "touch"}
        case = self.example([part("a"), part("b", "box")],
                            [{"a": "a", "b": "b", "type": "above"}],
                            {"relations": [touching]})
        result = self.result([part("a"), part("b", "box")],
                             [{"a": "a", "b": "b", "type": "above"}, touching])
        self.assertFalse(score_case(case, result)["semantic_exact"])

    def test_directional_cycle_fails(self):
        self.assertTrue(directional_cycle({("above", "a", "b"), ("above", "b", "a")}))
        self.assertFalse(directional_cycle({("above", "a", "b"), ("touch", "a", "b")}))

    def test_invalid_json_value_types_are_rejected(self):
        self.assertFalse(valid_contract({"act": [], "parts": [], "rel": []}))
        self.assertFalse(valid_contract({"act": "make", "parts": [part([], "sphere")], "rel": []}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("runs", nargs="*", type=Path)
    parser.add_argument("--fixture", type=Path, default=ROOT / "heldout.json")
    parser.add_argument("--output", type=Path, default=ROOT / "summary.json")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(ScorerTests)
        if not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful():
            raise SystemExit(1)
        if not args.runs:
            return
    if not args.runs:
        parser.error("Provide one or more run JSON files, or --self-test")
    fixture_bytes = args.fixture.read_bytes()
    fixture = json.loads(fixture_bytes)
    fixture_hash = hashlib.sha256(fixture_bytes).hexdigest()
    models = []
    for requested in args.runs:
        path = requested if requested.exists() else ROOT / requested
        run = json.loads(path.read_text())
        if run.get("fixture_sha256") != fixture_hash:
            raise ValueError("Run does not match the frozen fixture hash: " + path.name)
        models.append(summarize(run, fixture, path.name))
    summary = {"version": 1, "fixture_sha256": fixture_hash,
               "source_note": "Per-model source files contain raw/parsed outputs and timing metadata. heldout.json contains expected graphs and forbidden conditions. Resolve case references by ID; this summary intentionally does not duplicate those graphs or outputs.",
               "scoring_note": "Required finite-DSL meaning under ID renaming; not rendered geometry or Japanese-general accuracy. Schema, action, counts, attributes, relations are separate metrics. Extra nodes fail. Requested relations are a subset, with contradictions and explicit forbidden relations rejected.",
               "partition_note": "Identical unrelated copies may split/merge count groups. Related count groups retain exact node ID scope; equivalent repartitions of related groups are not automatically scored as correct.",
               "cold_start_note": "Per-case seconds exclude the separately reported startup; server RSS excludes browser/OS and may miss short peaks.",
               "models": models}
    args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    for model in models:
        print(json.dumps({"label": model["label"], "metrics": model["metrics"],
                          "latency_seconds": model["latency_seconds"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
