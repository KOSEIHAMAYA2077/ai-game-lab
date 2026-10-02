#!/usr/bin/env python3
"""Build a manually authored, independent artificial evaluation set.

This is an artifact generator, not a source of model training data.
Run before seeing weights or current student training/source data.
"""
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PRIMITIVES = ["sphere", "box", "tube", "blade", "ring", "vase"]


def part(primitive, constraints=None):
    result = {"primitive": primitive}
    if constraints:
        result["constraints"] = constraints
    return result


def program(*parts, relation=None):
    result = {"parts": list(parts)}
    if relation:
        result["relation"] = relation
    return result


def cmp(left, operation, right, ratio=1):
    return {"left": left, "operation": operation, "right": right, "ratio": ratio}


def bound(field, operation, value):
    return {"left": field, "operation": operation, "value": value}


cases = []


def add(identifier, category, language, text, expected, note):
    cases.append({"id": identifier, "category": category, "language": language,
                  "text": text, "expected": expected, "meaning_note": note})


def single(identifier, language, text, primitive, constraints=None, note="Explicit physical noun within the six-primitive vocabulary."):
    category = "single_attribute" if constraints else "single_nominal"
    add(identifier, category, language, text,
        {"action": "render", "alternatives": [program(part(primitive, constraints))]}, note)


single("s01", "ja", "真珠みたいな玉", "sphere")
single("s02", "ja", "球状の物体", "sphere")
single("s03", "en", "a perfectly round orb", "sphere")
single("s04", "ja", "横に押しつぶされた球体", "sphere", [cmp("height", "lt", "width", .9)], "Flattened along the vertical axis; height must be smaller than width.")
single("s05", "ja", "縦に伸びた玉", "sphere", [cmp("height", "gt", "width", 1.1)], "Vertically elongated sphere.")
single("s06", "ja", "四角い箱", "box")
single("s07", "en", "rectangular block", "box")
single("s08", "ja", "さいころのような角張った塊", "box")
single("s09", "ja", "横に長い箱", "box", [cmp("width", "gt", "height", 1.1)], "Horizontally elongated box.")
single("s10", "ja", "ねじれた直方体", "box", [bound("abs_twist", "gte", .2)], "A nonzero physical section twist, not merely a changed surface coordinate.")
single("s11", "ja", "筒", "tube")
single("s12", "en", "a straight rod", "tube")
single("s13", "ja", "細長い円柱", "tube", [cmp("height", "gt", "width", 1.1)], "Vertical axial dimension exceeds the width parameter.")
single("s14", "ja", "曲がった管", "tube", [bound("abs_bend", "gte", .2)], "Bend must affect the scaffold, not only the glyph motion.")
single("s15", "ja", "ねじれた太い棒", "tube", [bound("abs_twist", "gte", .2), bound("width", "gte", 1.1)], "Twist plus a width larger than the neutral unit; both attributes apply to the same rod.")
single("s16", "ja", "剣", "blade")
single("s17", "en", "a dagger", "blade")
single("s18", "ja", "尖った刃", "blade")
single("s19", "ja", "短く幅広い刀身", "blade", [bound("height", "lte", .9), bound("width", "gte", 1.1)], "Short and wide relative to the unit parameters; two simultaneous attributes.")
single("s20", "ja", "湾曲した剣", "blade", [bound("abs_bend", "gte", .2)], "Curved blade.")
single("s21", "ja", "花瓶", "vase")
single("s22", "en", "a ceramic vase", "vase")
single("s23", "ja", "細長い口の開いた壺", "vase", [cmp("height", "gt", "width", 1.1)], "Vase primitive supplies an open rim and hollow interior; no neck parameter exists in this Program schema. The axial dimension must exceed the width.")
single("s24", "ja", "背の高い花器", "vase", [cmp("height", "gt", "width", 1.1)], "Tall vase.")
single("s25", "ja", "横に広いずんぐりした花瓶", "vase", [cmp("width", "gt", "height", 1.1)], "Squat, wide vase; width and height have a relative condition.")
single("s26", "ja", "輪っか", "ring")
single("s27", "en", "a closed loop", "ring")
single("s28", "ja", "太い穴のある環", "ring", [bound("depth", "gte", 1.1)], "Depth controls this loop's tube thickness. Closed ring retains a hole; this is not the filled sphere primitive.")
single("s29", "ja", "縦長の輪", "ring", [cmp("height", "gt", "width", 1.1)], "Vertically elongated closed loop.")
single("s30", "ja", "ねじれた輪", "ring", [bound("abs_twist", "gte", .2)], "Twist parameter must be nonzero; its visual observability is reported separately.")


def pair(identifier, category, language, text, parent, child, relation, note):
    add(identifier, category, language, text,
        {"action": "render", "alternatives": [program(part(parent), part(child), relation=relation)]}, note)


pair("r01", "relation_simple", "ja", "棒の先端に球を付ける", "tube", "sphere", "end", "The rod is the parent and the ball is the attached child.")
pair("r02", "relation_simple", "ja", "球の先端に棒を付ける", "sphere", "tube", "end", "Direction reversal of r01; a bag of nouns cannot distinguish these cases.")
pair("r03", "relation_simple", "ja", "花瓶の端に輪をつなぐ", "vase", "ring", "end", "The ring is attached to the end of the vase.")
pair("r04", "relation_simple", "ja", "輪の端に花瓶をつなぐ", "ring", "vase", "end", "Direction reversal of r03; geometry is restricted to the Program compiler.")
pair("r05", "relation_simple", "en", "Put a blade on the tip of a box.", "box", "blade", "end", "The box is the parent despite appearing later in the sentence.")
pair("r06", "relation_simple", "en", "Put a box on the tip of a blade.", "blade", "box", "end", "Direction reversal of r05.")
pair("r07", "relation_scope", "ja", "箱の先端へ取り付けるのは球", "box", "sphere", "end", "A topicalized child phrase follows the relation phrase.")
pair("r08", "relation_scope", "ja", "球の先端へ取り付けるのは箱", "sphere", "box", "end", "Direction reversal of r07.")
pair("r09", "relation_scope", "en", "The rod is the base; attach a ring at its end.", "tube", "ring", "end", "The possessive pronoun refers to the first part across a clause boundary.")
pair("r10", "relation_scope", "en", "The ring is the base; attach a rod at its end.", "ring", "tube", "end", "Direction reversal of r09.")
pair("r11", "relation_simple", "ja", "箱の上に球を置く", "box", "sphere", "above", "Parent is lower, child is above.")
pair("r12", "relation_simple", "ja", "球の上に箱を置く", "sphere", "box", "above", "Direction reversal of r11.")
pair("r13", "relation_simple", "en", "A vase sits above a rod.", "tube", "vase", "above", "Child is mentioned first.")
pair("r14", "relation_simple", "en", "A rod sits above a vase.", "vase", "tube", "above", "Direction reversal of r13.")
pair("r15", "relation_scope", "ja", "刃を花瓶より上に置く", "vase", "blade", "above", "The comparison target is the lower parent.")
pair("r16", "relation_scope", "ja", "花瓶を刃より上に置く", "blade", "vase", "above", "Direction reversal of r15.")
pair("r17", "relation_scope", "ja", "球を置く。輪よりも上側に", "ring", "sphere", "above", "One intended relation spans punctuation; the first part is the child.")
pair("r18", "relation_scope", "ja", "輪を置く。球よりも上側に", "sphere", "ring", "above", "Direction reversal of r17.")
pair("r19", "relation_scope", "en", "Below the sphere sits a box.", "box", "sphere", "above", "A below phrase must be inverted into the supported above relation.")
pair("r20", "relation_scope", "en", "Below the box sits a sphere.", "sphere", "box", "above", "Direction reversal of r19.")
pair("r21", "relation_simple", "ja", "箱を棒が貫く", "box", "tube", "through", "Parent is the pierced box; child is the rod crossing its material.")
pair("r22", "relation_simple", "ja", "棒を箱が貫く", "tube", "box", "through", "Direction reversal of r21; semantic roles, not surface word order, govern orientation.")
pair("r23", "relation_simple", "en", "A blade passes through a sphere.", "sphere", "blade", "through", "The blade is the passing child.")
pair("r24", "relation_simple", "en", "A sphere passes through a blade.", "blade", "sphere", "through", "Direction reversal of r23.")
pair("r25", "relation_simple", "ja", "花瓶の壁を棒が貫通する", "vase", "tube", "through", "Crossing the material wall, rather than only traversing the empty cavity, is required.")
pair("r26", "relation_scope", "ja", "棒を花瓶が貫通する", "tube", "vase", "through", "Reversed material role from r25; finite compiler may adjust dimensions.")
pair("r27", "relation_scope", "ja", "輪を貫くのは棒", "ring", "tube", "through", "Topicalized crossing part follows the verb.")
pair("r28", "relation_scope", "ja", "棒を貫くのは輪", "tube", "ring", "through", "Direction reversal of r27.")
pair("r29", "relation_scope", "en", "The box is pierced by a ring.", "box", "ring", "through", "Passive voice: the by phrase names the crossing child.")
pair("r30", "relation_scope", "en", "The ring is pierced by a box.", "ring", "box", "through", "Direction reversal of r29.")


ordinary = [
    ("ja", "今日もよく頑張った", "Ordinary diary text without a supported geometric referent."),
    ("ja", "赤く光って，ゆっくり流れる", "Color and motion alone do not identify a new scaffold."),
    ("ja", "触れていない世界への手紙", "Abstract metaphor without an agreed primitive."),
    ("ja", "立方根を計算した", "A mathematical root is not a box-shaped object."),
    ("ja", "リングバッファは満杯だ", "A software data structure is not a physical ring in this conservative benchmark."),
    ("ja", "星はどうして光るの", "A star is outside this six-primitive Program grammar."),
    ("ja", "夕食にカレーを作る", "Food is outside the grammar; no unbounded imagined mesh should be emitted."),
    ("ja", "幾何学について考えている", "Generic topic discussion without a requested shape."),
    ("en", "The meeting starts at noon.", "Ordinary scheduling text."),
    ("en", "Turn the volume down.", "An instruction concerning sound, not geometry."),
    ("en", "The database table is locked.", "Software context; a physical table is not a supported primitive either."),
    ("en", "I am thinking about tomorrow.", "Ordinary abstract text."),
    ("ja", "8個", "A count without a shape cannot form a Program."),
    ("ja", "青", "Color-only input retains the existing scaffold."),
    ("ja", "地図の凡例", "No supported physical primitive in this phrase."),
]
for index, (language, text, note) in enumerate(ordinary, 1):
    add(f"h{index:02}", "hold_ordinary", language, text, {"action": "hold"}, note)

abstain = [
    ("ja", "球は作らない", "Explicit negation of the only supported noun."),
    ("en", "No sphere, no ring.", "Both mentioned primitives are explicitly negated."),
    ("ja", "箱でも筒でもない形", "No positive primitive remains after both nouns are excluded."),
    ("ja", "花瓶を取り消す", "Cancellation, not a new shape instruction."),
    ("en", "Do not add a blade.", "Negated addition of a blade."),
    ("ja", "箱を出すな。", "Prohibition expressed after the shape noun."),
    ("ja", "管のない形", "Absence of a tube does not specify another primitive."),
    ("ja", "ねじれない", "Negated attribute and no shape noun; retain the prior scaffold."),
]
for index, (language, text, note) in enumerate(abstain, 16):
    add(f"h{index:02}", "hold_negation_ambiguity", language, text, {"action": "hold"}, note)

add("h24", "hold_negation_ambiguity", "ja", "球か箱のどちらか",
    {"action": "any", "allow_hold": True, "alternatives": [program(part("sphere")), program(part("box"))]},
    "The author leaves the choice open; either named one-part scaffold or an explicit hold is acceptable. Report separately from definite accuracy.")
add("h25", "hold_negation_ambiguity", "en", "A ring or a vase, either is fine.",
    {"action": "any", "allow_hold": True, "alternatives": [program(part("ring")), program(part("vase"))]},
    "Open alternative; no requirement to invent a relation or combine the nouns.")
add("h26", "hold_negation_ambiguity", "ja", "球と箱",
    {"action": "hold"}, "Two nouns without a relation are underspecified; this Program requires a relation for two parts.")
add("h27", "hold_negation_ambiguity", "ja", "棒の先に球を付けるか，棒を球に通すか",
    {"action": "any", "allow_hold": True, "alternatives": [program(part("tube"), part("sphere"), relation="end"), program(part("sphere"), part("tube"), relation="through")]},
    "Two complete alternatives with different orientations. Accept one explicit alternative or hold; never collapse roles into a new third reading.")
add("h28", "hold_negation_ambiguity", "ja", "箱の上か下に球",
    {"action": "any", "allow_hold": True, "alternatives": [program(part("box"), part("sphere"), relation="above"), program(part("sphere"), part("box"), relation="above")]},
    "Above or below is intentionally open; the below choice is the inverse supported above relation.")
add("h29", "hold_negation_ambiguity", "ja", "長くて短い棒",
    {"action": "hold"}, "Directly contradictory axial-size requests; conservative policy abstains.")
add("h30", "hold_negation_ambiguity", "en", "A box that is both wider and narrower than itself.",
    {"action": "hold"}, "An impossible self-relative width constraint; abstain rather than silently discarding the conflict.")

assert len(cases) == 90
assert len({case["id"] for case in cases}) == 90
assert len({case["text"] for case in cases}) == 90
assert Counter(case["category"] for case in cases) == {
    "single_nominal": 15, "single_attribute": 15, "relation_simple": 15,
    "relation_scope": 15, "hold_ordinary": 15, "hold_negation_ambiguity": 15,
}
single_counts = Counter(case["expected"]["alternatives"][0]["parts"][0]["primitive"] for case in cases[:30])
assert single_counts == dict.fromkeys(PRIMITIVES, 5)
relation_counts = Counter(case["expected"]["alternatives"][0]["relation"] for case in cases[30:60])
assert relation_counts == {"end": 10, "above": 10, "through": 10}

fixture = {
    "version": 1,
    "name": "widget-student-independent-90-v1",
    "created_utc": "2026-10-02T15:56:39Z",
    "origin": "Manually authored artificial inputs by an independent evaluation agent before seeing student source, training data, weights or thresholds.",
    "scope": {"primitives": PRIMITIVES, "maximum_parts": 2, "relations": ["end", "above", "through"],
              "dimension_range": [.4, 1.8], "bend_twist_range": [-1, 1],
              "definite_render_cases": 60, "definite_hold_cases": 26, "ambiguous_cases": 4},
    "categories": dict(Counter(case["category"] for case in cases)),
    "languages": dict(Counter(case["language"] for case in cases)),
    "cases": cases,
}
data = (json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
path = ROOT / "fixture-90-v1.json"
if path.exists():
    if path.read_bytes() != data:
        raise SystemExit("Refusing to replace an already frozen fixture.")
else:
    path.write_bytes(data)
digest = sha256(data).hexdigest()
(ROOT / "SHA256SUMS").write_text(f"{digest}  fixture-90-v1.json\n", encoding="ascii")
print(json.dumps({"fixture": str(path), "sha256": digest, "cases": len(cases),
                  "categories": fixture["categories"], "languages": fixture["languages"],
                  "actions": dict(Counter(case["expected"]["action"] for case in cases))}, ensure_ascii=False))
