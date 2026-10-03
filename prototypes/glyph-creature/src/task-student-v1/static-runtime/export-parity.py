#!/usr/bin/env python3
"""Public artificial implementation fixtures only; no semantic holdout is read."""
import hashlib
import json
from pathlib import Path
import time

import numpy as np
from tokenizers import Tokenizer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
ASSETS = ROOT / 'experiments/bonsai-task-student-v1/static-candidate/assets'

def main():
    fixtures = [
        ('sphere', '球体'),
        ('train-cube-geometry', '六つの面がどれも同じ大きさの正方形になった立体。'),
        ('train-vase-use', '水を入れて切り花の茎を挿し、室内に飾る器。'),
        ('japanese-attrs', '赤い長い細い棒が曲がっている'),
        ('japanese-combination', '机の上に花瓶と紙を置いた。'),
        ('ascii', 'A cube and a sphere'),
        ('fullwidth', 'ＡＢＣ１２３　ｶﾞﾗｽ'),
        ('combining', 'は\u3099な cafe\u0301'),
        ('greek-scalar-lower', 'ΟΣ ΟΣΑ ΣΟΣ'),
        ('unicode-case-expansion', 'İ ẞ ﬃ'),
        ('emoji-unknown', '🫠🧬🫠'),
        ('unknown-merge', 'A🧬🧬B'),
        ('empty', ''),
        ('spaces', '  '),
        ('newline', '球\n箱\t花'),
        ('specials', '<s>球</s><pad><unk>'),
        ('mask-lstrip', 'A \t\u3000<mask> B'),
        ('mask-zero-width', 'A\u200b<mask>B'),
        ('unused', '[unused0] [unused65] [unused66]'),
        ('uppercase-special', '<MASK> <S>'),
        ('adjacent-specials', '<mask><mask>'),
        ('specials-no-boundary', 'a<s>b</s>c'),
        ('512-ascii', 'A' * 512),
        ('512-japanese', 'あ' * 512),
        ('512-astral', '🧬' * 512),
        ('513-ascii', 'A' * 513),
        ('513-astral', '🧬' * 513),
        ('unpaired-surrogate', '\ud800'),
    ]
    controls = list(range(0, 33)) + [0x7f, 0x85, 0x8f, 0x9f, 0xa0, 0x1680, *range(0x2000, 0x2010), 0x2028, 0x2029, 0x202f, 0x205f, 0x2581, 0xfeff, 0xfffd]
    fixtures += [(f'nmt-{value:04x}', 'A' + chr(value) + 'B') for value in controls]
    tok_path = ASSETS / 'tokenizer.json'
    table_path = ASSETS / 'table-128-float16.bin'
    assert hashlib.sha256(tok_path.read_bytes()).hexdigest() == '833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9'
    assert hashlib.sha256(table_path.read_bytes()).hexdigest() == '65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201'
    tokenizer = Tokenizer.from_file(str(tok_path))
    tokenizer.no_padding()
    tokenizer.no_truncation()
    table = np.fromfile(table_path, dtype='<f2').reshape(32768, 128)
    rows = []
    for identifier, text in fixtures:
        before = time.perf_counter()
        boundary = 'input_limit' if len(text) > 512 else 'invalid_unicode' if any(0xd800 <= ord(c) <= 0xdfff for c in text) else None
        if boundary:
            row = dict(id=identifier, text=text, ids=None, pieces=None, normalization=None, mean=None, vector=None, unknownFraction=0, hold=boundary)
        else:
            encoded = tokenizer.encode(text, add_special_tokens=False)
            ids = encoded.ids
            mean = np.zeros(128, dtype=np.float32)
            for start in range(0, len(ids), 64):
                mean += table[ids[start:start + 64]].astype(np.float32).sum(axis=0, dtype=np.float32)
            if ids:
                mean /= np.float32(len(ids))
            unknown = ids.count(3) / len(ids) if ids else 0
            norm = np.float32(np.linalg.norm(mean))
            hold = 'empty_vector' if norm <= 1e-12 else 'unknown_tokens' if unknown > .8 else None
            vector = None if hold else (mean / norm).tolist()
            row = dict(id=identifier, text=text, ids=ids, pieces=encoded.tokens, normalization=tokenizer.normalizer.normalize_str(text), mean=mean.tolist(), vector=vector, unknownFraction=unknown, hold=hold)
        row['pythonEncodeMs'] = (time.perf_counter() - before) * 1000
        rows.append(row)
    report = dict(kind='public-artificial-implementation-parity', semanticQualityEvaluation=False, tokenizer='tokenizers 0.22.1', numeric='numpy float16 to float32, 64-token sums, L2 norm', fixtures=rows)
    (HERE / 'parity-oracle.json').write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n')
    print(json.dumps({'fixtures': len(rows), 'output': str(HERE / 'parity-oracle.json')}))

if __name__ == '__main__':
    main()
