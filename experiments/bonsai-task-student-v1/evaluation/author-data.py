"""Author-created Japanese artificial evaluation; no model or train/dev inputs read."""
from pathlib import Path
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
DEFAULT = {"length": "neutral", "width": "neutral", "bend": "straight"}

# Each line is independently authored. The two scenes per shape have distinct
# family IDs: neither is a paraphrase of a shared source sentence.
DESCRIPTIONS = [
    ("condense", "どの方向から見ても輪郭が丸く、中心から表面までが等距離の固まり。", []),
    ("condense", "つなぎ目も角もなく、掌の中で転がしても同じ姿に見える立体。", ["egg"]),
    ("vortex", "排水口へ向かって水が回転し、中央へ吸い込まれている。", []),
    ("vortex", "外側の粒がぐるぐる内側へ寄り、真ん中に深いくぼみができる。", []),
    ("orbit", "中央の粒の周囲を、傾きの異なる複数の周回路が囲んでいる。", []),
    ("orbit", "核から離れた小粒が、交差するいくつもの周回コースに配置されている。", ["saturn"]),
    ("mobius", "帯を半回だけねじって両端をつなぎ、表をたどると裏へ戻る。", []),
    ("mobius", "一本の帯の面を切れ目なく進むと、一周後には反対側へ移っている。", []),
    ("ring", "真ん中に穴があり、均一な太さの丸い管が一周して閉じている。", []),
    ("ring", "浮き具のように、中央を空けた丸いふちだけが続いている。", []),
    ("cube", "六枚の等しい正方形の面が、すべて直角に接する立体。", []),
    ("cube", "縦も横も奥行きも同寸で、どの面を下に置いても高さが同じ。", []),
    ("cuboid", "六面で囲まれた箱で、縦と横と奥行きがそれぞれ違う。", []),
    ("cuboid", "レンガのように、向きを替えると高さが変わる角張った立体。", []),
    ("cross", "縦一本と横一本の棒が、真ん中で直角に交わっている。", []),
    ("cross", "中心から上下左右へ、同じ太さの腕が四本伸びた印。", []),
    ("triangle", "三本の線分だけで囲み、頂点が三つある平面の図。", []),
    ("triangle", "底辺の両端から斜めの辺を伸ばし、上の一点で合わせた輪郭。", ["pyramid"]),
    ("square", "同じ寸法の四辺が直角に接し、一枚の平らな面を囲んでいる。", []),
    ("square", "上下左右の辺が同寸で、対角線も同寸の平面図。", []),
    ("fireworks", "夜空の一点が破裂し、光の筋が放射状に広がって消える。", []),
    ("fireworks", "打ち上げた火薬が空中で開き、光る粒が四方へ散る。", []),
    ("dango", "串の上に丸いもちが三つ、順番に刺さっている。", []),
    ("dango", "甘いたれを塗った小さな丸もちが、棒に沿って並んでいる。", []),
    ("flower", "茎の先で色づいた薄片が開き、中央の小さな芯を囲んでいる。", ["rose", "lotus"]),
    ("flower", "香りを出す植物の先端に、放射状の色鮮やかな薄片が並ぶ。", ["rose", "lotus"]),
    ("butterfly", "六本の脚と触角を持ち、左右に大きな模様付きの翅を広げる虫。", []),
    ("butterfly", "細かな鱗粉の付いた二対の翅を開き、蜜を吸う口を伸ばす。", []),
    ("jellyfish", "透明なゼリー状のドームの下から、何本もの触手が垂れる。", []),
    ("jellyfish", "海中で半透明のドームを縮め、ひらひらした触手を引き連れて進む。", []),
    ("tree", "地面から一本の幹が立ち、上でいくつも枝分かれして緑が茂る。", []),
    ("tree", "根を張った幹の先で枝が重なり、緑の大きな梢を作っている。", []),
    ("star", "中心から五つの鋭い先端が突き出し、その間が深くへこんだ印。", []),
    ("star", "五方向の尖った腕を持つ、夜空のきらめきを示す平たい印。", ["sun"]),
    ("helix", "一本の線が一定の高さずつ上がりながら、同じ中心の周囲を何周もする。", []),
    ("helix", "金属のばねのように、一定間隔の巻きが縦に積み重なっている。", []),
    ("hourglass", "上下二つの透明な容器が中央の細い首でつながり、粒が落ちて時を測る。", []),
    ("hourglass", "くびれを挟んで上下が対称になり、上の砂が下へ少しずつ移る。", []),
    ("saturn", "丸い惑星の赤道付近を、平たい帯状の環が囲んでいる。", []),
    ("saturn", "ガスでできた惑星の周りに、氷の粒が薄い円盤を作っている。", []),
    ("sword", "握る柄と手を守る鍔があり、先の尖った金属の刃が続く武器。", []),
    ("sword", "両刃の武器を鞘から抜くと、柄の先に尖った刀身が現れる。", []),
    ("vase", "底が膨らみ口元がくびれた器に、切った茎を挿して飾る。", ["bottle"]),
    ("vase", "水と切り取った植物を入れて卓上に飾る、口の開いた背のある器。", ["bottle"]),
    ("cone", "丸い底面から側面がすぼまり、一つの頂点へ集まる立体。", []),
    ("cone", "アイスを載せる焼き菓子のように、丸い口から先端へすぼまった形。", []),
    ("cylinder", "上下に同寸の丸い平面があり、側面はまっすぐな筒になっている。", []),
    ("cylinder", "切った丸太のように、二つの平行な丸い断面を側面が結ぶ。", []),
    ("capsule", "筒の両端が半球になり、薬を包む二つの殻がかみ合う。", []),
    ("capsule", "中央は一定の太さで、両端だけが滑らかな丸いふたになった立体。", []),
    ("pyramid", "四隅のある底から四枚の斜面を立て、上の一点で合わせる。", []),
    ("pyramid", "古代の墓の外形を思わせる、平たい底と四つの三角の斜面を持つ建造物。", []),
    ("diamond", "研磨された透明な石が、たくさんの平らな小面で光を反射する。", ["octahedron"]),
    ("diamond", "指輪に留める石で、上は広い面、下は尖った先端になっている。", []),
    ("octahedron", "八枚の等しい三角の面が集まり、上と下に頂点を持つ立体。", []),
    ("octahedron", "四角い底を持つ二つの錐を、底面同士で貼り合わせた姿。", ["diamond"]),
    ("heart", "上に二つの丸い膨らみが並び、下で一つの尖りへ合流する印。", []),
    ("heart", "愛情を示す印で、上辺の中央にくぼみがあり、下端だけが尖る。", []),
    ("egg", "殻で包まれた楕円の食品で、片端が少し尖り、もう片端は丸い。", []),
    ("egg", "鳥類が産む殻の中に、黄色い中心と透明な液体が収まっている。", []),
    ("droplet", "蛇口の先から離れる水が、下は丸く上は尖った姿になる。", []),
    ("droplet", "目元から頬を伝う液体の一粒を描き、ふくらんだ底から上へ尖らせた輪郭。", []),
    ("moon", "暗い空に浮かぶ天体が、片側だけ光って細い弧に見える。", []),
    ("moon", "満ち欠けする天体の、弓のように光っている部分だけを描いた姿。", []),
    ("cloud", "水の粒が空に集まり、輪郭の柔らかな白い塊となって浮かぶ。", []),
    ("cloud", "青空に浮く白い塊で、いくつもの丸いふくらみが連なっている。", []),
    ("mushroom", "森の地面から出た柄の上に、丸い帽子のような部分が載る。", []),
    ("mushroom", "菌類の一本の柄が、裏にひだを持つ丸い帽子を支えている。", []),
    ("leaf", "植物の枝に付く薄い緑の一枚で、中央から細かな筋が分かれる。", []),
    ("leaf", "光合成をする薄い緑の面の中を、中央の筋と枝分かれした筋が走る。", []),
    ("apple", "赤い果実の上側にくぼみと軸があり、丸い胴が下へ続く。", []),
    ("apple", "丸い果実をかじると白い果肉が見え、軸の周りだけへこんでいる。", []),
    ("pear", "黄緑の果実で、下側がふくらみ、軸の付く上側がくびれている。", []),
    ("pear", "下に大きなふくらみを持ち、上へすぼまるざらざらした果実。", []),
    ("pumpkin", "橙色の大きな果実に縦の深い溝が並び、上に硬い軸が付く。", []),
    ("pumpkin", "秋の収穫物で、丸い胴がいくつもの縦の節に区切られている。", []),
    ("shell", "海の軟体動物を守る殻が、先端から巻きを増やして広がる。", ["helix"]),
    ("shell", "海岸で拾った硬い殻は、中心からくるくる巻いて出口へ広がる。", ["helix"]),
    ("fish", "水中で暮らす動物が、ひれを動かし、尾で水を押して進む。", []),
    ("fish", "えらで呼吸する動物の胴にうろこが並び、後端は尾びれになる。", []),
    ("bird", "羽毛で覆われた動物が、くちばしを前へ出し、二枚の翼を広げる。", []),
    ("bird", "枝にとまる小さな動物には、羽毛、くちばし、二本の脚がある。", []),
    ("snake", "脚のない爬虫類が、うろこのある胴をくねらせて地面を進む。", []),
    ("snake", "舌先が二つに分かれた爬虫類で、頭から尾まで脚が一つもない。", []),
    ("turtle", "背中を硬い甲羅が覆い、その下から四本の脚と頭が出る。", []),
    ("turtle", "丸い甲羅へ頭を引っ込める爬虫類が、四本の脚で歩いている。", []),
    ("spider", "八本の脚が小さな胴から放射状に伸び、糸で獲物を捕らえる。", []),
    ("spider", "二つに分かれた胴の周りに四対の脚があり、自分で網を張る。", []),
    ("lotus", "池の水面の上で、幾重もの淡い薄片が中央の台を包んで開く。", ["flower"]),
    ("lotus", "泥の中から伸びた植物が、水面の上で薄片を幾重にも開く。", ["flower"]),
    ("rose", "とげのある茎の先に、赤い薄片が幾重にも巻き重なって開く。", ["flower"]),
    ("rose", "香りの強い植物の先端で、薄片が中心を囲むように何層も重なる。", ["flower"]),
    ("sun", "昼間に地上を照らす天体を、丸い中心と周囲の放射線で描く。", []),
    ("sun", "丸い発光体から、あらゆる方向へ光線が伸びる印。", ["star", "fireworks"]),
    ("snowflake", "空から落ちる氷の一粒が、六方向へ対称に枝分かれしている。", []),
    ("snowflake", "六本の腕に細かな枝が付いた、冬の氷の粒の模様。", []),
    ("gear", "回転を伝える部品の外周に、同じ間隔の歯が並んでいる。", []),
    ("gear", "隣の歯と噛み合わせて回す、中央に穴のある円盤状の部品。", []),
    ("bolt", "空と地面の間を一瞬で走る放電が、鋭く折れた光の筋になる。", []),
    ("bolt", "ごろごろという轟音の直前に、空でぎざぎざの発光する筋が現れた。", []),
    ("bottle", "液体を保存する容器で、胴より口がすぼまり、栓で閉じられる。", []),
    ("bottle", "飲料の容器を置くと、ふくらんだ胴の上に小さな口とふたがある。", ["vase"]),
    ("cup", "取っ手の付いた小さな器へ、熱い飲み物を注いで口を付ける。", []),
    ("cup", "上が開いた飲み物用の器で、側面に指を通す取っ手が付く。", []),
    ("teapot", "茶をいれる容器に、ふたと取っ手と、注ぐための口が付く。", []),
    ("teapot", "茶器の丸い胴から注ぎ口が出て、反対側には持つための柄がある。", []),
    ("umbrella", "雨を避ける道具の布が放射状の骨で支えられ、下へ柄が伸びる。", []),
    ("umbrella", "頭上で布のドームを開き、中央の柄を握って雨をよける。", []),
    ("bell", "金属の釣り下げた器の内側を打つと、響く音が出る。", []),
    ("bell", "下が開いた金属の器に、内側からぶら下がる打ち子が当たる。", []),
    ("lantern", "紙の覆いを骨組みで膨らませ、その内側の明かりを吊るす。", []),
    ("lantern", "祭りの軒先に吊るす灯りで、蛇腹状の紙が中の光を包む。", []),
    ("crown", "支配者が頭に載せる飾りで、帯の上にいくつもの尖りが並ぶ。", []),
    ("crown", "頭を囲む金属の帯に、上向きの先端と装飾石が付いている。", []),
    ("knot", "一本のひもを交差させ、端を穴に通して引き締めた部分。", []),
    ("knot", "ひも同士が絡み合い、引っ張るほど締まるまとまりになっている。", []),
    ("wave", "水面の山と谷が続いて、なだらかなうねりが横へ伝わる。", []),
    ("wave", "平らだった水面が上下を繰り返す輪郭となり、岸へ進んでくる。", []),
    ("ribbon", "贈り物の帯を左右の二つの輪に折り、中央を締めて端を垂らす。", ["knot"]),
    ("ribbon", "飾り用の帯を二つの耳に折り、中央を締めて箱の上に付ける。", ["knot"]),
]

NAMES = {
    "condense": "球体", "vortex": "渦", "orbit": "軌道", "mobius": "メビウスの輪", "ring": "円環",
    "cube": "立方体", "cuboid": "直方体", "cross": "十字", "triangle": "三角形", "square": "四角形",
    "fireworks": "花火", "dango": "団子", "flower": "花", "butterfly": "蝶", "jellyfish": "くらげ",
    "tree": "木", "star": "星", "helix": "螺旋", "hourglass": "砂時計", "saturn": "土星",
    "sword": "剣", "vase": "花瓶", "cone": "円錐", "cylinder": "円柱", "capsule": "カプセル",
    "pyramid": "ピラミッド", "diamond": "宝石", "octahedron": "八面体", "heart": "ハート", "egg": "卵",
    "droplet": "雫", "moon": "三日月", "cloud": "雲", "mushroom": "きのこ", "leaf": "葉",
    "apple": "りんご", "pear": "洋梨", "pumpkin": "かぼちゃ", "shell": "巻き貝", "fish": "魚",
    "bird": "鳥", "snake": "蛇", "turtle": "亀", "spider": "蜘蛛", "lotus": "蓮",
    "rose": "薔薇", "sun": "太陽", "snowflake": "雪の結晶", "gear": "歯車", "bolt": "稲妻",
    "bottle": "瓶", "cup": "カップ", "teapot": "ティーポット", "umbrella": "傘", "bell": "鐘",
    "lantern": "提灯", "crown": "王冠", "knot": "結び目", "wave": "波", "ribbon": "リボン",
}

NAMED_CONTEXTS = [
    "机の上に{}を置いた。", "昨日は{}を眺めていた。", "{}の絵をノートに描いた。",
    "窓の向こうに{}が見える。", "{}を思い浮かべながら休んでいる。", "この場面には{}が出てくる。",
]

HOLDS = [
    ("negation", "球体は出さないで。"),
    ("negation", "渦の形には変えない。"),
    ("negation", "メビウスの輪は今回は不要です。"),
    ("negation", "立方体を描くのはやめて。"),
    ("negation", "花火にするつもりはない。"),
    ("negation", "蝶の姿は選ばないで。"),
    ("negation", "くらげの形を使わないで。"),
    ("negation", "剣を表示しないでください。"),
    ("negation", "花瓶の姿にはしたくない。"),
    ("negation", "円錐には絶対にしないで。"),
    ("negation", "ハートは要りません。"),
    ("negation", "三日月の図は避けておく。"),
    ("negation", "りんごの形は除外してください。"),
    ("negation", "魚は登場させない。"),
    ("negation", "鳥の形にするのは無し。"),
    ("negation", "歯車は使うな。"),
    ("negation", "カップを出すのは取りやめた。"),
    ("negation", "傘の姿を作らないで。"),
    ("negation", "王冠もリボンも表示しないで。"),
    ("negation", "木や葉の形はどちらも禁止です。"),
    ("unrelated", "明日の予定を手帳に書き込んだ。"),
    ("unrelated", "この計算の答えをもう一度確かめたい。"),
    ("unrelated", "今日は休憩を少し多めに取る。"),
    ("unrelated", "通知の設定を後で確認する。"),
    ("unrelated", "必要なファイルを保存しておいた。"),
    ("unrelated", "先ほどの説明はよく理解できた。"),
    ("unrelated", "待ち合わせの時刻を変更した。"),
    ("unrelated", "席を離れる前に電源を確認する。"),
    ("unrelated", "議事録には決まった内容だけを書く。"),
    ("unrelated", "もう一度ゆっくり読み直してみよう。"),
    ("unrelated", "質問には順番に答えれば大丈夫。"),
    ("unrelated", "購入の手続きはまだ終わっていない。"),
    ("unrelated", "昨日より集中できている気がする。"),
    ("unrelated", "資料の更新は来週になりそうだ。"),
    ("unrelated", "机を片付けてから作業に戻る。"),
    ("unrelated", "約束を忘れないよう記録しておく。"),
    ("unrelated", "この件は担当者に相談してみる。"),
    ("unrelated", "返信を待っている間に次の準備をする。"),
    ("unrelated", "いつもより早く寝ることにした。"),
    ("unrelated", "結果の数値を表にまとめ直した。"),
]

# The dedicated modifier scenes are not extensions of description/name scenes.
# All three attribute labels are scored, including neutral/straight defaults.
MODIFIERS = [
    ("sword", "展示する剣は短くしておく。", "short", "neutral", "straight"),
    ("cylinder", "円柱は背を低くした形にする。", "short", "neutral", "straight"),
    ("snake", "短くて細い蛇が丸く曲がっている。", "short", "narrow", "curved"),
    ("ribbon", "短く、横幅の広いリボンを飾る。", "short", "wide", "straight"),
    ("capsule", "カプセルを縦に長く伸ばして描く。", "long", "neutral", "straight"),
    ("bottle", "丈の長い瓶を選んで置く。", "long", "neutral", "straight"),
    ("sword", "長く細い剣の刀身を弓なりに曲げる。", "long", "narrow", "curved"),
    ("leaf", "長く幅広い葉が反っている。", "long", "wide", "curved"),
    ("cup", "カップの横幅を狭くする。", "neutral", "narrow", "straight"),
    ("umbrella", "細身の傘を広げた。", "neutral", "narrow", "straight"),
    ("ribbon", "リボンは細くして、ゆるやかに曲げる。", "neutral", "narrow", "curved"),
    ("cylinder", "円柱を細く長く伸ばす。", "long", "narrow", "straight"),
    ("vase", "花瓶の幅を広げた姿にした。", "neutral", "wide", "straight"),
    ("cube", "立方体を横に太くふくらませる。", "neutral", "wide", "straight"),
    ("ribbon", "幅広いリボンを弓なりに曲げて見せる。", "neutral", "wide", "curved"),
    ("cylinder", "短くて幅の広い円柱が台座に載る。", "short", "wide", "straight"),
    ("sword", "剣の刀身を湾曲させた。", "neutral", "neutral", "curved"),
    ("snake", "蛇の胴は大きく曲げた姿にする。", "neutral", "neutral", "curved"),
    ("ribbon", "リボンがゆるやかにカーブしている。", "neutral", "neutral", "curved"),
    ("leaf", "葉の面を反り返らせた。", "neutral", "neutral", "curved"),
    ("snake", "蛇をまっすぐ伸ばして置く。", "neutral", "neutral", "straight"),
    ("sword", "剣は曲げずにまっすぐな刀身とする。", "neutral", "neutral", "straight"),
    ("ribbon", "リボンをまっすぐ、長めに垂らす。", "long", "neutral", "straight"),
    ("leaf", "葉はまっすぐなまま、幅を狭める。", "neutral", "narrow", "straight"),
]

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

def main():
    data_path = BASE / "frozen-cases.jsonl"
    if data_path.exists():
        raise SystemExit("Frozen cases already exist: refusing to replace any expectation.")
    rows = []
    for index, (shape, text, extra) in enumerate(DESCRIPTIONS, 1):
        rows.append({"id": f"description-{index:03}", "category": "description", "family": f"eval-description-{shape}-{1 + sum(x[0] == shape for x in DESCRIPTIONS[:index-1])}", "text": text,
                     "primaryShape": shape, "expected": {"acceptedShapes": [shape, *extra], **DEFAULT}, "labelSource": "AI-authored"})
    for index, (shape, name) in enumerate(NAMES.items(), 1):
        rows.append({"id": f"named-{index:03}", "category": "named", "family": f"eval-name-{shape}", "text": NAMED_CONTEXTS[(index-1) % len(NAMED_CONTEXTS)].format(name),
                     "primaryShape": shape, "expected": {"acceptedShapes": [shape], **DEFAULT}, "labelSource": "AI-authored"})
    for index, (kind, text) in enumerate(HOLDS, 1):
        rows.append({"id": f"hold-{index:03}", "category": "hold", "subcategory": kind, "family": f"eval-hold-{kind}-{index:03}", "text": text,
                     "primaryShape": "hold", "expected": {"acceptedShapes": ["hold"], **DEFAULT}, "labelSource": "AI-authored"})
    for index, (shape, text, length, width, bend) in enumerate(MODIFIERS, 1):
        rows.append({"id": f"modifier-{index:03}", "category": "modifier", "family": f"eval-modifier-{index:03}", "text": text,
                     "primaryShape": shape, "expected": {"acceptedShapes": [shape], "length": length, "width": width, "bend": bend}, "labelSource": "AI-authored"})
    assert len(NAMES) == 60 and len(DESCRIPTIONS) == 120 and len(HOLDS) == 40 and len(MODIFIERS) == 24
    assert Counter(row[0] for row in DESCRIPTIONS) == Counter({shape: 2 for shape in NAMES})
    assert len({row["text"] for row in rows}) == len(rows)
    assert len({row["family"] for row in rows}) == len(rows)
    assert all(set(row["expected"]["acceptedShapes"]) <= {*NAMES, "hold"} for row in rows)
    # Catalog display names of the target itself are absent from description text.
    assert all(NAMES[shape] not in text for shape, text, extra in DESCRIPTIONS)
    data_path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows))
    digest = hashlib.sha256(data_path.read_bytes()).hexdigest()
    manifest = {
        "schemaVersion": 1, "frozenAtUTC": datetime.now(timezone.utc).isoformat(), "expectationsFrozen": True,
        "provenance": "Independent AI-authored and AI-labelled artificial evaluation. No human evaluation. No training/dev data or model predictions were read during authoring.",
        "counts": dict(Counter(row["category"] for row in rows)), "total": len(rows), "shapeVocabularySize": 60,
        "descriptionCasesPerPrimaryShape": 2, "namedCasesPerShape": 1, "families": len(rows),
        "acceptance": "A prediction is shape-correct when it is a member of acceptedShapes. Single-output predictions only. Per-category and primary-shape macro results are reported.",
        "attributeContract": "length:short|neutral|long; width:narrow|neutral|wide; bend:straight|curved. Neutral/straight when unspecified. Identity-inherent geometry descriptions do not request additional deformation.",
        "modifierDistributions": {key: dict(Counter(row["expected"][key] for row in rows if row["category"] == "modifier")) for key in DEFAULT},
        "datasetFile": data_path.name, "sha256": digest,
        "freezePolicy": "Expectations cannot be changed after this manifest. An error found later must be described, not silently relabelled. Root receives counts/hash/schema only until its model/data/config are frozen. No candidate tuning from this evaluation.",
        "schema": {"id": "unique string", "category": "description|named|hold|modifier", "subcategory": "optional negation|unrelated", "family": "unique source family string", "text": "Japanese short sentence", "primaryShape": "60-shape catalog label|hold", "expected": {"acceptedShapes": "nonempty array of permissible catalog labels or hold", **{key: value for key,value in {"length":"short|neutral|long", "width":"narrow|neutral|wide", "bend":"straight|curved"}.items()}}, "labelSource": "AI-authored"},
    }
    dump(BASE / "frozen-manifest.json", manifest)
    print(json.dumps({"total": len(rows), "counts": manifest["counts"], "families": len(rows), "sha256": digest, "schema": manifest["schema"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
