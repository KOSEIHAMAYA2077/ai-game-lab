"""Export only artificial training/validation normalized inputs for browser."""
import hashlib
import json
from pathlib import Path
import sys

folder = Path(__file__).resolve().parent
sys.path.insert(0, str(folder.parent))
from config import relation_query

rows = {name: [json.loads(line) for line in (folder.parent / f"{name}.jsonl").read_text().splitlines()] for name in ["training", "validation"]}
inputs = list(dict.fromkeys(relation_query(row["text"]) for values in rows.values() for row in values))
data = {"inputs": inputs, "trainingRows": len(rows["training"]), "validationRows": len(rows["validation"]), "sourceHashes": {name: hashlib.sha256((folder.parent/f"{name}.jsonl").read_bytes()).hexdigest() for name in rows}}
(folder / "masked-inputs.json").write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n")
print(json.dumps({"maskedInputs": len(inputs), "sourceHashes": data["sourceHashes"]}))
