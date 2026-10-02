"""Independent synthetic cases; freeze before trained head completion.
Do not use this file or fixture.json as training/tuning data.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path


def part(primitive, **attributes):
    return {"primitive": primitive, **({"attributes": attributes} if attributes else {})}


def case(identifier, group, text, parts=None, relation=None):
    return {"id": identifier, "group": group, "text": text, "expected": None if parts is None else {"parts": parts, "relation": relation}}


CASES = [
    case("single-sphere", "single", "滑らかな球体が一つほしい。", [part("sphere")]),
    case("single-box", "single", "箱型の立体を一つだけ見せて。", [part("box")]),
    case("single-tube", "single", "円筒の管を単体で浮かべたい。", [part("tube")]),
    case("single-blade", "single", "A single blade with no extra components.", [part("blade")]),
    case("single-ring", "single", "穴の開いた円環だけにする。", [part("ring")]),
    case("single-vase", "single", "Display one vessel for arranging cut flowers.", [part("vase")]),
    case("end-tube-sphere-ja", "end", "管の先端に球体をつなげた構造。", [part("tube"), part("sphere")], "end"),
    case("end-blade-sphere-ja", "end", "刃の末端には丸い球を取り付ける。", [part("blade"), part("sphere")], "end"),
    case("end-tube-box-en", "end", "Add a box to the end of a tube.", [part("tube"), part("box")], "end"),
    case("end-tube-ring-en", "end", "A ring is joined at the tip of a tube.", [part("tube"), part("ring")], "end"),
    case("above-box-sphere-ja", "above", "箱の上方に球体を置く。", [part("box"), part("sphere")], "above"),
    case("above-vase-ring-en", "above", "Put a ring above a vase.", [part("vase"), part("ring")], "above"),
    case("above-box-sphere-en", "above", "Place a sphere on top of a box.", [part("box"), part("sphere")], "above"),
    case("above-sphere-tube-ja", "above", "球の上に管を置き、下には何も付けない。", [part("sphere"), part("tube")], "above"),
    case("through-box-tube-ja", "through", "箱を貫く管を組み合わせて。", [part("box"), part("tube")], "through"),
    case("through-sphere-blade-ja", "through", "球体の内部を刃が通り抜ける形。", [part("sphere"), part("blade")], "through"),
    case("through-box-tube-en", "through", "A tube passes through a box.", [part("box"), part("tube")], "through"),
    case("through-box-ring-en", "through", "Pass a ring through the box-shaped body.", [part("box"), part("ring")], "through"),
    case("scope-thick-body-thin-neck", "scoped-attribute", "太い球体の上に細い管をつける。胴はふっくら、首は細く。", [part("sphere", width={"min": 1.2}), part("tube", width={"max": .8})], "above"),
    case("scope-thin-body-thick-neck", "scoped-attribute", "細い球体の上に太い管を置く。", [part("sphere", width={"max": .8}), part("tube", width={"min": 1.2})], "above"),
    case("scope-thin-blade-wide-box", "scoped-attribute", "A thin blade passes through a wide box.", [part("box", width={"min": 1.2}), part("blade", width={"max": .8})], "through"),
    case("scope-long-tube-small-sphere", "scoped-attribute", "長い管の先端に、小さい球を接続する。", [part("tube", height={"min": 1.2}), part("sphere", height={"max": .8}, width={"max": .8}, depth={"max": .8})], "end"),
    case("negation-single-box", "negation", "球体じゃなく箱に変える。", [part("box")]),
    case("negation-single-sphere", "negation", "管は要らない。球だけ作る。", [part("sphere")]),
    case("negation-single-blade-en", "negation", "Not a ring: a blade instead.", [part("blade")]),
    case("negation-end-tube-box", "negation", "球ではなく箱を、管の先端へつなぐ。", [part("tube"), part("box")], "end"),
    case("ordinary-ja", "ordinary", "首をかしげて考えたが、まだ答えは出ない。"),
    case("ordinary-en", "ordinary", "I will return tomorrow and finish the story."),
    case("unsupported-violin", "unsupported", "四本の弦を持つヴァイオリンを浮かべて。"),
    case("unsupported-three-parts", "unsupported", "管の先に球を付け、その球の上に箱を載せる。"),
]


if __name__ == "__main__":
    directory = Path(__file__).parent
    target = directory / "fixture.json"
    if target.exists():
        raise SystemExit("Already frozen; do not overwrite.")
    data = {"version": 1, "createdAt": datetime.now(timezone.utc).isoformat(),
            "purpose": "Independent artificial evaluation fixed before relation head training completion.",
            "contract": {"partOrder": "semantic parent first, child second; NOT textual noun order", "maximumParts": 2,
                         "relations": {"end": "child attaches to parent +Y tip", "above": "child above parent", "through": "child passes through parent"},
                         "attributeScore": "direction/range, not exact floating-point equality", "unsupportedAction": "retain previous program and add text"},
            "cases": CASES}
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    target.write_text(content, encoding="utf-8")
    digest = hashlib.sha256(content.encode()).hexdigest()
    (directory / "fixture.sha256").write_text(f"{digest}  fixture.json\n", encoding="utf-8")
    print(f"Frozen {len(CASES)} cases SHA-256 {digest}")
