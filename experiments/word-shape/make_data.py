"""Author-controlled synthetic examples. Never reads the independent holdout."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# These are authored teaching examples, not claims of geometry inferred from images.
WORDS = {
    'condense': ['球', '球体', '丸い塊', 'ボール', 'ビー玉', 'まんまる', '丸い玉', '球状', 'sphere', 'ball'],
    'vortex': ['渦', 'うずまき', '渦巻き', 'らせん', '螺旋', '竜巻', 'ぐるぐる', '渦潮', 'vortex', 'spiral'],
    'orbit': ['原子軌道', '電子軌道', '原子', '電子の周回', '惑星の軌道', '交差する軌道', '原子模型', '周回軌道', 'atom', 'orbit'],
    'mobius': ['メビウスの輪', 'メビウス', 'メビュウス', '半回転ねじった帯', 'ひねった輪', '裏表のない帯', '一回ねじれた帯', 'ねじれたリボンの輪', 'mobius', 'möbius strip'],
    'ring': ['円環', '輪っか', 'ドーナツ', '浮き輪', '指輪', '輪', 'リング', 'フープ', 'ring', 'circle'],
    'cube': ['立方体', 'サイコロ', 'さいころ', 'キューブ', '正六面体', '四角い箱', '箱', '角砂糖', 'cube', 'dice'],
    'cuboid': ['直方体', '長方体', '長い箱', '細長い箱', 'レンガ', '煉瓦', '横長の箱', '直角のブロック', 'cuboid', 'rectangular box'],
    'cross': ['十字', '十字架', 'プラス記号', 'プラスマーク', '十字形', '十字型', 'たてよこ交差', '縦横の交差', 'cross', 'plus sign'],
    'triangle': ['三角形', '三角', '三角型', '三角の板', '三辺の形', '三つの辺', 'さんかく', '三角マーク', 'triangle', 'triangular'],
    'square': ['四角形', '正方形', '四角', '四角い板', '四辺の形', '四つの辺', 'しかく', '正方形の枠', 'square', 'square outline'],
}
TRAIN_TEMPLATES = ['{}', '{}にして', '{}を作って', '文字で{}を描いて', '赤い{}', '表面 黄色 {}', '流れる {}', '{} 8個', '形は{}で', '{}を浮かべる', '{}の輪郭', '全体を{}の姿に変形', '{}っぽくしてほしい', '{}が見たい', '{}の表面に文字が循環する', '黄色い{}の外側', '{}として並べて', '今の文字を{}へ', '小さい{}', '{}を立体にする']
VALID_TEMPLATES = ['{}のかたちへ変えてください', '青で{}を表してください']
NEGATIVE_TEMPLATES = ['昨日{}の写真を見た', '{}について勉強したい', '{}にしないで', '{}の話をしよう', '今日は{}を買った', '{}はいらない', '{}には変えない', '{}は作らないで', '{}を作るのはやめて', '{}の名前を覚えた', '{}の画像を見せてもらった', '{}のようにはしない', '{}のままにしない', '{}を作ってほしくない', '{}という文字を読んだ', '{}を見たことがある']
VALID_NEGATIVE_TEMPLATES = ['今日は{}を眺めて帰った', '{}を描く必要はありません']
PLAIN_TRAIN = ['今日は眠い', 'ありがとう', 'こんにちは', 'おやすみ', '何だろう', 'お腹がすいた', 'いつか旅行したい', '音楽を聞いている', '文字を食べて', 'あいうえお', 'hello world', '今日もいい天気', 'まだ何も決まらない', 'これは普通の文章です', '青い空を見上げた', '家に帰ります', '赤い花が咲いた', '散歩に出た', '黄色い鳥が飛んだ', '水色が好きです']
PLAIN_VALID = ['もう寝る時間だ', '明日は晴れるかな', '文字をいくつか置いておく', '色々考えていたところです', '好きな曲を聴きながら', 'ありがとう、またね']
UNKNOWN_TRAIN = ['犬', '猫', '人間', '城', '飛行機', '自動車', 'ケーキ', '椅子', '恐竜', '木', '鳥', '時計', '花', '魚', 'だんご', '団子']
UNKNOWN_VALID = ['自転車', '宇宙船', '楽器', '山脈', 'おにぎり', '家族']

def build():
    train, validation = [], []
    def add(rows, text, label, family):
        rows.append({'text': text, 'label': label, 'family': family, 'source': 'authored-synthetic-v1'})
    for label, words in WORDS.items():
        for word in words:
            for template in TRAIN_TEMPLATES: add(train, template.format(word), label, 'train-command')
            for template in VALID_TEMPLATES: add(validation, template.format(word), label, 'heldout-template')
            for template in NEGATIVE_TEMPLATES: add(train, template.format(word), 'none', 'train-prose-negation')
            for template in VALID_NEGATIVE_TEMPLATES: add(validation, template.format(word), 'none', 'heldout-prose-template')
    for text in PLAIN_TRAIN: add(train, text, 'none', 'plain')
    for text in PLAIN_VALID: add(validation, text, 'none', 'heldout-plain')
    for word in UNKNOWN_TRAIN:
        for template in TRAIN_TEMPLATES[:4]: add(train, template.format(word), 'none', 'unsupported')
    for word in UNKNOWN_VALID:
        for template in VALID_TEMPLATES: add(validation, template.format(word), 'none', 'heldout-unsupported')
    for name, rows in [('train',train),('validation',validation)]:
        texts=[r['text'] for r in rows]; assert len(texts)==len(set(texts))
        (ROOT/'data'/f'{name}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows),encoding='utf-8')
    assert not set(r['text'] for r in train)&set(r['text'] for r in validation)
    print({'train':len(train),'validation':len(validation)})
if __name__ == '__main__': build()
