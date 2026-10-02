"""CPU sentence embeddings -> bounded authored surface scaffolds.

The learned encoder chooses among a finite set of families and compares semantic
descriptors. No text is executed, stored, or sent to a remote service. Geometry is
constructed by the browser; this is not an unrestricted text-to-mesh model.
Embedding pooling follows the earlier Semantic Glyph Lab experiment.
"""
from __future__ import annotations

import hashlib
import math
from pathlib import Path
import re
import threading
import time
import unicodedata

MODEL_ID = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
REVISION = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"
WEIGHT_SHA256 = "783fea82d71a58179b830a4dbd2d58447e640609e98eedf9ffa12622d375a672"
TOKENIZER_SHA256 = "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8"
MAX_TEXT = 4000
MIN_SCORE = .48
MIN_MARGIN = .028
DEFAULT = {"family": "sphere", "height": 1., "width": 1., "neck": .45, "bend": 0., "twist": 0.}
BOUNDS = {"height": (.5, 1.8), "width": (.5, 1.8), "neck": (.15, 1.), "bend": (-1., 1.), "twist": (-1., 1.)}

# Authored descriptions provide a vocabulary of geometry we can actually build.
# All family selection, including direct nouns, goes through encoder similarity.
CAPTIONS = {
    "vase": ["花瓶。花を生ける容器。細い口と膨らんだ胴。", "一輪挿し。壺。花を入れる器。", "vase for flowers with a neck and a rounded body", "a pottery urn or decorative flower vessel"],
    "sword": ["剣。刀。まっすぐ長い刃と持ち手。", "切っ先がある武器。両刃の剣。", "a sword with a blade, guard, and handle", "a long sharp blade or a saber", "刃。刃物。切っ先。"],
    "mobius": ["メビウスの輪。ねじれた帯。表と裏がつながる輪。", "輪っか。ひねってつないだリボン。", "a Mobius strip, a twisted ribbon loop with one surface", "an endless twisted band", "輪っか"],
    "ring": ["円環。普通の輪。ドーナツ状の丸い管。", "穴の開いた輪。丸いタイヤ。", "a torus, a donut-shaped circular tube", "an ordinary circular ring without a twist"],
    "sphere": ["球体。丸い球。ボール。", "玉。地球のような丸い形。", "a sphere, a round ball", "a spherical globe or orb"],
    "cube": ["立方体。四角い箱。角ばった形。", "四角い。直方体。箱の形。", "a cube, a square box with flat faces", "a cuboid or rectangular block"],
}
ALIASES = {
    "vase": ["花瓶", "一輪挿し", "壺", "つぼ", "花入れ", "vase", "urn"],
    "sword": ["剣", "刀", "刃", "刃物", "ソード", "sword", "blade", "saber"],
    "mobius": ["メビウスの輪", "メビウス", "輪っか", "mobius strip", "mobius", "möbius", "twisted ribbon"],
    "ring": ["円環", "ドーナツ", "輪", "torus", "donut", "ring"],
    "sphere": ["球体", "球", "丸い", "ボール", "sphere", "ball", "orb"],
    "cube": ["立方体", "直方体", "四角", "箱", "cube", "cuboid", "box"],
}

DESCRIPTORS = {
    "height": [(.65, "背が低い"), (.65, "ずんぐりした"), (.65, "short and squat"), (1.65, "背が高い"), (1.65, "すらっとした"), (1.65, "tall and elongated")],
    "width": [(.65, "細い"), (.65, "ほっそりした"), (.65, "slim and narrow"), (1.55, "太い"), (1.55, "ふっくらした"), (1.55, "wide and bulbous")],
    "neck": [(.2, "首が細い"), (.2, "口が小さい"), (.2, "a narrow neck with a small mouth"), (.85, "口が広い"), (.85, "首が太い"), (.85, "a wide neck with a broad mouth")],
    "bend": [(0., "まっすぐ"), (0., "straight and rigid"), (.65, "曲がった"), (.65, "しなやかに曲げる"), (.65, "bent and curved")],
    "twist": [(0., "ねじらない"), (0., "untwisted"), (.65, "ひねった"), (.65, "らせん状"), (.65, "twisted and spiraling")],
}
BACKGROUND = ["今日は楽しかった。明日の予定を考える。", "人間。鳥。魚。生き物。", "ドラゴン。恐竜。宇宙船。", "風車。建物。乗り物。", "I am writing about my day, not requesting a shape.", "an animal, a spaceship, or a building"]

# Strong explicit modifiers anchor numerical meaning. These are exposed as rules
# in evidence, rather than credited to the sentence encoder.
ANCHORS = [
    (r"細長(?:い|く|くし)|slender|elongated", {"height": 1.65, "width": .65}),
    (r"背(?:が|を)?高(?:い|く)|長(?:い|く)|tall|long", {"height": 1.65}),
    (r"背(?:が|を)?低(?:い|く)|短(?:い|く)|平た(?:い|く)|short|squat|flat", {"height": .65}),
    (r"細(?:い|く|身)|ほっそり|slim|narrow", {"width": .65}),
    (r"太(?:い|く)|幅(?:が|を)?広(?:い|く)|ふっくら|wide|fat|bulbous", {"width": 1.55}),
    (r"(?:首|口)(?:が|を)?(?:細|狭)(?:い|く)|口(?:が|を)?小さ(?:い|く)|narrow neck|small mouth", {"neck": .2}),
    (r"口(?:が|を)?広(?:い|く)|首(?:が|を)?太(?:い|く)|wide neck|broad mouth", {"neck": .85}),
    (r"曲(?:がった|がる|げた|げて|げる)|湾曲|しなやか|curved|bent|bend", {"bend": .65}),
    (r"ねじ(?:れた|れる|れて|る|って|った)|ひね(?:った|る|って)|らせん状|螺旋状|twisted|twisting|spiral", {"twist": .65}),
    (r"まっすぐ|真っ直ぐ|曲げ(?:ない|ず)|straight|unbent", {"bend": 0.}),
    (r"ねじ(?:らない|れない|りなし)|ひね(?:らない|りなし)|untwisted|no twist", {"twist": 0.}),
    (r"左(?:に|へ)?曲げ|bend left", {"bend": -.65}),
    (r"逆(?:に)?ねじ|左巻き|twist left", {"twist": -.65}),
]


def normalize(text: str) -> str:
    return unicodedata.normalize("NFKC", text).strip().lower()


def validated_previous(value: object) -> dict | None:
    if not isinstance(value, dict) or not isinstance(value.get("family"), str) or value["family"] not in CAPTIONS:
        return None
    spec = dict(DEFAULT, family=value["family"])
    for key, (low, high) in BOUNDS.items():
        number = value.get(key)
        if isinstance(number, (int, float)) and not isinstance(number, bool) and math.isfinite(number):
            spec[key] = max(low, min(high, number))
    return spec


def pattern(alias: str) -> str:
    if re.fullmatch(r"[a-z ]+", alias):
        return rf"(?<![a-z]){re.escape(alias)}(?![a-z])"
    if len(alias) == 1:
        return rf"(?<![\u3400-\u9fff]){re.escape(alias)}(?![\u3400-\u9fff])"
    return re.escape(alias)


def negation_clean(text: str) -> tuple[str, bool]:
    """Remove a rejected known noun so it cannot dominate sentence similarity."""
    reject = r"\s*(?:ではなく|ではない|じゃない|以外|でなく|を除く|は不要|は作らない|を作らない|にしない)"
    changed = False
    for aliases in ALIASES.values():
        for alias in sorted(aliases, key=len, reverse=True):
            text, count = re.subn(pattern(alias) + reject, " ", text)
            changed = changed or count > 0
            text, count = re.subn(r"\b(?:not|without|no)\s+(?:a\s+)?" + pattern(alias), " ", text)
            changed = changed or count > 0
    return text.strip(), changed


class Embeddings:
    def __init__(self, model_dir: Path):
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer
        weight = model_dir / "onnx/model_qint8_arm64.onnx"
        tokenizer = model_dir / "tokenizer.json"
        for path, expected in [(weight, WEIGHT_SHA256), (tokenizer, TOKENIZER_SHA256)]:
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise RuntimeError("Pinned model checksum mismatch")
        self.np = np
        self.lock = threading.Lock()
        self.tokenizer = Tokenizer.from_file(str(tokenizer))
        self.tokenizer.enable_truncation(max_length=128, direction="left")
        self.tokenizer.enable_padding(pad_id=self.tokenizer.token_to_id("<pad>"), pad_token="<pad>")
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        options.log_severity_level = 3
        self.session = ort.InferenceSession(str(weight), sess_options=options, providers=["CPUExecutionProvider"])
        self.input_names = {item.name for item in self.session.get_inputs()}
        descriptions = {family: list(captions) + ALIASES[family] for family, captions in CAPTIONS.items()}
        self.family_ids = [family for family, captions in descriptions.items() for _ in captions]
        captions = [text for values in descriptions.values() for text in values]
        self.family_vectors = np.concatenate([self.encode(captions[i:i+8]) for i in range(0, len(captions), 8)])
        self.descriptor_ids = [(key, value) for key, pairs in DESCRIPTORS.items() for value, _ in pairs]
        self.descriptor_vectors = self.encode([text for pairs in DESCRIPTORS.values() for _, text in pairs])
        self.background_vectors = self.encode(BACKGROUND)

    def encode(self, texts: list[str]):
        np = self.np
        with self.lock:
            encoded = self.tokenizer.encode_batch(texts)
            feed = {"input_ids": np.array([item.ids for item in encoded], dtype=np.int64),
                    "attention_mask": np.array([item.attention_mask for item in encoded], dtype=np.int64),
                    "token_type_ids": np.array([item.type_ids for item in encoded], dtype=np.int64)}
            output = self.session.run(None, {key: value for key, value in feed.items() if key in self.input_names})[0]
        mask = feed["attention_mask"][..., None]
        vectors = (output * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1)
        return vectors / np.linalg.norm(vectors, axis=1, keepdims=True).clip(min=1e-12)

    def families(self, vector) -> list[dict]:
        scores = self.family_vectors @ vector
        grouped = {}
        for family, score in zip(self.family_ids, scores):
            grouped[family] = max(grouped.get(family, -1), float(score))
        return [{"family": family, "score": round(score, 5)} for family, score in sorted(grouped.items(), key=lambda pair: pair[1], reverse=True)]

    def descriptors(self, vector) -> dict:
        grouped = {}
        for (key, value), score in zip(self.descriptor_ids, self.descriptor_vectors @ vector):
            values = grouped.setdefault(key, {})
            values[value] = max(values.get(value, -1.), float(score))
        selected = {}
        global_best = max(score for values in grouped.values() for score in values.values())
        for key, values in grouped.items():
            pairs = [(score, value) for value, score in values.items()]
            pairs.sort(reverse=True)
            if pairs[0][0] > .68 and pairs[0][0] - pairs[1][0] > .15 and pairs[0][0] >= global_best - .035:
                selected[key] = (pairs[0][1], round(pairs[0][0], 5))
        return selected


class Interpreter:
    def __init__(self, embeddings: Embeddings | None):
        self.embeddings = embeddings

    def interpret(self, text: object, previous: object = None) -> dict:
        started = time.perf_counter()
        if not isinstance(text, str) or len(text) > MAX_TEXT:
            raise ValueError(f"text must be a string of at most {MAX_TEXT} characters")
        normalized = normalize(text)
        cleaned, rejected = negation_clean(normalized)
        old = validated_previous(previous)
        if self.embeddings is None:
            return {"spec": None, "source": "unchanged", "modelMs": 0., "confidence": 0., "reason": "model-unavailable", "candidates": [], "evidence": []}
        if not cleaned or not re.search(r"[\w\u3040-\u9fff]", cleaned):
            return {"spec": None, "source": "unchanged", "modelMs": 0., "confidence": 0., "reason": "negated" if rejected else "empty", "candidates": [], "evidence": []}
        evidence = []
        choices = {}
        for expression, changes in ANCHORS:
            for match in re.finditer(expression, cleaned, flags=re.I):
                for key, value in changes.items():
                    existing = choices.get(key)
                    if existing is None or match.start() >= existing[0] or (match.start() <= existing[0] and match.end() > existing[1]):
                        choices[key] = (match.start(), match.end(), value)
        modifiers = {key: value[2] for key, value in choices.items()}
        # Modifiers alone should edit a prior scaffold, rather than reinterpret
        # "make it thinner" as a new object family.
        noun_spans = [(match.start(), match.end()) for aliases in ALIASES.values() for alias in aliases for match in re.finditer(pattern(alias), cleaned)]
        noun_spans = [span for span in noun_spans if not any(other[0] <= span[0] and other[1] >= span[1] and other[1]-other[0] > span[1]-span[0] for other in noun_spans)]
        known_noun = bool(noun_spans)
        residual = cleaned
        for expression, _ in ANCHORS:
            residual = re.sub(expression, " ", residual, flags=re.I)
        residual = re.sub(r"もっと|少し|ちょっと|この|これ|それ|形|感じ|にして|して|する|ください|くれ|欲しい|ほしい|だけ|に|を|で|と|の|な|please|make|it|more|slightly|[\s。、,.!！?？]", "", residual)
        modifier_only = bool(modifiers and not known_noun and not residual)
        vector = self.embeddings.encode([cleaned])[0]
        # Separating explicit modifier spans prevents a known adjective such as
        # "curved" from overwhelming the noun "blade" in family retrieval.
        family_text = cleaned
        for expression, _ in ANCHORS:
            family_text = re.sub(expression, " ", family_text, flags=re.I)
        family_text = re.sub(r"もっと|少し|ちょっと|にして|ください|して|くれ|please|make", " ", family_text)
        if noun_spans:
            # An authored lexer isolates supported nouns; the learned encoder
            # still maps each isolated phrase to the supported family vectors.
            start, end = max(noun_spans, key=lambda span: span[0])
            family_text = cleaned[start:end]
            evidence.append({"kind": "noun-focus-rule"})
        family_vector = self.embeddings.encode([family_text])[0] if family_text.strip() != cleaned and family_text.strip() else vector
        candidates = self.embeddings.families(family_vector)
        top, runner = candidates[:2]
        background_score = float(max(self.embeddings.background_vectors @ vector))
        selected = top["score"] >= MIN_SCORE and top["score"] - runner["score"] >= MIN_MARGIN and (known_noun or top["score"] > background_score + .04)
        attribute_text = cleaned
        for start, end in sorted(set(noun_spans), reverse=True):
            attribute_text = attribute_text[:start] + " " + attribute_text[end:]
        descriptor_vector = self.embeddings.encode([attribute_text])[0] if attribute_text.strip() and attribute_text.strip() != cleaned else vector
        semantic_attributes = self.embeddings.descriptors(descriptor_vector) if attribute_text.strip() else {}
        if not known_noun and semantic_attributes and max(score for _, score in semantic_attributes.values()) > .92:
            modifier_only = True
            selected = False
        if modifier_only and old:
            spec = dict(old)
            evidence.append({"kind": "context", "family": old["family"]})
        elif selected:
            spec = dict(DEFAULT, family=top["family"])
            evidence.append({"kind": "embedding-family", "family": top["family"], "score": top["score"]})
        else:
            return {"spec": None, "source": "unchanged", "modelMs": round((time.perf_counter()-started)*1000, 3), "confidence": top["score"], "reason": "ambiguous", "candidates": candidates[:3], "evidence": []}
        for key, (value, score) in semantic_attributes.items():
            if key not in modifiers:
                spec[key] = value
                evidence.append({"kind": "embedding-descriptor", "attribute": key, "score": score})
        for key, value in modifiers.items():
            spec[key] = value
            evidence.append({"kind": "explicit-attribute-rule", "attribute": key})
        spec = validated_previous(spec)
        return {"spec": spec, "source": "semantic-model", "modelMs": round((time.perf_counter()-started)*1000, 3), "confidence": top["score"], "candidates": candidates[:3], "evidence": evidence, "reason": "context-edit" if modifier_only and old else "selected"}
