"""Replay the frozen saved-file auditor into a new owned filename only."""
from pathlib import Path
import hashlib
import re
import sys

here=Path(__file__).resolve().parent
if len(sys.argv)!=2 or not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}\.json',sys.argv[1]):
    raise SystemExit('Give a new JSON basename, for example replay-new.json')
if (here/sys.argv[1]).exists():
    raise SystemExit('Output exists; preserve it and choose a new name')
source=here/'audit-r2.py'
if hashlib.sha256(source.read_bytes()).hexdigest()!='d5ec9ebf67ac2bf81918017c412d74d7ee127d144c941713b32282a68222e3d8':
    raise SystemExit('Frozen auditor differs')
code=source.read_text().replace('AUDIT-R2.json',sys.argv[1])
exec(compile(code,str(source),'exec'),{'__file__':str(source),'__name__':'__main__'})
