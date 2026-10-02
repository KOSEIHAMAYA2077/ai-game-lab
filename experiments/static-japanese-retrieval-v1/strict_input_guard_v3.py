#!/usr/bin/env python3
"""Safety diagnostic proposed after candidate freeze; headline evaluation stays v2.

Unigram can merge thousands of unseen glyphs into one UNK token. Token-count
fractions therefore do not bound unseen text coverage. This wrapper counts unknown
character spans and requires a meaningful known token; it changes no embedding,
caption or selected similarity/margin threshold.
"""
import argparse
import json
from pathlib import Path
from retrieval_v2 import HERE, DEFAULT_LOCAL, Retriever, normalized, write_new

def strict_input_status(text, tokenizer):
    if not isinstance(text, str) or len(text) > 4000:
        return {"hold": "input_limit"}
    encoding = tokenizer.encode(text, add_special_tokens=False)
    if len(encoding.ids) > 4000:
        return {"hold": "token_limit"}
    meaningful = [token for token, token_id in zip(encoding.tokens, encoding.ids) if token_id != 3 and token.replace("▁", "").strip()]
    unknown = set()
    for token_id, (start, end) in zip(encoding.ids, encoding.offsets):
        if token_id == 3:
            unknown.update(i for i in range(max(0, start), min(len(text), end)) if not text[i].isspace())
    total = sum(not char.isspace() for char in text)
    fraction = len(unknown) / max(1, total)
    result = {"unknownCharacterSpanFraction": fraction, "knownMeaningfulTokenCount": len(meaningful), "tokens": len(encoding.ids)}
    if not meaningful or fraction > .8:
        result["hold"] = "unknown_or_empty_text"
    return result

def main():
    inventory = json.loads((HERE / "captions.json").read_text())["entries"]
    frozen = json.loads((HERE / "frozen-candidate-v2.json").read_text())
    engine = Retriever(DEFAULT_LOCAL, "128-float32", inventory)
    cases = [("empty", ""), ("spaces", " \n\t　"), ("unknown_emoji", "😀" * 4000), ("mixed_unknown", "球" + "😀" * 3999), ("known", "丸い球"), ("known_ascii", "a solid round ball"), ("too_long", "a" * 4001)]
    results = []
    for name, text in cases:
        status = strict_input_status(text, engine.encoder.tokenizer)
        original = engine.predict(text, "shape", frozen["thresholds"]["128-float32"]["shape"]["guarded"], True)
        if name not in ["known", "known_ascii"]:
            assert "hold" in status
        else:
            assert "hold" not in status
        results.append({"case": name, "characters": len(text), "strictStatus": status, "frozenV2Prediction": original["prediction"], "frozenV2Reason": original["reason"]})
    calibration = json.loads((HERE / "calibration.json").read_text())["rows"]
    additional_holds = [r["id"] for r in calibration if strict_input_status(r["text"], engine.encoder.tokenizer).get("hold") and r["text"].strip()]
    report = {"status": "proposed safety wrapper; not included in independent frozenv2 accuracy results", "reason": "own numerical edge case before viewing fresh evaluator results; Unigram token-unknown ratio misses merged unknown spans", "policy": "4000characters/4000tokens; meaningful known token and <=.8 unknowncharactercoverage; all embeddings/captions/thresholds unchanged", "cases": results, "calibrationNonemptyAdditionalHolds": additional_holds}
    write_new(HERE / "strict-input-guard-v3-checks.json", report)
    print(json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
