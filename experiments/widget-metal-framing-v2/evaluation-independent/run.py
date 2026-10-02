#!/usr/bin/env python3
"""Build/run only frozen independent CPU comparisons; never launches an app."""
import argparse
import pathlib
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('round', choices=['r1', 'r2'])
parser.add_argument('output', help='A new absolute result directory')
args = parser.parse_args()
base = pathlib.Path(__file__).resolve().parent
out = pathlib.Path(args.output)
if not out.is_absolute() or out.exists():
    parser.error('Output must be absolute and must not exist')
build = base / '.build' / ('replay-' + args.round)
if build.exists():
    parser.error('Replay build directory exists; preserve it or choose a fresh copy of this experiment')
build.mkdir(parents=True)
snapshot = base / ('source-snapshot-' + args.round)
binary = build / 'framing-harness'
subprocess.run([
    'xcrun', '--sdk', 'macosx', 'swiftc', '-O', '-swift-version', '5',
    str(snapshot / 'desktop/glyph-metal-lab-v1/Sources/Matter.swift'),
    str(snapshot / 'desktop/glyph-metal-lab-v1/Sources/SurfaceReference.swift'),
    str(snapshot / 'desktop/glyph-metal-lab-v2/Sources/CameraFraming.swift'),
    str(base / ('harness-' + args.round) / 'main.swift'), '-o', str(binary)
], check=True)
subprocess.run([str(binary), str(out)], check=True)
