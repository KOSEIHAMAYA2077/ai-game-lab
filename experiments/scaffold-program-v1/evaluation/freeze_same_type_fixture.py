"""Additional independent cases for same-primitive parts; never tune on them."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from freeze_fixture import case, part

CASES = [
    case("same-spheres-above-ja", "same-type", "大きな球体の上に、小さな球体を置く。", [part("sphere", width={"min": 1.2}), part("sphere", width={"max": .8})], "above"),
    case("same-spheres-above-en", "same-type", "Place a large sphere above a small sphere.", [part("sphere", width={"max": .8}), part("sphere", width={"min": 1.2})], "above"),
    case("same-tubes-end-ja", "same-type", "細い管の先端に、太い管を接続する。", [part("tube", width={"max": .8}), part("tube", width={"min": 1.2})], "end"),
    case("same-tubes-end-en", "same-type", "Attach a short tube to the end of a long tube.", [part("tube", height={"min": 1.2}), part("tube", height={"max": .8})], "end"),
    case("same-boxes-above-ja", "same-type", "幅広い箱の上に、幅の狭い箱を載せる。", [part("box", width={"min": 1.2}), part("box", width={"max": .8})], "above"),
    case("same-boxes-above-en", "same-type", "A wide box sits above a narrow box.", [part("box", width={"max": .8}), part("box", width={"min": 1.2})], "above"),
]

if __name__ == "__main__":
    directory = Path(__file__).parent
    target = directory / "same-type-fixture.json"
    if target.exists():
        raise SystemExit("Already frozen; do not overwrite.")
    content = json.dumps({"version": 1, "createdAt": datetime.now(timezone.utc).isoformat(),
                          "purpose": "Additional independent evaluation for two instances of the same primitive, frozen before head completion.",
                          "cases": CASES}, ensure_ascii=False, indent=2) + "\n"
    target.write_text(content, encoding="utf-8")
    digest = hashlib.sha256(content.encode()).hexdigest()
    (directory / "same-type-fixture.sha256").write_text(f"{digest}  same-type-fixture.json\n", encoding="utf-8")
    print(f"Frozen {len(CASES)} same-type cases SHA-256 {digest}")
