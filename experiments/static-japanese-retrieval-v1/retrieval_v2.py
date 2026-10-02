#!/usr/bin/env python3
"""Independent CPU-only embedding/cosine retrieval experiment. No UI integration."""
import argparse
import collections
import hashlib
import json
import math
import os
import re
import resource
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
import numpy as np
from tokenizers import Tokenizer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEFAULT_LOCAL = ROOT / ".local/static-japanese-v1"
REVISION = "95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_new(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x") as stream:
        json.dump(obj, stream, ensure_ascii=False, indent=2)
        stream.write("\n")

def normalized(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text).lower()).strip()

def unit(vector):
    norm = float(np.linalg.norm(vector))
    return vector / norm if norm > 1e-12 else None

class StaticEncoder:
    def __init__(self, local, variant):
        dims, dtype = variant.split("-", 1)
        self.dims = int(dims)
        self.dtype = np.dtype("<f4" if dtype == "float32" else "<f2")
        manifest = json.loads((local / "model-manifest.json").read_text())
        record = next(x for x in manifest["tables"] if x["file"] == "table-" + variant + ".bin")
        path = local / "tables" / record["file"]
        if path.stat().st_size != record["bytes"] or sha(path) != record["sha256"]:
            raise ValueError("untrusted/mismatched table")
        self.table = np.fromfile(path, dtype=self.dtype).reshape(32768, self.dims)
        if not np.isfinite(self.table).all():
            raise ValueError("nonfinite table")
        tok = local / "source" / REVISION / "0_StaticEmbedding/tokenizer.json"
        expected = next(x for x in manifest["sourceFiles"] if x["path"].endswith("tokenizer.json"))
        if tok.stat().st_size > 3000000 or sha(tok) != expected["sha256"]:
            raise ValueError("tokenizer exceeds limits or hash mismatch")
        self.tokenizer = Tokenizer.from_file(str(tok))
        self.tokenizer.no_padding()
        self.tokenizer.no_truncation()
        self.unk_id = 3
        self.bytes = self.table.nbytes
        self.tokenizer_bytes = tok.stat().st_size

    def encode_raw(self, text):
        if not isinstance(text, str) or len(text) > 4000:
            return None, {"hold": "input_limit"}
        encoding = self.tokenizer.encode(text, add_special_tokens=False)
        ids = encoding.ids
        if len(ids) > 4000:
            return None, {"hold": "token_limit", "tokens": len(ids)}
        if not ids:
            return np.zeros(self.dims, dtype=np.float32), {"tokens": 0, "unknownFraction": 0.0}
        if min(ids) < 0 or max(ids) >= len(self.table):
            return None, {"hold": "invalid_token_id"}
        total = np.zeros(self.dims, dtype=np.float32)
        for start in range(0, len(ids), 64):
            total += self.table[ids[start:start + 64]].astype(np.float32).sum(axis=0, dtype=np.float32)
        return total / len(ids), {"tokens": len(ids), "unknownFraction": ids.count(self.unk_id) / len(ids)}

    def encode(self, text):
        vector, meta = self.encode_raw(text)
        if vector is None:
            return None, meta
        if meta.get("unknownFraction", 0) > .8:
            return None, dict(meta, hold="unknown_tokens")
        vector = unit(vector)
        return vector, dict(meta, **({"hold": "empty_vector"} if vector is None else {}))

class ChargramEncoder:
    def __init__(self, captions):
        pieces = [self.pieces(text) for text in captions]
        df = collections.Counter(piece for row in pieces for piece in row)
        self.vocab = {piece: i for i, piece in enumerate(sorted(df))}
        self.idf = np.array([math.log((1 + len(pieces)) / (1 + df[piece])) + 1 for piece in self.vocab], dtype=np.float32)
        self.dims = len(self.vocab)
        self.bytes = self.idf.nbytes
        self.tokenizer_bytes = 0

    @staticmethod
    def pieces(text):
        value = normalized(text)
        return collections.Counter(value[i:i + n] for n in range(1, 4) for i in range(len(value) - n + 1) if value[i:i + n].strip())

    def encode(self, text):
        if not isinstance(text, str) or len(text) > 4000:
            return None, {"hold": "input_limit"}
        pieces = self.pieces(text)
        vec = np.zeros(self.dims, dtype=np.float32)
        for piece, count in pieces.items():
            if piece in self.vocab:
                index = self.vocab[piece]
                vec[index] = (1 + math.log(count)) * self.idf[index]
        result = unit(vec)
        return result, {"hold": "empty_vector"} if result is None else {}

def alias_hits(text, entries):
    value = normalized(text)
    matches = []
    for entry in entries:
        for alias in entry["aliases"]:
            term = normalized(alias)
            # Latin words and one Japanese glyph must have an explicit boundary.
            if re.fullmatch(r"[a-z -]+", term):
                pattern = r"(?<![a-z])" + re.escape(term) + r"(?![a-z])"
            elif len(term) == 1:
                pattern = r"(?<![\u3400-\u9fff])" + re.escape(term) + r"(?![\u3400-\u9fff])"
            else:
                pattern = re.escape(term)
            for match in re.finditer(pattern, value):
                matches.append((match.start(), match.end(), entry["label"], term))
    chosen = []
    for hit in sorted(matches, key=lambda x: (-(x[1] - x[0]), x[0])):
        if not any(hit[0] < other[1] and hit[1] > other[0] for other in chosen):
            chosen.append(hit)
    return sorted(set(x[2] for x in chosen))

def scope(text, entries):
    value = normalized(text)
    if re.search(r"ない|ません|不要|使わず|除い|やめ|ではなく|じゃなく|\b(?:not|without|don't|dont|never|no)\b", value):
        return "hold", "authored_negation_veto"
    hits = alias_hits(text, entries)
    if len(hits) > 1 or re.search(r"(?:\sと\s|および|そして|上に|下に|先に|端に|貫く)|\b(?:and|plus|with|through|above|below)\b", value):
        return "hold", "authored_single_object_scope"
    return None, None

class Retriever:
    def __init__(self, local, variant, inventory):
        self.inventory = inventory
        self.entries = {reg: [x for x in inventory if x["registry"] == reg] for reg in ["shape", "primitive"]}
        captions = [caption for entry in inventory for caption in entry["captions"]]
        self.encoder = ChargramEncoder(captions) if variant == "chargram" else StaticEncoder(local, variant)
        self.indices = {}
        for registry, entries in self.entries.items():
            vectors, labels, texts = [], [], []
            for entry in entries:
                for text in entry["captions"]:
                    vector, meta = self.encoder.encode(text)
                    if vector is None:
                        raise ValueError("caption could not encode: " + text)
                    vectors.append(vector)
                    labels.append(entry["label"])
                    texts.append(text)
            self.indices[registry] = (np.stack(vectors), labels, texts)
        self.index_bytes = sum(x[0].nbytes for x in self.indices.values())

    def rank(self, text, registry):
        vector, meta = self.encoder.encode(text)
        if vector is None:
            return [], meta
        matrix, labels, captions = self.indices[registry]
        scores = np.sum(matrix * vector, axis=1, dtype=np.float32)
        if not np.isfinite(scores).all():
            return [], dict(meta, hold="nonfinite_similarity")
        best = {}
        for i, label in enumerate(labels):
            if label not in best or float(scores[i]) > best[label][0]:
                best[label] = (float(scores[i]), captions[i])
        ranked = [{"label": label, "score": score, "caption": caption} for label, (score, caption) in sorted(best.items(), key=lambda x: (-x[1][0], x[0]))]
        ranked[0]["margin"] = ranked[0]["score"] - ranked[1]["score"]
        return ranked, meta

    def predict(self, text, registry, thresholds, guarded):
        ranked, meta = self.rank(text, registry)
        result = {"prediction": None, "source": "hold", "reason": meta.get("hold"), "top": ranked[:3], "encoding": meta}
        # Limits/empty/unknown veto also apply to exact aliases.
        if not ranked:
            return result
        if guarded:
            label, reason = scope(text, self.entries[registry])
            if label is not None:
                result.update(prediction=None if label == "hold" else label, source="rules", reason=reason)
                return result
        top = ranked[0]
        if top["score"] >= thresholds["score"] and top["margin"] >= thresholds["margin"]:
            result.update(prediction=top["label"], source="embedding", reason="cosine_and_margin")
        else:
            result["reason"] = "low_score_or_margin"
        return result

def metrics(rows, predictions, inventory):
    family = {(x["registry"], x["label"]): x["family"] for x in inventory}
    positives = [(r, p) for r, p in zip(rows, predictions) if r["target"] is not None]
    negatives = [(r, p) for r, p in zip(rows, predictions) if r["target"] is None]
    accepted = [(r, p) for r, p in positives if p["prediction"] is not None]
    exact = sum(p["prediction"] == r["target"] for r, p in positives)
    wrong = len(accepted) - exact
    near = sum(p["prediction"] is not None and family.get((r["registry"], p["prediction"])) == family.get((r["registry"], r["target"])) for r, p in positives)
    false = sum(p["prediction"] is not None for r, p in negatives)
    by_category = {}
    for category in sorted(set(r["category"] for r in rows)):
        selected = [(r, p) for r, p in zip(rows, predictions) if r["category"] == category]
        by_category[category] = {"rows": len(selected), "accepted": sum(p["prediction"] is not None for r, p in selected), "exactCorrect": sum(r["target"] is not None and p["prediction"] == r["target"] for r, p in selected)}
    return {"rows": len(rows), "positiveRows": len(positives), "negativeRows": len(negatives),
            "positiveAccepted": len(accepted), "positiveCoverage": len(accepted) / max(1, len(positives)),
            "exactCorrect": exact, "exactAccuracy": exact / max(1, len(positives)),
            "acceptedExactPrecision": exact / max(1, len(accepted)), "wrongPositive": wrong,
            "nearFamilyCorrect": near, "nearFamilyAccuracy": near / max(1, len(positives)),
            "negativeFalsePositive": false, "negativeFalsePositiveRate": false / max(1, len(negatives)),
            "byCategory": by_category}

def calibration(local, output):
    inventory = json.loads((HERE / "captions.json").read_text())["entries"]
    rows = json.loads((HERE / "calibration.json").read_text())["rows"]
    plan = json.loads((HERE / "method-plan-v2.json").read_text())
    frozen = {"version": 1, "methodSha256": sha(HERE / "method-plan-v2.json"), "captionsSha256": sha(HERE / "captions.json"), "calibrationSha256": sha(HERE / "calibration.json"), "runtimeSha256": sha(HERE / "retrieval_v2.py"), "thresholds": {}, "calibrationResults": {}, "selection": plan["selection"]}
    for variant in plan["variants"]:
        retriever = Retriever(local, variant, inventory)
        frozen["thresholds"][variant] = {}
        frozen["calibrationResults"][variant] = {}
        for registry in plan["registries"]:
            selected = [r for r in rows if r["registry"] == registry]
            frozen["thresholds"][variant][registry] = {}
            frozen["calibrationResults"][variant][registry] = {}
            for guarded in [False, True]:
                key = "guarded" if guarded else "retrieval_only"
                candidates = []
                # Rank once; threshold grid never changes captions/features.
                ranks = [retriever.rank(r["text"], registry) for r in selected]
                guards = [scope(r["text"], retriever.entries[registry]) for r in selected]
                for score in plan["scoreThresholds"]:
                    for margin in plan["marginThresholds"]:
                        predictions = []
                        for (rank, meta), (label, reason) in zip(ranks, guards):
                            pred = None
                            if rank:
                                if guarded and label is not None:
                                    pred = None if label == "hold" else label
                                elif rank[0]["score"] >= score and rank[0]["margin"] >= margin:
                                    pred = rank[0]["label"]
                            predictions.append({"prediction": pred})
                        report = metrics(selected, predictions, inventory)
                        mistakes = report["wrongPositive"] + report["negativeFalsePositive"]
                        objective = report["exactCorrect"] - 5 * mistakes
                        candidates.append(((objective, -mistakes, report["exactCorrect"], score, margin), {"score": score, "margin": margin}, report))
                _, threshold, report = max(candidates, key=lambda x: x[0])
                frozen["thresholds"][variant][registry][key] = threshold
                frozen["calibrationResults"][variant][registry][key] = report
    frozen["selectedCandidate"] = "128-float32"
    frozen["selectedCandidateReason"] = "16MiB token table; float16 is diagnostic comparison only pending independent results; no app adoption"
    write_new(output, frozen)
    print(json.dumps(frozen["thresholds"], ensure_ascii=False))

def evaluate(local, fixture, frozen_path, output):
    inventory = json.loads((HERE / "captions.json").read_text())["entries"]
    rows = json.loads(fixture.read_text())["rows"]
    frozen = json.loads(frozen_path.read_text())
    for filename, key in [("captions.json", "captionsSha256"), ("method-plan-v2.json", "methodSha256"), ("retrieval_v2.py", "runtimeSha256")]:
        if sha(HERE / filename) != frozen[key]:
            raise ValueError("frozen candidate changed: " + filename)
    output_data = {"fixtureSha256": sha(fixture), "frozenSha256": sha(frozen_path), "fixtures": str(fixture.name), "results": {}, "rawTop1Agreement": {}}
    top_predictions = {}
    for variant in frozen["thresholds"]:
        retriever = Retriever(local, variant, inventory)
        output_data["results"][variant] = {}
        for guarded in [False, True]:
            key = "guarded" if guarded else "retrieval_only"
            predictions = []
            for row in rows:
                start = time.perf_counter()
                prediction = retriever.predict(row["text"], row["registry"], frozen["thresholds"][variant][row["registry"]][key], guarded)
                prediction["elapsedMs"] = (time.perf_counter() - start) * 1000
                predictions.append(prediction)
            output_data["results"][variant][key] = {"metrics": metrics(rows, predictions, inventory), "rows": [{**r, **p} for r, p in zip(rows, predictions)]}
            if not guarded:
                top_predictions[variant] = [p["top"][0]["label"] if p["top"] else None for p in predictions]
    for variant in ["128-float32", "128-float16"]:
        full = top_predictions["1024-float32"]
        other = top_predictions[variant]
        output_data["rawTop1Agreement"]["1024-vs-" + variant] = {"same": sum(a == b for a, b in zip(full, other)), "total": len(rows)}
    output_data["rawTop1Agreement"]["128-f32-vs-f16"] = {"same": sum(a == b for a, b in zip(top_predictions["128-float32"], top_predictions["128-float16"])), "total": len(rows)}
    write_new(output, output_data)
    print(json.dumps({v: {k: r["metrics"] for k, r in bymode.items()} for v, bymode in output_data["results"].items()}, ensure_ascii=False))

def benchmark(local, variant, output):
    before = time.perf_counter()
    inventory = json.loads((HERE / "captions.json").read_text())["entries"]
    retriever = Retriever(local, variant, inventory)
    setup_ms = (time.perf_counter() - before) * 1000
    texts = ["首が細くて花を生ける器", "硬い甲羅を背負う動物", "一滴の水が落ちる", "丸い断面が長く続く部品", "六方向に伸びる結晶", "球を作らないで", "今日は学校に行った", "a hollow rounded container"]
    for text in texts:
        retriever.rank(text, "shape")
    timings = []
    for i in range(240):
        start = time.perf_counter()
        retriever.rank(texts[i % len(texts)], "shape")
        timings.append((time.perf_counter() - start) * 1000)
    stress = {}
    for size in [128, 1024, 4000, 4001]:
        text = ("今日は水の形を考えました。" * 400)[:size]
        start = time.perf_counter()
        ranking, meta = retriever.rank(text, "shape")
        stress[str(size)] = {"elapsedMs": (time.perf_counter() - start) * 1000, "encoding": meta, "rankingReturned": bool(ranking)}
    rss = int(subprocess.check_output(["ps", "-o", "rss=", "-p", str(os.getpid())], text=True).strip()) * 1024
    report = {"variant": variant, "platform": sys.platform, "python": sys.version.split()[0], "pid": os.getpid(),
              "tableResidentArrayBytes": retriever.encoder.bytes, "captionIndexArrayBytes": retriever.index_bytes,
              "tokenizerFileBytes": retriever.encoder.tokenizer_bytes,
              "processRSSBytesAfterWarmAndStress": rss, "processPeakRSSBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
              "peakRSSUnits": "bytes on macOS", "setupMsIncludesHashTableLoadTokenizerAndCaptionIndex": setup_ms,
              "warmEncodeRankMs": {"n": len(timings), "median": float(np.median(timings)), "p95": float(np.percentile(timings, 95)), "max": max(timings)},
              "stress": stress, "limits": {"chars": 4000, "tokens": 4000},
              "interpretation": "independent Python CPU process in locked-screen multi-agent session; not whole-app memory, idle CPU or visual/play benchmark"}
    write_new(output, report)
    print(json.dumps(report, ensure_ascii=False))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["calibrate", "evaluate", "benchmark"])
    parser.add_argument("--local", type=Path, default=DEFAULT_LOCAL)
    parser.add_argument("--fixture", type=Path)
    parser.add_argument("--frozen", type=Path, default=HERE / "frozen-candidate.json")
    parser.add_argument("--variant", default="128-float32")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "calibrate":
        calibration(args.local, args.output)
    elif args.command == "evaluate":
        evaluate(args.local, args.fixture, args.frozen, args.output)
    else:
        benchmark(args.local, args.variant, args.output)

if __name__ == "__main__":
    main()
