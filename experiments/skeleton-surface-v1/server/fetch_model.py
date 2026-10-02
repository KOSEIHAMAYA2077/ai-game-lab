"""Download only pinned data files from the original model publisher.

Run explicitly during setup. The interpretation API itself never calls this.
Existing files are verified and retained; partial downloads are retained too.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, default=Path(__file__).resolve().parents[3] / ".local/semantics-model")
    args = parser.parse_args()
    manifest = json.loads(Path(__file__).with_name("model-manifest.json").read_text())
    for item in manifest["files"]:
        if not item["url"].startswith("https://huggingface.co/sentence-transformers/"):
            raise RuntimeError("Unexpected model source")
        target = args.model_dir / item["file"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if hashlib.sha256(target.read_bytes()).hexdigest() != item["sha256"]:
                raise RuntimeError("Existing file checksum mismatch; file retained")
            print(f"Verified existing {item['file']}")
            continue
        partial = target.with_name(target.name + f".partial-{time.time_ns()}")
        with urllib.request.urlopen(item["url"], timeout=60) as source, partial.open("xb") as destination:
            while data := source.read(1024*1024):
                destination.write(data)
        if partial.stat().st_size != item["bytes"] or hashlib.sha256(partial.read_bytes()).hexdigest() != item["sha256"]:
            raise RuntimeError("Downloaded file checksum mismatch; partial file retained")
        if target.exists():
            raise RuntimeError("Destination appeared during download; both files retained")
        partial.rename(target)
        print(f"Downloaded verified {item['file']}")


if __name__ == "__main__":
    main()
