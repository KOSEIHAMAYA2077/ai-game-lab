"""Artificial training/validation only; independent evaluation is another file."""
import hashlib
import json
from pathlib import Path

NOUNS = ["丸い玉", "四角い箱", "円柱の棒", "長い刃", "円環", "花入れ"]
ENGLISH_NOUNS = ["a sphere", "a cube", "a rod", "a blade", "a ring", "a vase"]
TRAIN_TEMPLATES = {
    "end": ["{p}の先に{c}", "{p}の端へ{c}をつなげる", "{p}の先端に{c}を取り付ける", "{c}を{p}の先に取り付ける", "{p}の端に{c}を置く", "attach {c} at the tip of {p}", "put {c} at the end of {p}", "{p} with {c} connected at one tip"],
    "above": ["{p}の上に{c}", "{p}のてっぺんに{c}を置く", "{p}の頂点に{c}を乗せる", "{c}を{p}の上に載せる", "{p}の上に{c}を取り付ける", "{c} above {p}", "place {c} on top of {p}", "{p} with {c} connected on top"],
    "through": ["{p}を{c}が貫く", "{p}の中心を{c}が通る", "{p}に{c}を通す", "{c}が{p}を突き抜ける", "{c} through {p}", "{p} pierced by {c}"],
    "none": ["{p}と{c}", "{p}と{c}について考える", "{p}か{c}を見たい", "{p}の横に{c}", "{p}のそばに{c}", "{p} and {c}", "I am considering {p} or {c}", "{p} next to {c}"],
}
VALID_TEMPLATES = {
    "end": ["{p}の片端に{c}を置く", "{p} with {c} attached to one end"],
    "above": ["{p}の上へ{c}を置いてみる", "put {c} over {p}"],
    "through": ["{p}の穴に{c}を通す", "pass {c} through {p}"],
    "none": ["{p}の近くに{c}がある", "look at {p} and {c}"],
}


def build(templates):
    return [{"text": template.format(p=parent, c=child), "relation": label}
            for label, values in templates.items() for template in values
            for parent in (ENGLISH_NOUNS if template.isascii() else NOUNS)
            for child in (ENGLISH_NOUNS if template.isascii() else NOUNS)]


def main():
    folder = Path(__file__).resolve().parent
    train, validation = build(TRAIN_TEMPLATES), build(VALID_TEMPLATES)
    # Single objects and ordinary writing belong to none, without teaching a new
    # relation from their mere mention. Repeated phrases are removed afterward.
    train.extend({"text": f"{word}の表面に文字を流す", "relation": "none"} for word in NOUNS)
    train.extend({"text": f"{word}を作って", "relation": "none"} for word in NOUNS)
    train.extend({"text": word, "relation": "none"} for word in NOUNS)
    train.extend({"text": text, "relation": "none"} for text in ["今日は晴れた。", "明日の予定を書く。", "なんでもない。", "a dragon", "an animal"])
    for name, values in [("training", train), ("validation", validation)]:
        unique = list({item["text"]: item for item in values}.values())
        body = "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in unique)
        target = folder / f"{name}.jsonl"
        target.write_text(body)
        print(name, len(unique), hashlib.sha256(body.encode()).hexdigest())


if __name__ == "__main__":
    main()
