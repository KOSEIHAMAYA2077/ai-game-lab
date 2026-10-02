"""Artificial metamorphic cases for all supported ink names and 3 relations."""
VARIANTS = ["白", "白色", "白い", "赤", "赤色", "赤い", "黄", "黄色", "黄色い", "青", "青色", "青い", "緑", "緑色", "緑の", "紫", "紫色", "紫の", "水色", "水色の", "シアン", "桃色", "ピンク", "white", "red", "yellow", "blue", "green", "purple", "cyan", "pink"]
TEMPLATES = [
    {"name":"jp-end","relation":"end","primitives":["tube","sphere"],"base":"細長い棒の先に大きな球","jp":"{color}細長い棒の先に{color}大きな球"},
    {"name":"jp-above","relation":"above","primitives":["box","sphere"],"base":"小さな箱の上に大きな球","jp":"{color}小さな箱の上に{color}大きな球"},
    {"name":"jp-through","relation":"through","primitives":["box","ring"],"base":"小さな箱を大きな細い輪が貫く","jp":"{color}小さな箱を{color}大きな細い輪が貫く"},
    {"name":"en-end","relation":"end","primitives":["tube","sphere"],"base":"a large sphere at the end of a slender tube","en":"a {color}large sphere at the end of a {color}slender tube"},
    {"name":"en-above","relation":"above","primitives":["box","sphere"],"base":"a large sphere above a small box","en":"a {color}large sphere above a {color}small box"},
    {"name":"en-through","relation":"through","primitives":["box","ring"],"base":"a slender ring through a small box","en":"a {color}slender ring through a {color}small box"},
]


def cases():
    rows = []
    for template in TEMPLATES:
        for variant in VARIANTS:
            if "jp" in template:
                prefix = variant+(' ' if variant.isascii() else '' if variant.endswith(('い','の')) else 'の')
                text = template['jp'].format(color=prefix)
            else:
                text = template['en'].format(color=variant+' ')
            rows.append({"template":template["name"],"relation":template["relation"],"primitives":template["primitives"],"base":template["base"],"variant":variant,"text":text})
    return rows
