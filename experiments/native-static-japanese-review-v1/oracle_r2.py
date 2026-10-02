"""Independent deployment oracle: old tokenizers + trusted read-only F16 table.

Only artificial inputs. No downloads, model training, app integration or candidate call.
"""
import hashlib
import json
import math
import os
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
import numpy as np
import tokenizers
from tokenizers import Tokenizer

ROOT = Path(".")
OWN = ROOT / "experiments/native-static-japanese-review-v1"
LOCAL = ROOT / ".local/static-japanese-v1"
TOKENIZER = LOCAL / "source/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3/0_StaticEmbedding/tokenizer.json"
TABLE = LOCAL / "tables/table-128-float16.bin"
CAPTIONS = ROOT / "experiments/static-japanese-retrieval-v1/captions.json"


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1048576), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_new(path, value):
    with path.open("x") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")


class Oracle:
    def __init__(self):
        assert tokenizers.__version__ == "0.22.1"
        assert np.__version__ == "2.0.2"
        assert TABLE.stat().st_size == 8388608
        assert sha(TABLE) == "65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201"
        assert sha(TOKENIZER) == "833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9"
        self.table = np.memmap(TABLE, mode="r", dtype="<f2", shape=(32768, 128))
        self.tokenizer = Tokenizer.from_file(str(TOKENIZER))
        self.tokenizer.no_padding()
        self.tokenizer.no_truncation()
        self.inventory = json.loads(CAPTIONS.read_text())["entries"]
        self.indices = {}
        for registry in ["shape", "primitive"]:
            rows = []
            global_index = 0
            for entry in self.inventory:
                for caption in entry["captions"]:
                    if entry["registry"] == registry:
                        encoded = self.encode(caption)
                        assert encoded["hold"] is None
                        rows.append({"label": entry["label"], "vector": np.array(encoded["vector"], dtype=np.float32), "captionIndex": global_index})
                    global_index += 1
            self.indices[registry] = rows

    def encode(self, text):
        encoded = self.tokenizer.encode(text, add_special_tokens=False)
        ids = encoded.ids
        normalized = self.tokenizer.normalizer.normalize_str(text)
        pretokenized = self.tokenizer.pre_tokenizer.pre_tokenize_str(normalized)
        unknown = ids.count(3) / len(ids) if ids else 0.0
        mean = np.zeros(128, dtype=np.float32)
        if ids:
            assert min(ids) >= 0 and max(ids) < 32768
            for start in range(0, len(ids), 64):
                mean += self.table[ids[start:start + 64]].astype(np.float32).sum(axis=0, dtype=np.float32)
            mean /= len(ids)
        hold = None
        vector = None
        if len(text) > 4000:
            hold = "input_limit"
        elif len(ids) > 4000:
            hold = "token_limit"
        elif unknown > 0.8:
            hold = "unknown_tokens"
        else:
            norm = float(np.linalg.norm(mean))
            if norm > 1e-12:
                vector = (mean / norm).tolist()
            else:
                hold = "empty_vector"
        return {"ids": ids, "pieces": encoded.tokens, "normalization": normalized,
                "pretokenizedWholeNormalization": [piece for piece, offsets in pretokenized],
                "unknownFraction": unknown, "mean": mean.tolist(), "vector": vector, "hold": hold}

    def result(self, text, registry):
        encoded = self.encode(text)
        ranks = []
        caption_scores = []
        if encoded["vector"] is not None:
            vector = np.array(encoded["vector"], dtype=np.float32)
            best = {}
            for row in self.indices[registry]:
                score = float(np.dot(row["vector"], vector))
                caption_scores.append({"label": row["label"], "captionIndex": row["captionIndex"], "score": score})
                previous = best.get(row["label"])
                if previous is None or score > previous["score"]:
                    best[row["label"]] = {"label": row["label"], "score": score, "captionIndex": row["captionIndex"]}
            ranks = sorted(best.values(), key=lambda row: (-row["score"], row["label"]))
        return {"encoding": encoded, "ranks": ranks, "captionScores": caption_scores}


def main():
    oracle = Oracle()
    groups = {}
    for group, filename in [("manual20", "CASES-R1.json"), ("artifactInformedSpecials4", "CASES-SPECIALS-R1.json")]:
        data = json.loads((OWN / filename).read_text())
        groups[group] = [{"id": row["id"], "registry": row["registry"], "result": oracle.result(row["text"], row["registry"])} for row in data["cases"]]
    output = {"version": "independent-old-tokenizers-f16-oracle-r2", "candidateCalls": 0,
              "tokenizers": tokenizers.__version__, "numpy": np.__version__, "groups": groups,
              "referencePolicy": {"unknownFractionHoldAbove": 0.8, "normHoldAtOrBelow": 1e-12, "inputCharactersMax": 4000, "tokenCountMax": 4000, "BOS_EOS": False},
              "sourceSHA": {str(path): sha(path) for path in [TOKENIZER, TABLE, CAPTIONS, ROOT / "experiments/static-japanese-retrieval-v1/retrieval_v2.py", ROOT / "experiments/static-japanese-retrieval-v1/mmap_benchmark.py", OWN / "oracle_r2.py"]},
              "mappedFileBytes": 8388608, "mappedBytesAreNotResidentRAM": True,
              "indexCaptionCounts": {key: len(rows) for key, rows in oracle.indices.items()}}
    write_new(OWN / "ORACLE-R2.json", output)
    print(json.dumps({"manual20": 20, "specials4": 4, "candidateCalls": 0, "oracleSHA": sha(OWN / "ORACLE-R2.json")}))


if __name__ == "__main__":
    main()
