"""Train a tiny relation classifier on frozen artificial sentence embeddings.

No independent evaluation data is read. Encoder weights stay fixed; only this
4-class linear softmax head is learned, with CPU NumPy and deterministic seed.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import platform
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "experiments/skeleton-surface-v1/server"))
from interpreter import Embeddings, MODEL_ID, REVISION
import numpy as np
from config import relation_query

LABELS = ["end", "above", "through", "none"]


def softmax(logits):
    shifted = logits - logits.max(axis=1, keepdims=True)
    exponents = np.exp(shifted)
    return exponents / exponents.sum(axis=1, keepdims=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    folder = Path(__file__).resolve().parent
    train = [json.loads(line) for line in (folder / "training.jsonl").read_text().splitlines()]
    validation = [json.loads(line) for line in (folder / "validation.jsonl").read_text().splitlines()]
    if set(item["text"] for item in train) & set(item["text"] for item in validation):
        raise RuntimeError("Training and validation text overlap")
    encoder = Embeddings(args.model_dir)
    embedding_started = time.perf_counter()
    items = train + validation
    vectors = np.concatenate([encoder.encode([relation_query(item["text"]) for item in items[i:i+8]]) for i in range(0, len(items), 8)])
    embedding_ms = (time.perf_counter()-embedding_started)*1000
    head_started = time.perf_counter()
    mean = vectors[:len(train)].mean(axis=0)
    scale = np.maximum(vectors[:len(train)].std(axis=0), .015)
    features = (vectors - mean) / scale
    x, v = features[:len(train)], features[len(train):]
    y = np.array([LABELS.index(item["relation"]) for item in train])
    vy = np.array([LABELS.index(item["relation"]) for item in validation])
    weights = np.zeros((x.shape[1], len(LABELS)), dtype=np.float64)
    bias = np.zeros(len(LABELS), dtype=np.float64)
    targets = np.eye(len(LABELS))[y]
    regularization = .007
    learning_rate = .06
    curve = []
    best = None
    for epoch in range(1200):
        probabilities = softmax(x @ weights + bias)
        error = (probabilities - targets) / len(x)
        weights -= learning_rate * (x.T @ error + regularization * weights)
        bias -= learning_rate * error.sum(axis=0)
        vp = softmax(v @ weights + bias)
        order = np.sort(vp, axis=1)
        accepted_correct = (vp.argmax(axis=1) == vy) & (order[:,-1] >= .62) & (order[:,-1]-order[:,-2] >= .15)
        tp = softmax(x @ weights + bias)
        train_order = np.sort(tp, axis=1)
        train_accepted_correct = (tp.argmax(axis=1) == y) & (train_order[:,-1] >= .75) & (train_order[:,-1]-train_order[:,-2] >= .25)
        validation_quality = min(float(accepted_correct.mean()), float(train_accepted_correct.mean()))
        if best is None or validation_quality > best[0]:
            best = (validation_quality, epoch+1, weights.copy(), bias.copy())
        if epoch in [0, 99, 299, 599, 1199]:
            curve.append({"epoch": epoch+1, "loss": float(-np.log(probabilities[np.arange(len(y)), y].clip(1e-12)).mean()),
                          "trainingAccuracy": float((probabilities.argmax(axis=1) == y).mean()),
                          "validationAccuracy": float((softmax(v @ weights + bias).argmax(axis=1) == vy).mean())})
    _, selected_epoch, weights, bias = best
    validation_probabilities = softmax(v @ weights + bias)
    details = []
    for item, probabilities, target in zip(validation, validation_probabilities, vy):
        prediction = int(probabilities.argmax())
        details.append({**item, "predicted": LABELS[prediction], "confidence": round(float(probabilities[prediction]), 6), "correct": prediction == int(target)})
    artifact = {"version": 1, "encoder": MODEL_ID, "revision": REVISION, "labels": LABELS,
                "mean": mean.tolist(), "scale": scale.tolist(), "weights": weights.tolist(), "bias": bias.tolist(),
                "trainingRows": len(train), "validationRows": len(validation),
                "trainingSha256": hashlib.sha256((folder / "training.jsonl").read_bytes()).hexdigest(),
                "validationSha256": hashlib.sha256((folder / "validation.jsonl").read_bytes()).hexdigest(),
                "learningRate": learning_rate, "regularization": regularization, "epochs": selected_epoch,
                "inputMask": "known noun/attribute masking; relation words retained", "selectedUsing": "training and validation only; independent evaluation unread"}
    text = json.dumps(artifact, ensure_ascii=False, separators=(",", ":")) + "\n"
    (folder / "relation-head.json").write_text(text)
    report = {"environment": platform.machine(), "provider": "CPUExecutionProvider", "headSha256": hashlib.sha256(text.encode()).hexdigest(),
              "embeddingMs": round(embedding_ms, 2), "headTrainingMs": round((time.perf_counter()-head_started)*1000, 2), "totalMs": round((time.perf_counter()-started)*1000, 2),
              "learningCurve": curve, "validation": details, "independentEvaluationRead": False}
    (folder / "training-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key:value for key,value in report.items() if key != "validation"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
