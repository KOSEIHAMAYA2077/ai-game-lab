"""Finite program vocabulary and the authored syntax boundaries.

The relation kind is predicted by a trained head, not selected from PATTERNS.
PATTERNS only identify two part phrases and normalize parent -> child order.
"""
import re
PRIMITIVES = ["sphere", "box", "tube", "blade", "ring", "vase"]
CAPTIONS = {
    "sphere": ["球体。丸い球。ボール。", "丸い玉。球形のかたまり。", "a sphere, a round ball", "a spherical globe or orb"],
    "box": ["立方体。四角い箱。直方体。", "四角いブロック。角ばった箱。", "a cube or cuboid, a rectangular box", "a square block with flat faces"],
    "tube": ["棒。管。細長い筒。", "パイプ。まっすぐな円柱。", "a rod, a tube, a cylindrical pipe", "a long narrow cylinder or stick"],
    "blade": ["剣。刀。まっすぐ長い刃。", "刃物。切っ先のある剣。", "a sword or blade with a sharp tip", "a long flat blade or saber"],
    "ring": ["輪。円環。輪っか。", "穴の開いた輪。ドーナツ状。", "a circular ring or a torus", "a donut-shaped loop with a hole"],
    "vase": ["花瓶。細い口と膨らんだ胴。", "花を生ける器。壺。一輪挿し。", "a vase or urn for flowers", "a pottery vessel with a neck and rounded body"],
}
ALIASES = {
    "sphere": ["丸い玉", "球体", "球", "玉", "ボール", "丸い", "sphere", "ball", "orb"],
    "box": ["四角い箱", "四角い", "立方体", "直方体", "箱", "四角", "box", "cube", "cuboid", "block"],
    "tube": ["円柱の棒", "棒", "管", "筒", "円柱", "パイプ", "tube", "rod", "pipe", "cylinder", "stick"],
    "blade": ["剣", "刀", "刃", "刃物", "ソード", "sword", "blade", "saber"],
    "ring": ["メビウスの輪", "メビウス", "輪っか", "円環", "輪", "ドーナツ", "ring", "torus", "loop", "donut"],
    "vase": ["花瓶", "花入れ", "一輪挿し", "壺", "つぼ", "vase", "urn"],
}
BACKGROUND = ["今日は楽しかった。明日の予定を考える。", "人間。鳥。魚。生き物。", "ドラゴン。恐竜。宇宙船。", "風車。建物。乗り物。", "an animal, a spaceship, or a building", "I am writing about my day.", "ドラゴン", "竜", "鳥", "魚", "人間", "建物", "宇宙船", "dragon", "tree", "animal", "cat", "person"]
MIN_SCORE = .5
MIN_MARGIN = .035
RELATION_MIN_SCORE = .62
RELATION_MIN_MARGIN = .15
BOUNDS = {"height": (.4, 1.8), "width": (.4, 1.8), "depth": (.4, 1.8), "bend": (-1., 1.), "twist": (-1., 1.)}
DEFAULTS = {primitive: {"height": 1., "width": 1., "depth": 1., "bend": 0., "twist": 0.} for primitive in PRIMITIVES}
DEFAULTS["tube"].update(height=1.4, width=.4, depth=.4)
DEFAULTS["blade"].update(height=1.4, width=.5, depth=.4)
ANCHORS = [
    (r"細長(?:い|く)|slender|elongated", {"height": 1.65, "width": .4, "depth": .4}),
    (r"背(?:が|を)?高(?:い|く)|長(?:い|く)|tall|long", {"height": 1.65}),
    (r"背(?:が|を)?低(?:い|く)|短(?:い|く)|平た(?:い|く)|short|squat|flat", {"height": .65}),
    (r"細(?:い|く|身)|幅(?:が|を|の)?狭(?:い|く)|ほっそり|slim|narrow|thin", {"width": .4, "depth": .4}),
    (r"太(?:い|く)|幅(?:が|を|の)?広(?:い|く)|ふっくら|wide|broad|fat|bulbous|thick", {"width": 1.55, "depth": 1.55}),
    (r"大き(?:い|な|く)|巨大|large|big|huge", {"height": 1.55, "width": 1.55, "depth": 1.55}),
    (r"小さ(?:い|な|く)|小型|small|tiny", {"height": .65, "width": .65, "depth": .65}),
    (r"曲(?:がった|がる|げた|げて|げる)|湾曲|しなやか|curved|bent|bend", {"bend": .65}),
    (r"ねじ(?:れた|れる|れて|る|って|った)|ひね(?:った|る|って)|らせん状|螺旋状|twisted|twisting|spiral", {"twist": .65}),
    (r"まっすぐ|真っ直ぐ|曲げ(?:ない|ず)|straight|unbent", {"bend": 0.}),
    (r"ねじ(?:らない|れない|りなし)|ひね(?:らない|りなし)|untwisted|no twist", {"twist": 0.}),
]
DESCRIPTORS = {
    "height": [(.65, "背が低い"), (.65, "ずんぐりした"), (.65, "short and squat"), (1.65, "背が高い"), (1.65, "すらっとした"), (1.65, "tall and elongated")],
    "width": [(.4, "細い"), (.4, "ほっそりした"), (.4, "slim and narrow"), (1.55, "太い"), (1.55, "ふっくらした"), (1.55, "wide and bulbous")],
    "bend": [(0., "まっすぐ"), (0., "straight and rigid"), (.65, "曲がった"), (.65, "しなやかに曲げる"), (.65, "bent and curved")],
    "twist": [(0., "ねじらない"), (0., "untwisted"), (.65, "ひねった"), (.65, "らせん状"), (.65, "twisted and spiraling")],
}
# group 1 / group 2 identify two phrases. reverse normalizes parent/child.
# A pattern's name records extraction provenance only, never the head label.
PATTERNS = [
    {"name": "jp-object-tip", "regex": r"(.+?)を(.+?)の(?:先端|末端|先|端)(?:に|へ)", "reverse": True},
    {"name": "jp-object-top", "regex": r"(.+?)を(.+?)の(?:上方|上|てっぺん|頂点)(?:に|へ)", "reverse": True},
    {"name": "jp-subject-through", "regex": r"(.+?)が(.+?)を(?:貫|突き抜|通り抜)", "reverse": True},
    {"name": "jp-tip", "regex": r"(.+?)の(?:先端|末端|先|端|片端)(?:に|へ|で)(?:は)?\s*[、,]?\s*([^。.!?！？;；、,]+)", "reverse": False},
    {"name": "jp-top", "regex": r"(.+?)の(?:上方|上|てっぺん|頂点)(?:に|へ)(?:は)?\s*[、,]?\s*([^。.!?！？;；、,]+)", "reverse": False},
    {"name": "jp-through-relative", "regex": r"(.+?)を(?:貫く|通る|突き抜ける)([^。.!?！？;；、,]+)", "reverse": False},
    {"name": "jp-through-object", "regex": r"(.+?)を(.+?)(?:が)?(?:貫|突き抜|通り抜)", "reverse": False},
    {"name": "jp-through-center", "regex": r"(.+?)の(?:中心|中|中央|穴)(?:を|に)(.+?)(?:が|を)(?:貫|通|挿|刺)", "reverse": False},
    {"name": "jp-pass", "regex": r"(.+?)に(.+?)を(?:通|挿|刺)", "reverse": False},
    {"name": "en-with-tip", "regex": r"(.+?)\s+with\s+(.+?)\s+(?:attached\s+)?(?:at|on)\s+(?:the\s+)?(?:end|tip)", "reverse": False},
    {"name": "en-tip", "regex": r"(?:attach\s+|add\s+|put\s+)?(.+?)\s+(?:at|on|to)\s+(?:the\s+)?(?:end|tip)\s+of\s+([^。.!?！？;；、,]+)", "reverse": True},
    {"name": "en-top", "regex": r"(?:put\s+|place\s+)?(.+?)\s+(?:above|over|on\s+top\s+of)\s+(.+)", "reverse": True},
    {"name": "en-through", "regex": r"(?:pass\s+)?(.+?)\s+(?:goes\s+)?through\s+(.+)", "reverse": True},
    {"name": "en-pierced", "regex": r"(.+?)\s+pierced\s+by\s+(.+)", "reverse": False},
    {"name": "jp-coordination", "regex": r"(.+?)と(.+)", "reverse": False},
    {"name": "en-coordination", "regex": r"(.+?)\s+and\s+(.+)", "reverse": False},
]
NEGATIVE_OPERATION = r"置かない|乗せない|載せない|付けない|つながない|繋がない|貫かない|通さない|接続しない|do not|don't|never"

# The renderer already supports these eight inks. Color is not a structural
# relation. Only the relation head input removes it; part interpretation keeps
# the original phrase and the rendering side still sees every submitted word.
COLOR_PATTERNS = [
    r"(?:水色|シアン)(?:い|く)?(?:の)?|(?<![a-z])cyan(?![a-z])",
    r"黄色?(?:い|く)?(?:の)?|(?<![a-z])yellow(?![a-z])",
    r"赤色?(?:い|く)?(?:の)?|(?<![a-z])red(?![a-z])",
    r"青色?(?:い|く)?(?:の)?|(?<![a-z])blue(?![a-z])",
    r"緑色?(?:い|く)?(?:の)?|(?<![a-z])green(?![a-z])",
    r"紫色?(?:い|く)?(?:の)?|(?<![a-z])purple(?![a-z])",
    r"(?:桃色|ピンク)(?:い|く)?(?:の)?|(?<![a-z])pink(?![a-z])",
    r"白色?(?:い|く)?(?:の)?|(?<![a-z])white(?![a-z])",
]


def without_color(text):
    """Structural interpretation omits ink; submitted glyph text stays intact."""
    for expression in COLOR_PATTERNS:
        text = re.sub(expression, "", text, flags=re.I)
    return text


def relation_query(text):
    """Mask known shape nouns/modifiers, retaining the actual relation wording.

    The authored mask reduces noun/size leakage into the learned relation head.
    It neither supplies the relation label nor changes lexical relation cues.
    """
    text = without_color(text)
    placeholder = "object" if text.isascii() else "物体"
    for expression, _ in ANCHORS:
        text = re.sub(expression, " ", text, flags=re.I)
    aliases = sorted(set(alias for values in ALIASES.values() for alias in values), key=len, reverse=True)
    spans = []
    for alias in aliases:
        expression = re.escape(alias)
        if re.fullmatch(r"[a-z ]+", alias):
            expression = rf"(?<![a-z]){expression}(?![a-z])"
        elif len(alias) == 1:
            expression = rf"(?<![\u3400-\u9fff]){expression}(?![\u3400-\u9fff])"
        spans.extend((match.start(), match.end()) for match in re.finditer(expression, text, flags=re.I))
    spans = [span for span in set(spans) if not any(other[0] <= span[0] and other[1] >= span[1] and other[1]-other[0] > span[1]-span[0] for other in spans)]
    for start, end in sorted(spans, reverse=True):
        text = text[:start]+placeholder+text[end:]
    text = re.sub(r"物体\s*(?:の\s*)?物体", "物体", text)
    text = re.sub(r"\ba\s+object\b", "object", text)
    return re.sub(r"\s+", " ", text).strip()
