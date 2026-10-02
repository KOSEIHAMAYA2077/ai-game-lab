"""Learn a separate deployment-calibrated head using WASM batch-1 embeddings.

Only the original artificial training and validation sentences are consumed.
This never reads any independent evaluation fixture or replaces the CPU head.
"""
import hashlib
import json
from pathlib import Path
import sys
import time

import numpy as np

folder = Path(__file__).resolve().parent
sys.path.insert(0, str(folder.parent))
from config import relation_query

LABELS = ["end", "above", "through", "none"]


def softmax(value):
    exponent = np.exp(value-value.max(axis=1, keepdims=True))
    return exponent/exponent.sum(axis=1, keepdims=True)


def main():
    started = time.perf_counter()
    values = json.loads((folder/"embeddings.json").read_text())
    if values["provider"] != "wasm" or values["batchSize"] != 1:
        raise ValueError("Expected deployment WASM batch-1 embeddings")
    indexed = {row["text"]: np.array(row["vector"]) for row in values["rows"]}
    training = [json.loads(line) for line in (folder.parent/"training.jsonl").read_text().splitlines()]
    validation = [json.loads(line) for line in (folder.parent/"validation.jsonl").read_text().splitlines()]
    train_texts = [relation_query(row["text"]) for row in training]
    validation_texts = [relation_query(row["text"]) for row in validation]
    if set(train_texts)&set(validation_texts):
        raise ValueError("Masked train/validation inputs overlap")
    train_vectors = np.array([indexed[text] for text in train_texts])
    validation_vectors = np.array([indexed[text] for text in validation_texts])
    mean = train_vectors.mean(axis=0)
    scale = np.maximum(train_vectors.std(axis=0), .015)
    x, v = (train_vectors-mean)/scale, (validation_vectors-mean)/scale
    y = np.array([LABELS.index(row["relation"]) for row in training])
    vy = np.array([LABELS.index(row["relation"]) for row in validation])
    target = np.eye(4)[y]
    weights, bias = np.zeros((384,4)), np.zeros(4)
    best = None
    curve = []
    # Hyperparameters and acceptance conditions are unchanged from the CPU head.
    for epoch in range(1200):
        probability = softmax(x@weights+bias)
        error = (probability-target)/len(x)
        weights -= .06*(x.T@error+.007*weights)
        bias -= .06*error.sum(axis=0)
        tp, vp = softmax(x@weights+bias), softmax(v@weights+bias)
        train_order, valid_order = np.sort(tp,axis=1), np.sort(vp,axis=1)
        tq = float(((tp.argmax(axis=1)==y)&(train_order[:,-1]>=.75)&(train_order[:,-1]-train_order[:,-2]>=.25)).mean())
        vq = float(((vp.argmax(axis=1)==vy)&(valid_order[:,-1]>=.62)&(valid_order[:,-1]-valid_order[:,-2]>=.15)).mean())
        quality = min(tq,vq)
        if best is None or quality>best[0]:
            best = quality,epoch+1,weights.copy(),bias.copy()
        if epoch in [0,99,299,599,1199]:
            curve.append({"epoch":epoch+1,"trainingAccuracy":float((tp.argmax(axis=1)==y).mean()),"validationAccuracy":float((vp.argmax(axis=1)==vy).mean()),"trainingAcceptedCorrect":tq,"validationAcceptedCorrect":vq})
    quality, selected, weights, bias = best
    artifact = {"version":1,"encoder":values["model"],"revision":values["revision"],"labels":LABELS,"mean":mean.tolist(),"scale":scale.tolist(),"weights":weights.tolist(),"bias":bias.tolist(),"trainingRows":len(training),"validationRows":len(validation),"trainingSha256":hashlib.sha256((folder.parent/"training.jsonl").read_bytes()).hexdigest(),"validationSha256":hashlib.sha256((folder.parent/"validation.jsonl").read_bytes()).hexdigest(),"learningRate":.06,"regularization":.007,"epochs":selected,"inputMask":"known noun/attribute masking; relation words retained","selectedUsing":"training and validation only; independent evaluation unread","embeddingProvider":"wasm","embeddingBatchSize":1,"embeddingSha256":hashlib.sha256((folder/"embeddings.json").read_bytes()).hexdigest()}
    body = json.dumps(artifact,ensure_ascii=False,separators=(",",":"))+"\n"
    (folder/"relation-head.json").write_text(body)
    vp = softmax(v@weights+bias)
    report = {"label":"Training/validation only; separate WASM batch-1 head, CPU head preserved","headSha256":hashlib.sha256(body.encode()).hexdigest(),"headTrainingMs":(time.perf_counter()-started)*1000,"encoderPreparationMs":values["preparationMs"],"embeddingMs":values["embeddingMs"],"selectedEpoch":selected,"selectedAcceptedCorrectQuality":quality,"trainingRows":len(training),"validationRows":len(validation),"trainingMaskedUnique":len(set(train_texts)),"validationMaskedUnique":len(set(validation_texts)),"maskedOverlap":0,"independentEvaluationRead":False,"learningCurve":curve,"validation":[{**row,"predicted":LABELS[int(p.argmax())],"confidence":float(p.max())} for row,p in zip(validation,vp)]}
    (folder/"training-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({key:value for key,value in report.items() if key not in ["validation","learningCurve"]},ensure_ascii=False))


if __name__ == "__main__":
    main()
