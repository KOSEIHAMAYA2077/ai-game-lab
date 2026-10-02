"""Keep browser configuration identical to the evaluated Python controller."""
import json
from pathlib import Path
from interpreter import ALIASES, ANCHORS, BACKGROUND, BOUNDS, CAPTIONS, DEFAULT, DESCRIPTORS, MAX_TEXT, MIN_MARGIN, MIN_SCORE, MODEL_ID, REVISION

manifest = json.loads(Path(__file__).with_name("model-manifest.json").read_text())
config = {
    "model": MODEL_ID, "revision": REVISION, "captions": CAPTIONS, "aliases": ALIASES,
    "descriptors": DESCRIPTORS, "anchors": ANCHORS, "background": BACKGROUND,
    "bounds": BOUNDS, "default": DEFAULT, "maxText": MAX_TEXT,
    "minScore": MIN_SCORE, "minMargin": MIN_MARGIN, "files": manifest["files"],
}
destination = Path(__file__).resolve().parents[3] / "prototypes/glyph-creature/src/data/skeleton-language.json"
destination.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
print("Exported browser controller configuration")
