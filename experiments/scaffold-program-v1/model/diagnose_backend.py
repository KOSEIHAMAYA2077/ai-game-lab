"""Compare fixed CPU ORT optimization modes; no training and no source changes.

This development diagnosis explains near-threshold backend sensitivity. Browser
WASM results are measured separately by the independent evaluator.
"""
import argparse
import json
from pathlib import Path
import time

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

from config import relation_query


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    tokenizer = Tokenizer.from_file(str(args.model_dir / "tokenizer.json"))
    tokenizer.enable_truncation(max_length=128, direction="left")
    tokenizer.enable_padding(pad_id=tokenizer.token_to_id("<pad>"), pad_token="<pad>")
    head = json.loads((Path(__file__).parent / "relation-head.json").read_text())
    mean, scale, weights, bias = [np.array(head[key]) for key in ["mean", "scale", "weights", "bias"]]
    texts = ["管の先端に球体をつなげた構造", "棒の先に球", "小さな玉の上に、巨大な玉を置く", "箱を輪が貫く", "箱を貫く管を組み合わせて"]
    rows = []
    reference = None
    for name, level in [("none", ort.GraphOptimizationLevel.ORT_DISABLE_ALL), ("basic", ort.GraphOptimizationLevel.ORT_ENABLE_BASIC), ("extended", ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED), ("all", ort.GraphOptimizationLevel.ORT_ENABLE_ALL)]:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.log_severity_level = 3
        options.graph_optimization_level = level
        session = ort.InferenceSession(str(args.model_dir / "onnx/model_qint8_arm64.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
        names = {value.name for value in session.get_inputs()}
        vectors = []
        for text in texts:
            masked = relation_query(text)
            encoded = tokenizer.encode_batch([masked])
            feed = {"input_ids": np.array([item.ids for item in encoded], dtype=np.int64), "attention_mask": np.array([item.attention_mask for item in encoded], dtype=np.int64), "token_type_ids": np.array([item.type_ids for item in encoded], dtype=np.int64)}
            started = time.perf_counter()
            hidden = session.run(None, {key: value for key, value in feed.items() if key in names})[0]
            mask = feed["attention_mask"][..., None]
            vector = (hidden * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1)
            vector /= np.linalg.norm(vector, axis=1, keepdims=True).clip(min=1e-12)
            elapsed = (time.perf_counter()-started)*1000
            vectors.append(vector[0])
            logits = ((vector[0]-mean)/scale) @ weights + bias
            probabilities = np.exp(logits-logits.max())
            probabilities /= probabilities.sum()
            order = np.argsort(probabilities)[::-1]
            rows.append({"optimization": name, "text": text, "masked": masked, "headTop": head["labels"][order[0]], "score": float(probabilities[order[0]]), "margin": float(probabilities[order[0]]-probabilities[order[1]]), "embeddingMs": elapsed})
        vectors = np.array(vectors)
        if reference is None:
            reference = vectors
        for row, vector, baseline in zip(rows[-len(texts):], vectors, reference):
            row["maxVectorDifferenceFromNone"] = float(np.max(np.abs(vector-baseline)))
    args.output.write_text(json.dumps({"label": "Development backend diagnosis; not independent accuracy evaluation", "ort": ort.__version__, "rows": rows}, ensure_ascii=False, indent=2)+"\n")
    print(json.dumps(rows, ensure_ascii=False))


if __name__ == "__main__":
    main()
