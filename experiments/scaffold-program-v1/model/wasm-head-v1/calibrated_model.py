"""Evaluate separate heads against fixed WASM single-query embedding records.

The production controller is reused unchanged. An independent evaluator creates
the texts list, invokes query collection + browser encoding, and scores results.
This module has no training step and does not send text to any external service.
"""
import argparse
import json
from pathlib import Path
import sys

import numpy as np

folder = Path(__file__).resolve().parent
sys.path.insert(0, str(folder.parent))
from predict import ProgramModel, clean_negation, extract_phrases, normalize, noun_spans, relation_scope
from config import ALIASES, BACKGROUND, CAPTIONS, DESCRIPTORS, relation_query


def collect_queries(texts):
    queries = [text for primitive, values in CAPTIONS.items() for text in list(values)+ALIASES[primitive]]
    queries.extend(text for values in DESCRIPTORS.values() for _, text in values)
    queries.extend(BACKGROUND)
    for text in texts:
        cleaned, _ = clean_negation(normalize(text))
        if not cleaned:
            continue
        queries.append(relation_query(relation_scope(cleaned)))
        for phrase in extract_phrases(cleaned)[0]:
            spans = noun_spans(phrase)
            if spans:
                span = max(spans, key=lambda value: value[0])
                queries.append(phrase[span[0]:span[1]])
            else:
                queries.append(phrase)
            attribute = phrase
            for start, end, _ in sorted(set(spans), reverse=True):
                attribute = attribute[:start]+" "+attribute[end:]
            if attribute.strip():
                queries.append(attribute)
    return list(dict.fromkeys(queries))


class LookupEncoder:
    def __init__(self, embeddings):
        self.rows = {row["text"]: np.array(row["vector"]) for row in embeddings["rows"]}

    def encode(self, texts):
        return np.array([self.rows[text] for text in texts])


class WasmProgramModel(ProgramModel):
    def __init__(self, embeddings, head_path):
        if embeddings["provider"] != "wasm" or embeddings["batchSize"] != 1:
            raise ValueError("Expected browser WASM single-query vectors")
        self.encoder = LookupEncoder(embeddings)
        self.head = json.loads(Path(head_path).read_text())
        self.mean, self.scale, self.weights, self.bias = [np.array(self.head[key]) for key in ["mean", "scale", "weights", "bias"]]
        self.primitive_ids = [primitive for primitive, captions in CAPTIONS.items() for _ in list(captions)+ALIASES[primitive]]
        captions = [text for primitive, values in CAPTIONS.items() for text in list(values)+ALIASES[primitive]]
        reference = {row["text"]: np.array(row["vector"]) for row in embeddings["staticRows"]}
        self.primitive_vectors = np.array([reference[text] for text in captions])
        self.descriptor_ids = [(key, value) for key, values in DESCRIPTORS.items() for value, _ in values]
        self.descriptor_vectors = np.array([reference[text] for values in DESCRIPTORS.values() for _, text in values])
        self.background = np.array([reference[text] for text in BACKGROUND])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--texts", type=Path, required=True, help="JSON list of artificial evaluation strings, prepared by evaluator")
    parser.add_argument("--queries", type=Path, help="Write inference inputs for browser encoding without learning")
    parser.add_argument("--embeddings", type=Path)
    parser.add_argument("--head", type=Path, default=folder/"relation-head.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    texts = json.loads(args.texts.read_text())
    if not isinstance(texts, list) or not all(isinstance(text,str) for text in texts):
        raise ValueError("Expected a JSON list of artificial strings")
    if args.queries:
        args.queries.write_text(json.dumps({"inputs":collect_queries(texts),"label":"Independent evaluator inference only; no head training"},ensure_ascii=False)+"\n")
        print(json.dumps({"rows":len(texts),"queries":len(collect_queries(texts))}))
    else:
        if not args.embeddings or not args.output:
            raise ValueError("Expected --embeddings and --output")
        model = WasmProgramModel(json.loads(args.embeddings.read_text()),args.head)
        args.output.write_text(json.dumps({"label":"WASM batch-1 embedding lookup interpretation; inference time is not live end-to-end time","head":args.head.name,"rows":[{"text":text,**model.interpret(text)} for text in texts]},ensure_ascii=False,indent=2)+"\n")
        print(json.dumps({"rows":len(texts),"head":args.head.name}))


if __name__ == "__main__":
    main()
