"""Sentence -> constrained one/two-part scaffold program, entirely on CPU."""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import re
import sys
import time
import unicodedata

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "experiments/skeleton-surface-v1/server"))
from interpreter import Embeddings
import numpy as np
from config import ALIASES, ANCHORS, BACKGROUND, BOUNDS, CAPTIONS, DEFAULTS, DESCRIPTORS, MIN_MARGIN, MIN_SCORE, NEGATIVE_OPERATION, PATTERNS, RELATION_MIN_MARGIN, RELATION_MIN_SCORE, relation_query


def normalize(text):
    return unicodedata.normalize("NFKC", text).strip().lower()


def alias_pattern(alias):
    if re.fullmatch(r"[a-z ]+", alias):
        return rf"(?<![a-z]){re.escape(alias)}(?![a-z])"
    if len(alias) == 1:
        return rf"(?<![\u3400-\u9fff]){re.escape(alias)}(?![\u3400-\u9fff])"
    return re.escape(alias)


def noun_spans(text):
    spans = [(match.start(), match.end(), primitive) for primitive, aliases in ALIASES.items() for alias in aliases for match in re.finditer(alias_pattern(alias), text)]
    return [span for span in spans if not any(other[0] <= span[0] and other[1] >= span[1] and other[1]-other[0] > span[1]-span[0] for other in spans)]


def clean_negation(text):
    suffix = r"\s*(?:ではなく|ではない|じゃなく|じゃない|以外|でなく|を除く|は不要|は要らない|はいらない|は作らない|を作らない|にしない)"
    rejected = False
    for aliases in ALIASES.values():
        for alias in sorted(aliases, key=len, reverse=True):
            for expression in [alias_pattern(alias)+suffix, r"\b(?:not|without|no)\s+(?:a\s+)?"+alias_pattern(alias)]:
                text, count = re.subn(expression, " ", text)
                rejected = rejected or count > 0
    return text.strip(), rejected


def extract_phrases(text):
    for pattern in PATTERNS:
        match = re.search(pattern["regex"], text, flags=re.I)
        if not match:
            continue
        first, second = match[1].strip(), match[2].strip()
        if pattern["reverse"]:
            first, second = second, first
        return [first, second], pattern["name"]
    return [text], None


def relation_scope(text):
    """Only the requested relation clause controls operation negation/head.

    An unrelated later clause (e.g. do not add anything underneath) cannot erase
    an earlier positive composition. Punctuation inside matched slots is kept.
    """
    for pattern in PATTERNS:
        match = re.search(pattern["regex"], text, flags=re.I)
        if not match:
            continue
        start, end = match.span()
        stop = re.search(r"[。.!?！？;；、,]", text[end:])
        return text[start:end+(stop.start() if stop else len(text)-end)]
    return text


def validate_program(value):
    if not isinstance(value, dict) or type(value.get("version")) is not int or value["version"] != 1 or not isinstance(value.get("parts"), list) or not 1 <= len(value["parts"]) <= 2:
        return None
    if set(value) - {"version", "parts", "relation"}:
        return None
    result = {"version": 1, "parts": []}
    for index, part in enumerate(value["parts"]):
        if not isinstance(part, dict) or set(part) != {"id", "primitive", *BOUNDS} or part.get("id") != str(index) or not isinstance(part.get("primitive"), str) or part["primitive"] not in CAPTIONS:
            return None
        for key, (low, high) in BOUNDS.items():
            number = part.get(key)
            if not isinstance(number, (int, float)) or isinstance(number, bool) or not math.isfinite(number) or not low <= number <= high:
                return None
        result["parts"].append(dict(part))
    if len(result["parts"]) == 2:
        relation = value.get("relation")
        if not isinstance(relation, dict) or set(relation) != {"kind", "parent", "child"} or relation.get("kind") not in ("end", "above", "through") or relation.get("parent") != "0" or relation.get("child") != "1":
            return None
        result["relation"] = dict(relation)
    elif value.get("relation") is not None:
        return None
    return result


class ProgramModel:
    def __init__(self, model_dir):
        self.encoder = Embeddings(Path(model_dir))
        folder = Path(__file__).resolve().parent
        self.head = json.loads((folder / "relation-head.json").read_text())
        self.mean = np.array(self.head["mean"])
        self.scale = np.array(self.head["scale"])
        self.weights = np.array(self.head["weights"])
        self.bias = np.array(self.head["bias"])
        self.primitive_ids = [primitive for primitive, captions in CAPTIONS.items() for _ in list(captions)+ALIASES[primitive]]
        captions = [text for primitive, values in CAPTIONS.items() for text in list(values)+ALIASES[primitive]]
        self.primitive_vectors = self.encode_batch(captions)
        self.descriptor_ids = [(key, value) for key, values in DESCRIPTORS.items() for value, _ in values]
        self.descriptor_vectors = self.encode_batch([text for values in DESCRIPTORS.values() for _, text in values])
        self.background = self.encode_batch(BACKGROUND)

    def encode_batch(self, texts):
        return np.concatenate([self.encoder.encode(texts[i:i+8]) for i in range(0, len(texts), 8)])

    def relation(self, text):
        vector = self.encoder.encode([relation_query(text)])[0]
        logits = ((vector-self.mean)/self.scale) @ self.weights + self.bias
        probabilities = np.exp(logits-logits.max())
        probabilities /= probabilities.sum()
        return sorted([{"kind": label, "score": round(float(score), 6)} for label, score in zip(self.head["labels"], probabilities)], key=lambda item: item["score"], reverse=True)

    def descriptors(self, vector):
        groups = {}
        for (key, value), score in zip(self.descriptor_ids, self.descriptor_vectors @ vector):
            group = groups.setdefault(key, {})
            group[value] = max(group.get(value, -1), float(score))
        best = max(score for group in groups.values() for score in group.values())
        selected = {}
        for key, group in groups.items():
            pairs = sorted([(score, value) for value, score in group.items()], reverse=True)
            if pairs[0][0] > .68 and pairs[0][0]-pairs[1][0] > .15 and pairs[0][0] >= best-.035:
                selected[key] = pairs[0][1]
        return selected

    def part(self, text, index):
        spans = noun_spans(text)
        # A part phrase that mentions several different known objects is not a
        # single part. Do not silently discard a third object or wrong object.
        if len({span[2] for span in spans}) > 1:
            return None, [{"kind": "ambiguous-part-guard", "part": str(index)}]
        family_text = text[max(spans, key=lambda span: span[0])[0]:max(spans, key=lambda span: span[0])[1]] if spans else text
        vector = self.encoder.encode([family_text])[0]
        scores = {}
        for primitive, score in zip(self.primitive_ids, self.primitive_vectors @ vector):
            scores[primitive] = max(scores.get(primitive, -1), float(score))
        ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
        top, runner = ranked[:2]
        background_score = float(max(self.background @ vector))
        if top[1] < MIN_SCORE or top[1]-runner[1] < MIN_MARGIN or (not spans and top[1] <= background_score+.04):
            return None, [{"kind": "primitive-uncertain", "part": str(index)}]
        part = {"id": str(index), "primitive": top[0], **DEFAULTS[top[0]]}
        evidence = [{"kind": "embedding-primitive", "part": str(index), "primitive": top[0], "score": round(top[1], 6)}]
        if spans:
            evidence.append({"kind": "noun-focus-rule", "part": str(index)})
        attribute_text = text
        for start, end, _ in sorted(set(spans), reverse=True):
            attribute_text = attribute_text[:start]+" "+attribute_text[end:]
        if attribute_text.strip():
            for key, value in self.descriptors(self.encoder.encode([attribute_text])[0]).items():
                part[key] = value
                evidence.append({"kind": "embedding-descriptor", "part": str(index), "attribute": key})
        choices = {}
        for expression, changes in ANCHORS:
            for match in re.finditer(expression, text, flags=re.I):
                for key, value in changes.items():
                    existing = choices.get(key)
                    if existing is None or match.start() >= existing[0] or (match.start() <= existing[0] and match.end() > existing[1]):
                        choices[key] = (match.start(), match.end(), value)
        for key, (_, _, value) in choices.items():
            part[key] = value
            evidence.append({"kind": "explicit-attribute-rule", "part": str(index), "attribute": key})
        return part, evidence

    def interpret(self, text, previous=None):
        started = time.perf_counter()
        if not isinstance(text, str) or len(text) > 4000:
            raise ValueError("text must be a string of at most 4000 characters")
        normalized = normalize(text)
        cleaned, negated = clean_negation(normalized)
        def hold(reason, evidence=None):
            return {"program": None, "source": "unchanged", "modelMs": round((time.perf_counter()-started)*1000, 3), "reason": reason, "evidence": evidence or []}
        if not cleaned or not re.search(r"[\w\u3040-\u9fff]", cleaned):
            return hold("negated" if negated else "empty")
        scoped = relation_scope(cleaned)
        if re.search(NEGATIVE_OPERATION, scoped, flags=re.I):
            return hold("negated-operation", [{"kind": "negation-rule"}])
        if re.search(r"(?:[3-9]|三|四|五|六|七|八|九)\s*(?:個|つ|本|部位|parts)", cleaned):
            return hold("part-budget", [{"kind": "part-count-rule"}])
        phrases, extraction = extract_phrases(cleaned)
        evidence = [{"kind": "part-extraction-rule", "pattern": extraction, "parts": len(phrases)}] if extraction else []
        if len(phrases) == 2 and any(extract_phrases(phrase)[1] for phrase in phrases):
            return hold("part-budget", evidence)
        parts = []
        for index, phrase in enumerate(phrases):
            part, proof = self.part(phrase, index)
            evidence.extend(proof)
            if part is None:
                return hold("primitive-uncertain", evidence)
            parts.append(part)
        program = {"version": 1, "parts": parts}
        relation_candidates = []
        if len(parts) == 2:
            relation_candidates = self.relation(scoped)
            top, runner = relation_candidates[:2]
            evidence.extend([{"kind": "relation-input-mask-rule"}, {"kind": "learned-relation-head", "label": top["kind"], "score": top["score"]}])
            if top["kind"] == "none" or top["score"] < RELATION_MIN_SCORE or top["score"]-runner["score"] < RELATION_MIN_MARGIN:
                return hold("relation-uncertain", evidence)
            program["relation"] = {"kind": top["kind"], "parent": "0", "child": "1"}
        validated = validate_program(program)
        if not validated:
            return hold("invalid-program", evidence)
        return {"program": validated, "source": "semantic-model", "modelMs": round((time.perf_counter()-started)*1000, 3), "reason": "selected", "evidence": evidence, "relationCandidates": relation_candidates}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()
    print(json.dumps(ProgramModel(args.model_dir).interpret(args.text), ensure_ascii=False))


if __name__ == "__main__":
    main()
