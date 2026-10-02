#!/usr/bin/env python3
"""Check lookup/mean/truncation numerics without importing Torch or remote code."""
import hashlib
import json
import warnings
from pathlib import Path
import numpy as np
from retrieval_v2 import StaticEncoder, Retriever, DEFAULT_LOCAL, HERE, write_new

def main():
    inventory = json.loads((HERE / "captions.json").read_text())["entries"]
    cal = json.loads((HERE / "calibration.json").read_text())["rows"]
    samples = ["球", "花を生ける器", "a solid round ball", "箱ではない", "😀🧠💧", "", "　ＡＢＣ１２３　", "葉っぱが落ちた"]
    full = StaticEncoder(DEFAULT_LOCAL, "1024-float32")
    small = StaticEncoder(DEFAULT_LOCAL, "128-float32")
    half = StaticEncoder(DEFAULT_LOCAL, "128-float16")
    checks = []
    for text in samples:
        a = full.tokenizer.encode(text, add_special_tokens=False)
        b = small.tokenizer.encode(text, add_special_tokens=False)
        c = half.tokenizer.encode(text, add_special_tokens=False)
        assert a.ids == b.ids == c.ids
        av, am = full.encode_raw(text)
        bv, bm = small.encode_raw(text)
        cv, cm = half.encode_raw(text)
        manual = np.zeros(1024, dtype=np.float64)
        for token in a.ids:
            manual += full.table[token].astype(np.float64)
        if a.ids:
            manual /= len(a.ids)
        mean_error = float(np.max(np.abs(av - manual)))
        prefix_error = float(np.max(np.abs(av[:128] - bv)))
        half_error = float(np.max(np.abs(bv - cv)))
        assert mean_error < 1e-5 and prefix_error < 1e-6
        checks.append({"text": text, "ids": a.ids, "tokens": a.tokens,
                       "sameTokenIDsAllVariants": True, "manualFloat64MeanMaxAbsoluteError": mean_error,
                       "truncateFullMeanVsPrefixTableMeanMaxAbsoluteError": prefix_error,
                       "halfVsFloatMeanMaxAbsoluteError": half_error, "encoding": am})
    # Per-token table identity, not only averaged final outputs.
    ids = sorted(set(full.tokenizer.encode(r["text"], add_special_tokens=False).ids[i]
                     for r in cal for i in range(len(full.tokenizer.encode(r["text"], add_special_tokens=False).ids))))
    token_error = float(np.max(np.abs(full.table[ids, :128] - small.table[ids])))
    assert token_error == 0.0
    all_texts = [r["text"] for r in cal] + [c for e in inventory for c in e["captions"]]
    same = all(full.tokenizer.encode(t, add_special_tokens=False).ids == small.tokenizer.encode(t, add_special_tokens=False).ids for t in all_texts)
    assert same
    # Rounded published example in pinned author model card; no training or tuning.
    query = "美味しいラーメン屋に行きたい"
    docs = ["素敵なカフェが近所にあるよ。落ち着いた雰囲気でゆっくりできるし、窓際の席からは公園の景色も見えるんだ。", "新鮮な魚介を提供する店です。地元の漁師から直接仕入れているので鮮度は抜群ですし、料理人の腕も確かです。", "あそこは行きにくいけど、隠れた豚骨の名店だよ。スープが最高だし、麺の硬さも好み。", "おすすめの中華そばの店を教えてあげる。とりわけチャーシューが手作りで柔らかくてジューシーなんだ。"]
    parity = {}
    for encoder, name, reported in [(full, "1024-float32", [0.1040, 0.2521, 0.4835, 0.3199]), (small, "128-float32", [0.1464, 0.3094, 0.5923, 0.3405])]:
        q, meta = encoder.encode(query)
        values = [float(np.sum(encoder.encode(doc)[0] * q)) for doc in docs]
        error = max(abs(a - b) for a, b in zip(values, reported))
        assert error <= 0.0001, (name, values, error)
        parity[name] = {"computedCosines": values, "authorRoundedCosines": reported, "maxAbsoluteDifference": error,
                        "source": "pinned model card published example; 4decimal rounding tolerance1e-4"}
    engine = Retriever(DEFAULT_LOCAL, "128-float32", inventory)
    safety = {}
    for text, expected in [("", "empty_vector"), ("a" * 4001, "input_limit"), ("😀" * 4000, "unknown_tokens")]:
        rank, meta = engine.rank(text, "shape")
        passed = not rank and meta.get("hold") == expected
        if expected != "unknown_tokens":
            assert passed, (text[:10], meta)
        safety[expected] = {"passed": passed, "characters": len(text), "encoding": meta, "rankingReturned": bool(rank)}
    report = {"implementation": "NumPy direct mean checked against scalar float64 sums; no PyTorch installed in system/base-conda/zero-dl, so EmbeddingBag live parity not claimed",
              "tokenizerBaseVocab": 32702, "tokenizerAddedTokens": 66, "tokenizerTotalVocab": full.tokenizer.get_vocab_size(),
              "sourceShape": list(full.table.shape), "samples": checks, "allCalibrationAndCaptionTokenIDsIdentical": same,
              "pairedTextCount": len(all_texts), "uniqueCalibrationTokenIDs": len(ids), "perTokenPrefixMaxAbsoluteError": token_error,
              "publishedExampleParity": parity, "safety": safety}
    write_new(HERE / "numerical-checks.json", report)
    print(json.dumps({k: v for k, v in report.items() if k not in ["samples"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
