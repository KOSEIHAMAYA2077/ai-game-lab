"""Fresh artificial examples after the general parser fix was frozen. Not sent to model implementer before evaluation."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
D=Path(__file__).resolve().parent
p=lambda name,**attrs:{'primitive':name,**({'attributes':attrs} if attrs else {})}
r=lambda names,kind:{'parts':names,'relation':kind}
cases=[
 {'id':'fresh-tip-ja','group':'end','text':'長い棒の先っぽに小さな箱を取り付けたい。','expected':r([p('tube',height={'min':1.2}),p('box',height={'max':.8},width={'max':.8},depth={'max':.8})],'end')},
 {'id':'fresh-tip-en','group':'end','text':'At the very tip of a blade, attach a vase.','expected':r([p('blade'),p('vase')],'end')},
 {'id':'fresh-above-direction-ja','group':'above','text':'大きい箱を下にして、その上に細い管を載せる。','expected':r([p('box',width={'min':1.2}),p('tube',width={'max':.8})],'above')},
 {'id':'fresh-same-rings-en','group':'same-type','text':'A broad ring sits above a narrow ring.','expected':r([p('ring',width={'max':.8}),p('ring',width={'min':1.2})],'above')},
 {'id':'fresh-through-sphere-ring-ja','group':'through','text':'球を輪が横切って貫く姿にして。','expected':r([p('sphere'),p('ring')],'through')},
 {'id':'fresh-unsupported-through-sphere-en','group':'through-geometry-unsupported','text':'A sphere passes through a box.','expected':r([p('box'),p('sphere')],'through')},
 {'id':'fresh-negated-two-ja','group':'negation-hold','text':'棒も球も付けないで、そのままにして。','expected':None},
 {'id':'fresh-ordinary-ja','group':'ordinary','text':'その日の日記を読み返すと、昔の気持ちが少し戻ってきた。','expected':None},
]
data={'version':1,'createdAt':datetime.now(timezone.utc).isoformat(),'purpose':'First independent followup after general parser fixes were frozen; no semantic fixes permitted before first scoring. Six new structures plus two intended holds.','cases':cases}
out=D/'followup-fixture.json'
if out.exists():raise SystemExit('Refusing overwrite')
out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
digest=hashlib.sha256(out.read_bytes()).hexdigest();out.with_suffix('.sha256').write_text(digest+'  '+out.name+'\n');print(digest)
