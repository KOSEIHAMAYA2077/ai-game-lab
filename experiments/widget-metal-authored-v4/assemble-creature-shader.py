"""Verify fragment equality; optional assembly writes only a fresh output file."""
from pathlib import Path
import argparse
import hashlib
import json

parser = argparse.ArgumentParser()
parser.add_argument('--output', help='Fresh output shader file; existing files refused')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
source = root / 'desktop/glyph-metal-lab-v4/Sources'
shader = (source / 'Glyphs.metal').read_text()
fragment = (source / 'CreatureGeometry.metal.inc').read_text()
start = shader.index('// Direct authored rest surfaces')
end = shader.index('struct Raster {', start)
assembled = shader[:start] + fragment + '\n' + shader[end:]
if args.output:
    with Path(args.output).open('x') as destination:
        destination.write(assembled)
if assembled != shader:
    raise SystemExit('Fragment differs from bundled shader; make a new candidate first.')
print(json.dumps({'fragment_matches': True, 'shader_sha256': hashlib.sha256(shader.encode()).hexdigest(), 'source_mutated': False}))
