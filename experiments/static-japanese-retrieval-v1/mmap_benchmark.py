#!/usr/bin/env python3
"""Same frozen lookup math with read-only mapping; measures a separate process.

Model/table file identity is checked by bounded streaming SHA. Source preparation
has checked all floats; only immutable hash-matching tables can be mapped. Mapping
size is a virtual/file amount, never claimed as resident process memory.
"""
import argparse
import hashlib
import json
import os
import resource
import subprocess
import sys
import time
from pathlib import Path
import numpy as np
from tokenizers import Tokenizer
import retrieval_v2 as base

def stream_sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()

class MappedStaticEncoder(base.StaticEncoder):
    def __init__(self, local, variant):
        dims, dtype = variant.split("-", 1)
        self.dims = int(dims)
        self.dtype = np.dtype("<f4" if dtype == "float32" else "<f2")
        manifest = json.loads((local / "model-manifest.json").read_text())
        record = next(x for x in manifest["tables"] if x["file"] == "table-" + variant + ".bin")
        path = local / "tables" / record["file"]
        if path.stat().st_size != record["bytes"] or stream_sha(path) != record["sha256"]:
            raise ValueError("mismatched table")
        self.table = np.memmap(path, dtype=self.dtype, mode="r", shape=(32768, self.dims))
        tok = local / "source" / base.REVISION / "0_StaticEmbedding/tokenizer.json"
        expected = next(x for x in manifest["sourceFiles"] if x["path"].endswith("tokenizer.json"))
        if tok.stat().st_size > 3000000 or stream_sha(tok) != expected["sha256"]:
            raise ValueError("tokenizer exceeds limits or hash mismatch")
        self.tokenizer = Tokenizer.from_file(str(tok))
        self.tokenizer.no_padding()
        self.tokenizer.no_truncation()
        self.unk_id = 3
        self.bytes = 0
        self.mapped_bytes = self.table.nbytes
        self.tokenizer_bytes = tok.stat().st_size

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--variant", required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    start = time.perf_counter()
    base.StaticEncoder = MappedStaticEncoder
    inventory = json.loads((base.HERE / "captions.json").read_text())["entries"]
    engine = base.Retriever(base.DEFAULT_LOCAL, args.variant, inventory)
    setup_ms = (time.perf_counter() - start) * 1000
    texts = ["首が細くて花を生ける器", "硬い甲羅を背負う動物", "一滴の水が落ちる", "丸い断面が長く続く部品", "六方向に伸びる結晶", "球を作らないで", "今日は学校に行った", "a hollow rounded container"]
    for text in texts:
        engine.rank(text, "shape")
    timings = []
    for i in range(240):
        before = time.perf_counter()
        engine.rank(texts[i % len(texts)], "shape")
        timings.append((time.perf_counter() - before) * 1000)
    stress = {}
    for size in [128, 1024, 4000, 4001]:
        text = ("今日は水の形を考えました。" * 400)[:size]
        before = time.perf_counter()
        rank, meta = engine.rank(text, "shape")
        stress[str(size)] = {"elapsedMs": (time.perf_counter() - before) * 1000, "encoding": meta, "rankingReturned": bool(rank)}
    rss = int(subprocess.check_output(["ps", "-o", "rss=", "-p", str(os.getpid())], text=True).strip()) * 1024
    report = {"variant": args.variant, "storage": "read-only mmap", "tableOwnedArrayBytes": 0,
              "tableVirtualMappedBytes": engine.encoder.mapped_bytes, "captionIndexArrayBytes": engine.index_bytes,
              "tokenizerFileBytes": engine.encoder.tokenizer_bytes, "processRSSBytesAfterWarmAndStress": rss,
              "processPeakRSSBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, "peakRSSUnits": "bytes on macOS",
              "setupMsIncludesStreamingSHAAndTokenizerAndCaptionIndex": setup_ms,
              "warmEncodeRankMs": {"n": len(timings), "median": float(np.median(timings)), "p95": float(np.percentile(timings, 95)), "max": max(timings)},
              "stress": stress,
              "scope": "same frozenv2 data, tokenization and math; cache state uncontrolled; short locked-screen multi-agent CPU run; no app memory or calm idle claim"}
    base.write_new(args.output, report)
    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
