#!/usr/bin/env python3
"""Fetch pinned public data only, verify sizes and hashes, then extract prefix tables.

No remote Python is executed. No pickle/torch models are accepted. Existing files
must match pinned source bytes; outputs use exclusive creation and are immutable.
"""
import argparse
import hashlib
import json
import os
import struct
import urllib.request
from pathlib import Path

REVISION = "95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3"
BASE = "https://huggingface.co/hotchpotch/static-embedding-japanese/resolve/" + REVISION + "/"
SOURCES = {
    "0_StaticEmbedding/model.safetensors": (134217824, "f0c60b3d2952fb89e67a063ac4aa558ff4b02facaac5fd674d637b9e2c52ccca", "sha256"),
    "0_StaticEmbedding/tokenizer.json": (2127941, "2e8ed6acb7b0779518ac6da8ea260aa4c2f03a56", "gitblob"),
    "README.md": (28860, "aa889bba0ca3dae3ad1a5a50afe80b167ed037d2", "gitblob"),
    "config_sentence_transformers.json": (205, "d79e53e7906c4b0c432f2a176f3f813b2e7b2ff2", "gitblob"),
    "modules.json": (134, "ccc0b0011980186beef71c058f8fc41ae008fa13", "gitblob"),
}

def digest(data, kind):
    return (hashlib.sha256(data).hexdigest() if kind == "sha256" else
            hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest())

def immutable(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise RuntimeError("existing artifact differs: " + str(path))
        return
    with path.open("xb") as stream:
        stream.write(data)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--local", type=Path, required=True)
    args = p.parse_args()
    source = args.local / "source" / REVISION
    records = []
    for filename, (size, expected, algorithm) in SOURCES.items():
        path = source / filename
        if path.exists():
            data = path.read_bytes()
        else:
            with urllib.request.urlopen(BASE + filename, timeout=120) as response:
                data = response.read(size + 1)
        if len(data) != size or digest(data, algorithm) != expected:
            raise RuntimeError("size/hash mismatch: " + filename)
        immutable(path, data)
        records.append({"path": filename, "url": BASE + filename, "bytes": len(data),
                        "sha256": hashlib.sha256(data).hexdigest(), "upstreamHash": expected,
                        "upstreamAlgorithm": algorithm})
        print("verified", filename, len(data), flush=True)

    model_path = source / "0_StaticEmbedding/model.safetensors"
    with model_path.open("rb") as stream:
        header_length = struct.unpack("<Q", stream.read(8))[0]
        if header_length > 65536:
            raise RuntimeError("safetensors header exceeds limit")
        header = json.loads(stream.read(header_length))
    tensors = {k: v for k, v in header.items() if k != "__metadata__"}
    expected_tensor = {"dtype": "F32", "shape": [32768, 1024], "data_offsets": [0, 134217728]}
    if tensors != {"embedding.weight": expected_tensor}:
        raise RuntimeError("unexpected tensors: " + repr(tensors))
    if 8 + header_length + 134217728 != model_path.stat().st_size:
        raise RuntimeError("unexpected model payload length")
    import numpy as np
    from safetensors.numpy import load_file
    weights = load_file(str(model_path))["embedding.weight"]
    if not np.isfinite(weights).all():
        raise RuntimeError("nonfinite model tensor")
    variants = []
    for dims, dtype in [(1024, "float32"), (128, "float32"), (128, "float16")]:
        table = np.ascontiguousarray(weights[:, :dims], dtype=dtype)
        payload = table.astype("<f4" if dtype == "float32" else "<f2", copy=False).tobytes()
        filename = "table-%d-%s.bin" % (dims, dtype)
        immutable(args.local / "tables" / filename, payload)
        variants.append({"file": filename, "shape": list(table.shape), "dtype": dtype,
                         "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(),
                         "method": "first dimensions of original embedding.weight; no retraining"})
    tok = json.loads((source / "0_StaticEmbedding/tokenizer.json").read_text())
    summary = {"model": "hotchpotch/static-embedding-japanese", "revision": REVISION,
               "sourceFiles": records, "safetensorsHeader": header, "tables": variants,
               "tokenizer": {k: tok.get(k) for k in ["normalizer", "pre_tokenizer", "post_processor", "padding", "truncation"]},
               "tokenizerModel": {k: tok["model"].get(k) for k in ["type", "unk_id", "byte_fallback"]},
               "tokenizerVocabSize": len(tok["model"]["vocab"]),
               "license": {"metadata": "MIT", "authorStatement": "model weights and training code are MIT", "standaloneLicenseFile": False}}
    immutable(args.local / "model-manifest.json", (json.dumps(summary, ensure_ascii=False, indent=2) + "\n").encode())
    print(json.dumps({"tables": variants, "tokenizerModel": summary["tokenizerModel"]}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
