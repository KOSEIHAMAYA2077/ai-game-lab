#!/usr/bin/env python3
"""Author-owned captions and calibration only. Never reads heldout fixtures."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
DESCRIPTIONS = {
 "condense": ("solid", "丸い球の表面。全ての方向に丸く、角や穴がない立体。", "転がせる丸い立体を見たい"),
 "vortex": ("spiral", "中心へ巻き込まれる渦。流れがぐるぐる回転する形。", "ぐるぐる巻き込む水流の形"),
 "orbit": ("space", "中心の球を取り囲む複数の軌道。惑星や電子が周回する形。", "核のまわりに周回する道筋"),
 "mobius": ("loop", "帯を半回転ひねって両端をつなげたメビウスの輪。裏表のない帯。", "一回ひねった帯の端をつなぐ"),
 "ring": ("loop", "中央に穴のある丸い円環。ドーナツのような太い輪。", "穴があいた丸い輪っかにしたい"),
 "cube": ("solid", "六つの正方形の面からなる立方体。縦横高さが同じサイコロの形。", "縦横と奥行きが等しい六面の固まり"),
 "cuboid": ("solid", "六つの長方形の面からなる直方体。横へ長い四角い箱の立体。", "横長の四角いブロック"),
 "cross": ("diagram", "縦の棒と横の棒が直角に交わる十字。プラス記号の平面形。", "縦横の線を交差させたプラスの図"),
 "triangle": ("diagram", "三本の辺と三つの角を持つ三角形の平面。", "頂点が三個の平たい図形"),
 "square": ("diagram", "四本の辺と四つの角を持つ正方形の平面。", "同じ長さの辺四本で囲んだ平面"),
 "fireworks": ("space", "中心から放射状に広がる花火。夜空に開く光の球。", "打ち上げた火薬が放射状にはじける"),
 "dango": ("food", "小さな丸い団子が三つ串に並ぶ形。", "串に丸いお菓子を三個刺す"),
 "flower": ("plant", "中心のまわりに花びらが広がる花。茎の先に咲く形。", "花弁が中心のまわりに開く"),
 "butterfly": ("animal", "細い胴体の左右に大きな二対の翅がある蝶。", "左右の大きな翅でひらひら飛ぶ虫"),
 "jellyfish": ("animal", "半透明の丸い傘から長い触手が垂れる海のくらげ。", "水中に浮く傘と長い触手"),
 "tree": ("plant", "一本の幹から枝と葉が広がる樹木。", "太い幹から枝が伸びる植物"),
 "star": ("diagram", "五つのとがった先端が放射状に伸びる星型の平面。", "五つの先が尖った記号"),
 "helix": ("spiral", "上下へ伸びる螺旋。ばねのように同じ半径でぐるぐる巻く形。", "ばねのような巻き上がる曲線"),
 "hourglass": ("tool", "上下二つの膨らんだ容器が細いくびれでつながる砂時計。", "上下の容器の細い首を砂が通る時計"),
 "saturn": ("space", "丸い惑星を平たい環が取り囲む土星。", "惑星のまわりに平たい環がある"),
 "sword": ("tool", "柄と鍔から長い平たい刃が伸びる剣。", "握る柄から鋭い長い刃が伸びる武器"),
 "vase": ("container", "ふくらんだ胴と細い首、開いた口を持つ花瓶。花を生ける器。", "花を生ける口の細い器"),
 "cone": ("solid", "丸い底面から一つの頂点へ細くなる円錐。", "円い底から頂点に向かって細くなる"),
 "cylinder": ("solid", "上下の丸い平面をまっすぐな側面がつなぐ円柱。", "上下が円いまっすぐな柱"),
 "capsule": ("solid", "筒の両端が丸い半球になったカプセル。", "両端が丸く閉じた短い筒"),
 "pyramid": ("solid", "四角い底面から一つの頂点へ細くなるピラミッド。", "四角い底から尖った頂点へ伸びる"),
 "diamond": ("solid", "多くの平らな面が光を反射するカットされた宝石。", "光を反射するカット済みの宝石"),
 "octahedron": ("solid", "八つの三角形の面を持つ八面体。二つの四角錐を底面でつないだ立体。", "八枚の三角面で閉じた立体"),
 "heart": ("diagram", "上に二つの丸い膨らみ、下に尖った先を持つハート。愛を表す形。", "愛情を表す左右対称のマーク"),
 "egg": ("food", "片側が細くもう片側が丸い卵の立体。鳥のたまごの形。", "片方が少し細い鳥の卵の形"),
 "droplet": ("nature", "下が丸く上が尖った水滴。落ちる雫や涙の形。", "先が尖った一滴の水"),
 "moon": ("space", "丸い月の一部が欠けた三日月。細く弧を描く夜空の形。", "細く欠けた夜空の月"),
 "cloud": ("nature", "丸い膨らみが重なった柔らかい雲。空に浮く白い塊。", "空に浮かぶふわふわした白い塊"),
 "mushroom": ("plant", "細い柄の上に丸い傘が広がるきのこ。", "細い柄に丸い傘が載る菌類"),
 "leaf": ("plant", "薄く平たい木の葉。中央の葉脈から左右へ広がり先端が尖る。", "中央に葉脈がある薄い植物の部分"),
 "apple": ("food", "丸い赤いりんご。上に小さなくぼみと短い軸がある果物。", "上に軸がある赤く丸い果物"),
 "pear": ("food", "下側が大きく膨らみ上側が細い洋梨。", "下が膨らみ上が細くなる洋梨の果実"),
 "pumpkin": ("food", "縦の筋がある丸く扁平なかぼちゃ。上に太いへたがある。", "縦の筋がある大きな秋の野菜"),
 "shell": ("animal", "螺旋状に巻いた貝殻。巻き貝の硬い殻。", "ぐるぐる巻かれた海の貝殻"),
 "fish": ("animal", "流線型の胴と尾びれを持つ魚。水中を泳ぐ動物。", "尾びれを振って水中を泳ぐ動物"),
 "bird": ("animal", "胴体から翼とくちばしが伸びる鳥。空を飛ぶ動物。", "くちばしと翼を持つ空の動物"),
 "snake": ("animal", "脚のない長い胴体が曲がりくねる蛇。", "足のない長い胴体がくねくね動く"),
 "turtle": ("animal", "丸い硬い甲羅から頭と四本の足が出る亀。", "硬い甲羅を背負い四本足で歩く動物"),
 "spider": ("animal", "小さい胴体から八本の長い脚が伸びる蜘蛛。", "八本の脚を持つ巣を張る生き物"),
 "lotus": ("plant", "水面に咲く蓮。大きな花びらが幾重にも重なった花。", "池の水面に大きく咲く蓮の花"),
 "rose": ("plant", "花びらが渦状に重なる薔薇。とげのある茎に咲く花。", "渦巻く花弁と棘のある花"),
 "sun": ("space", "丸い中心から光線が放射状に伸びる太陽。", "空で明るく光を放つ恒星"),
 "snowflake": ("diagram", "六方向へ枝が伸びる雪の結晶。六角対称の細かい形。", "六方向に枝分かれする氷の結晶"),
 "gear": ("tool", "丸い外周に規則的な歯が並ぶ歯車。機械を回す輪。", "外周に歯が並ぶ回転する機械部品"),
 "bolt": ("diagram", "鋭く折れ曲がった稲妻。雷を表すジグザグの形。", "空を光る鋭いジグザグ"),
 "bottle": ("container", "細い首と丸い口を持つ飲み物の瓶。胴体に液体を入れる。", "飲料を保存する首の細い容器"),
 "cup": ("container", "上の口が大きく開いたコップ。横に取っ手のある飲み物のカップ。", "取っ手で持つ飲み物の器"),
 "teapot": ("container", "丸い胴に注ぎ口と取っ手と蓋があるティーポット。茶を注ぐ急須。", "注ぎ口からお茶を出す蓋付きの器"),
 "umbrella": ("tool", "長い柄の上に大きな傘が開く雨具。雨を避ける形。", "雨を避けるため上に開く道具"),
 "bell": ("tool", "下側が広く開いた鐘。内側の舌を打って音を鳴らす金属の形。", "金属の中を打って音を鳴らす道具"),
 "lantern": ("tool", "丸い紙の胴体を持つ提灯。内側の明かりで周囲を照らす。", "内側の明かりで紙が光る灯り"),
 "crown": ("tool", "丸い輪の上に尖った飾りが並ぶ王冠。王が頭にかぶる。", "王様が頭にかぶる尖った飾り"),
 "knot": ("loop", "紐が絡み合ってつながる結び目。交差した輪を作る形。", "ひもを絡めて結んだ交差する輪"),
 "wave": ("nature", "上下に起伏する波。水面がなめらかにうねる形。", "水面が上下に滑らかにうねる"),
 "ribbon": ("loop", "平たい細い帯を左右の輪に結んだリボン。蝶結びの飾り。", "平たい帯を左右の輪に結ぶ飾り"),
}
BASE_ALIASES = {
 "condense": ["球体", "球", "ボール", "かたまり", "sphere", "ball"], "vortex": ["渦", "うず", "vortex"],
 "orbit": ["軌道", "原子", "orbit"], "mobius": ["メビウスの輪", "メビウス", "mobius"],
 "ring": ["円環", "輪っか", "ドーナツ", "ring", "torus"], "cube": ["立方体", "キューブ", "サイコロ", "cube"],
 "cuboid": ["直方体", "cuboid"], "cross": ["十字", "cross"], "triangle": ["三角形", "三角", "triangle"],
 "square": ["四角形", "四角", "正方形", "square"], "fireworks": ["花火", "はなび", "fireworks"],
 "dango": ["団子", "だんご", "dango"], "flower": ["花", "花びら", "flower"], "butterfly": ["蝶", "ちょうちょ", "butterfly"],
 "jellyfish": ["くらげ", "クラゲ", "jellyfish"], "tree": ["木", "樹木", "大樹", "tree"], "star": ["星", "星型", "star"],
 "helix": ["螺旋", "らせん", "スプリング", "コイル", "helix"], "hourglass": ["砂時計", "hourglass"],
 "saturn": ["土星", "saturn"], "sword": ["剣", "つるぎ", "ソード", "sword", "blade"], "vase": ["花瓶", "かびん", "壺", "vase"],
}
PRIMITIVES = {
 "sphere": ("球体", ["球体", "球", "玉", "ボール", "sphere", "ball", "orb"], "角も穴もない丸い球の立体。", "角のない丸い塊"),
 "box": ("箱", ["立方体", "直方体", "箱", "四角い", "box", "cube", "cuboid", "block"], "平らな六つの面と直角の角を持つ四角い箱。", "六つの平面に囲まれた直角の固まり"),
 "tube": ("棒", ["棒", "管", "筒", "円柱", "tube", "rod", "pipe", "cylinder", "stick"], "丸い断面が細長く伸びた棒や筒。", "丸い断面がまっすぐ長く続く部品"),
 "blade": ("刃", ["剣", "刃", "刀", "ソード", "sword", "blade", "saber"], "長く平たい鋭い刃。物を切る刀や剣。", "物を切れる平たく鋭い長い部品"),
 "ring": ("輪", ["輪", "輪っか", "円環", "ドーナツ", "ring", "torus", "hoop", "loop"], "中心に穴のあいた丸い輪。", "中央に穴のあいた丸い部品"),
 "vase": ("花瓶", ["花瓶", "花入れ", "一輪挿し", "壺", "vase", "urn"], "ふくらんだ胴と細い首から花を生ける器。", "細い口に花を差して飾る容器"),
}

def immutable(path, obj):
    data = (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode()
    if path.exists():
        if path.read_bytes() != data:
            raise RuntimeError("existing corpus differs")
    else:
        with path.open("xb") as stream:
            stream.write(data)

def main():
    catalog = ROOT / "prototypes/glyph-creature/src/shape-catalog.ts"
    language = ROOT / "prototypes/glyph-creature/src/language.ts"
    source = catalog.read_text()
    aliases = {}
    for label, values in re.findall(r"(\w+): \[([^\]]+)\]", source.split("EXPANDED_ALIASES:", 1)[1]):
        aliases[label] = re.findall(r"'([^']+)'", values)
    aliases.update(BASE_ALIASES)
    names = dict(re.findall(r"(\w+): '([^']+)'", source.split("EXPANDED_NAMES:", 1)[1].split("};", 1)[0]))
    names.update(dict(re.findall(r"(\w+): '([^']+)'", language.read_text().split("SHAPE_NAMES:", 1)[1].split("};", 1)[0])))
    inventory, rows = [], []
    for label, (family, desc, calibration) in DESCRIPTIONS.items():
        terms = list(dict.fromkeys([names[label]] + aliases[label]))
        inventory.append({"registry": "shape", "label": label, "name": names[label], "family": family,
                          "aliases": terms, "captions": [desc] + terms})
        rows.append({"id": "cal-shape-" + label, "registry": "shape", "text": calibration, "target": label, "category": "paraphrase"})
    for label, (name, terms, desc, calibration) in PRIMITIVES.items():
        inventory.append({"registry": "primitive", "label": label, "name": name, "family": label, "aliases": terms, "captions": [desc] + terms})
        rows.append({"id": "cal-primitive-" + label, "registry": "primitive", "text": calibration, "target": label, "category": "paraphrase"})
    for i, text in enumerate(["明日は早起きして学校に行く", "パスワードを変更した", "抽象的な幸福を表したい", "今日はとても疲れた", "夕食の献立を考える", "計算の速度を改善する", "電話番号を教えて", "青い色に変えたい", "ただゆっくり動いてほしい", "このまま表示を維持する", "ドラゴンを作る", "自動車に変える", "人間の顔を作って", "城を表示する", "椅子に変える", "ピアノを見たい", "未来の都市にする", "宇宙船を作って"]):
        rows.append({"id": "cal-unknown-%02d" % i, "registry": "shape", "text": text, "target": None, "category": "unknown"})
    for i, text in enumerate(["球体にはしない", "箱を作らないで", "魚ではない", "鳥は不要", "葉を使わずに", "花瓶じゃない形", "傘を除いた形", "輪はやめて", "not a cube", "without a sword", "do not make a flower", "never create a star"]):
        rows.append({"id": "cal-negation-%02d" % i, "registry": "shape", "text": text, "target": None, "category": "negation"})
    for i, text in enumerate(["球と箱を並べる", "鳥と魚を組み合わせる", "剣の先に花瓶", "傘の上にりんご", "月と太陽", "猫", "新しい形", "" ]):
        rows.append({"id": "cal-scope-%02d" % i, "registry": "shape", "text": text, "target": None, "category": "out_of_scope"})
    for i, text in enumerate(["今日は暇だ", "車を作って", "猫を作る", "球ではない", "棒と箱を組み合わせる", "赤くして", "", "a computer"]):
        rows.append({"id": "cal-primitive-unknown-%02d" % i, "registry": "primitive", "text": text, "target": None, "category": "unknown"})
    immutable(OUT / "captions.json", {"version": 1, "authorship": "Authored descriptions; names/aliases from current repository; no heldout input read", "entries": inventory,
                                      "sourceHashes": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [catalog, language]}})
    immutable(OUT / "calibration.json", {"version": 1, "purpose": "Calibration only, authored before first retrieval run. Not an independent test.", "rows": rows})
    print(json.dumps({"shapeCount": sum(x["registry"] == "shape" for x in inventory), "primitiveCount": 6, "calibrationRows": len(rows)}))

if __name__ == "__main__":
    main()
