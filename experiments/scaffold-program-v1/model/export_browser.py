"""Export the frozen controller/head to the standalone browser Worker."""
import hashlib
import json
from pathlib import Path
from config import ALIASES, ANCHORS, BACKGROUND, BOUNDS, CAPTIONS, COLOR_PATTERNS, DEFAULTS, DESCRIPTORS, MIN_MARGIN, MIN_SCORE, NEGATIVE_OPERATION, PATTERNS, RELATION_MIN_MARGIN, RELATION_MIN_SCORE

folder = Path(__file__).resolve().parent
root = folder.parents[2]
manifest = json.loads((root / "experiments/skeleton-surface-v1/server/model-manifest.json").read_text())
head_bytes = (folder / "relation-head.json").read_bytes()
config = {"model": manifest["model"], "revision": manifest["revision"], "files": manifest["files"],
          "captions": CAPTIONS, "aliases": ALIASES, "background": BACKGROUND, "defaults": DEFAULTS, "bounds": BOUNDS,
          "anchors": ANCHORS, "descriptors": DESCRIPTORS, "patterns": PATTERNS, "negativeOperation": NEGATIVE_OPERATION,
          "colorPatterns": COLOR_PATTERNS,
          "minScore": MIN_SCORE, "minMargin": MIN_MARGIN, "relationMinScore": RELATION_MIN_SCORE, "relationMinMargin": RELATION_MIN_MARGIN,
          "head": json.loads(head_bytes), "headSha256": hashlib.sha256(head_bytes).hexdigest(), "maxText": 4000}
destination = root / "prototypes/glyph-creature/src/data/scaffold-language.json"
destination.write_text(json.dumps(config, ensure_ascii=False, separators=(",", ":")) + "\n")
print("Exported frozen browser config", hashlib.sha256(destination.read_bytes()).hexdigest(), "bytes", destination.stat().st_size)
