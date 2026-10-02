"""New examples fixed before the browser-encoder head is trained. Keep labels independent."""
import json,hashlib
from pathlib import Path
from datetime import datetime,timezone
D=Path(__file__).resolve().parent
p=lambda *names:{'parts':[{'primitive':name} for name in names]}
r=lambda names,relation:{**p(*names),'relation':relation}
cases=[
 {'id':'head-challenge-end-ring-vase-ja','group':'end','text':'輪の先端に花瓶を取り付けて、じっくり眺める。','expected':r(['ring','vase'],'end')},
 {'id':'head-challenge-above-vase-blade-ja','group':'above','text':'花瓶の上に刃を載せた形を見たい。','expected':r(['vase','blade'],'above')},
 {'id':'head-challenge-through-tube-ring-ja','group':'through','text':'棒を輪が貫く、そんな立体を浮かべる。','expected':r(['tube','ring'],'through')},
 {'id':'head-challenge-above-box-ring-ja','group':'above','text':'箱の上に輪、という構造をお願いします。','expected':r(['box','ring'],'above')},
 {'id':'head-challenge-end-blade-vase-en','group':'end','text':'A vase is joined at the tip of a blade.','expected':r(['blade','vase'],'end')},
 {'id':'head-challenge-above-blade-vase-en','group':'above','text':'Put a vase above a blade, then let it remain still.','expected':r(['blade','vase'],'above')},
 {'id':'head-challenge-through-sphere-blade-en','group':'through','text':'A blade passes through a sphere.','expected':r(['sphere','blade'],'through')},
 {'id':'head-challenge-unsupported-placement-en','group':'unsupported-relation','text':'Place a vase next to a ring.','expected':None},
]
data={'version':1,'createdAt':datetime.now(timezone.utc).isoformat(),'purpose':'New independent fixture frozen before browser-encoder relation head training is complete. No fixture text shared with trainer before first evaluation. Finite program meaning, not an arbitrary geometry generalization claim.','cases':cases}
p=D/'head-challenge-fixture.json'
if p.exists():raise SystemExit('Refusing overwrite')
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');digest=hashlib.sha256(p.read_bytes()).hexdigest();p.with_suffix('.sha256').write_text(digest+'  '+p.name+'\n');print(digest)
