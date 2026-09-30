#!/usr/bin/env python3
"""Build a bounded, reproducible WordNet alias table. Standard library only.

python3 tools/build-konjo-lexicon.py --download   # fixed HTTPS data + verified hashes
python3 tools/build-konjo-lexicon.py              # offline rebuild from .local cache
python3 tools/build-konjo-lexicon.py --check      # compare generated outputs, no writes
No downloaded code runs. Only dict/data.noun is read from the verified archive.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
from pathlib import Path
import tarfile
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.local' / 'konjo-lexicon'
COMMIT = '406bf83b3c507a3d1f26e88252d5d66893fd36bf'
PREFIX = f'https://raw.githubusercontent.com/omwn/omw-data/{COMMIT}/wns/jpn/'
SOURCES = {
    'wn-data-jpn.tab': (PREFIX + 'wn-data-jpn.tab', 'f47fefb11824b86d8556c632f5b71438397abac79677b607070cd0bdcb9ac212'),
    'LICENSE': (PREFIX + 'LICENSE', 'a4be32a83ad0a1cff9a31c23aaa107be20eb843d97c68a2ff72e10ff5ac17cee'),
    'citation.bib': (PREFIX + 'citation.bib', 'd0cf759ad97ad6c12902603b3addf2614888cb6ddce36a07f3c257e71777caf9'),
    'WNdb-3.0.tar.gz': ('https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz', '658b1ba191f5f98c2e9bae3e25c186013158f30ef779f191d2a44e5d25046dc8'),
    'princeton-LICENSE': ('https://wordnetcode.princeton.edu/3.0/LICENSE', '7731175a77952e259390b496fab905e57118b8d19ad3a8383c67eee724ff443f'),
}
MAX_DOWNLOAD = 40 * 1024 * 1024

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def read_source(name: str, download: bool) -> bytes:
    path = CACHE / name
    url, expected = SOURCES[name]
    if not path.exists():
        if not download:
            raise SystemExit(f'Missing local input {name}; use --download once.')
        request = urllib.request.Request(url, headers={'User-Agent': 'glyph-konjo-lexicon/1'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(MAX_DOWNLOAD + 1)
        if len(data) > MAX_DOWNLOAD:
            raise SystemExit(f'{name}: download exceeded 40 MiB bound')
        if sha(data) != expected:
            raise SystemExit(f'{name}: SHA-256 mismatch; nothing was executed or accepted')
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    data = path.read_bytes()
    if sha(data) != expected:
        raise SystemExit(f'{name}: cached SHA-256 mismatch; preserve cache and investigate')
    return data

def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def build(download: bool) -> dict[Path, bytes]:
    raw = {name: read_source(name, download) for name in SOURCES}
    manifest_path = ROOT / 'experiments/konjo-v1/lexicon/seeds.json'
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    seeds = manifest['seeds']
    selected = {seed['synset'] for seed in seeds}
    if any(not key.endswith('-n') for key in selected):
        raise SystemExit('Only noun synsets are allowed')
    japanese: dict[str, list[str]] = {}
    for line in raw['wn-data-jpn.tab'].decode('utf-8').splitlines():
        parts = line.split('\t')
        if len(parts) >= 3 and parts[0] in selected and parts[1] == 'jpn:lemma':
            japanese.setdefault(parts[0], []).append(parts[2])
    # Exact member access avoids path traversal, symlinks and archive code execution.
    with tarfile.open(fileobj=io.BytesIO(raw['WNdb-3.0.tar.gz']), mode='r:gz') as archive:
        member = archive.getmember('dict/data.noun')
        if not member.isfile() or member.size > 20 * 1024 * 1024:
            raise SystemExit('Unexpected noun member type or size')
        noun_bytes = archive.extractfile(member).read()
    english = {}
    for line in noun_bytes.decode('ascii').splitlines():
        if not line[:1].isdigit():
            continue
        data, definition = line.split('|', 1)
        fields = data.split()
        key = fields[0] + '-n'
        if key in selected:
            count = int(fields[3], 16)
            english[key] = {'lemmas': fields[4:4 + count * 2:2], 'definition': definition.strip()}
    entries, omitted = [], []
    seen = set()
    for seed in seeds:
        key, shape = seed['synset'], seed['shape']
        if key not in english or english[key]['lemmas'] != seed['englishLemmas'] or english[key]['definition'] != seed['definition']:
            raise SystemExit(f'{key}: curated sense differs from pinned Princeton data')
        exclusions = manifest['exclusionsByShape'].get(shape, {})
        terms = [(value, 'jpn') for value in japanese.get(key, [])]
        terms += [(value, 'eng') for value in english[key]['lemmas']]
        for original, language in terms:
            term = unicodedata.normalize('NFC', original)
            if language == 'eng':
                term = term.replace('_', ' ').lower()
            if term in exclusions:
                omitted.append({'term': term, 'shape': shape, 'synset': key, 'reason': exclusions[term]})
                continue
            if not term.strip() or len(term) > 80 or any(unicodedata.category(char).startswith('C') for char in term):
                raise SystemExit(f'{key}: unexpected term content')
            identity = (term, shape, key)
            if identity in seen:
                continue
            seen.add(identity)
            entries.append({'term': term, 'shapes': [shape], 'relation': 'synonym', 'concept': 'wn30:' + key})
    entries.sort(key=lambda entry: (entry['term'], entry['shapes'][0], entry['concept']))
    source = {
        'name': 'Curated noun-synset subset of Japanese WordNet via OMW and Princeton WordNet 3.0',
        'omwRepository': 'https://github.com/omwn/omw-data',
        'omwCommit': COMMIT,
        'japaneseWordNet': 'https://bond-lab.github.io/wnja/',
        'princetonWordNet': 'https://wordnet.princeton.edu/',
        'files': [{'name': name, 'url': url, 'sha256': digest} for name, (url, digest) in SOURCES.items()],
        'seedManifestSha256': sha(manifest_bytes),
        'nounDataSha256': sha(noun_bytes),
        'relationPolicy': 'Same manually selected noun synset only. No hypernym or learned association expansion.',
        'normalization': 'NFC; English underscores become spaces and English is lowercased. No kana conversion or fuzzy expansion.',
        'languages': ['jpn', 'eng'],
        'licenses': ['licenses/wordnet-japanese-LICENSE.txt', 'licenses/wordnet-princeton-LICENSE.txt', 'licenses/wordnet-NOTICE.md'],
        'buildScript': 'tools/build-konjo-lexicon.py',
    }
    payload = json_bytes({'entries': entries, 'source': source})
    if len(payload) > 300_000 or not 100 <= len(entries) <= 1000:
        raise SystemExit(f'Unexpected output size: {len(payload)} bytes / {len(entries)} rows')
    summary = {'entries': len(entries), 'distinctTerms': len({e['term'] for e in entries}),
        'shapes': sorted({e['shapes'][0] for e in entries}), 'synsets': len(selected),
        'bytes': len(payload), 'sha256': sha(payload), 'omitted': omitted,
        'entryCountsByShape': {shape: sum(shape in e['shapes'] for e in entries) for shape in sorted({e['shapes'][0] for e in entries})}}
    output = ROOT / 'prototypes/glyph-creature'
    return {
        output / 'src/data/konjo-wordnet.json': payload,
        output / 'public/licenses/wordnet-japanese-LICENSE.txt': raw['LICENSE'],
        output / 'public/licenses/wordnet-princeton-LICENSE.txt': raw['princeton-LICENSE'],
        output / 'public/licenses/wordnet-japanese-citation.bib': raw['citation.bib'],
        ROOT / 'experiments/konjo-v1/lexicon/build-report.json': json_bytes(summary),
    }

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = build(args.download)
    for path, data in outputs.items():
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                raise SystemExit('Output differs: ' + str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    report = json.loads(outputs[ROOT / 'experiments/konjo-v1/lexicon/build-report.json'])
    print(f"{'Verified' if args.check else 'Built'} {report['entries']} rows / {report['distinctTerms']} terms / {len(report['shapes'])} shapes / {report['bytes']} bytes")

if __name__ == '__main__':
    main()
