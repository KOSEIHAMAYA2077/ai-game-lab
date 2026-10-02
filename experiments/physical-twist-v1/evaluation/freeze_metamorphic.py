import hashlib,json
from pathlib import Path
from datetime import datetime,timezone
D=Path(__file__).resolve().parent
bases=[('end','棒の先に球',['tube','sphere']),('above','球の上に箱',['sphere','box']),('through','箱を輪が貫く',['box','ring'])]
cases=[]
for relation,text,names in bases:
 for color,prefix in [('none',''),('red','赤い'),('yellow','黄色い'),('blue','青い')]:
  cases.append({'id':f'color-{relation}-{color}','group':relation,'baseId':f'color-{relation}-none','ink':color,'text':prefix+text,'expected':{'parts':[{'primitive':name}for name in names],'relation':relation}})
data={'version':1,'createdAt':datetime.now(timezone.utc).isoformat(),'purpose':'Metamorphic color invariance, not unknown-language accuracy. Colored form should preserve the uncolored request primitive roles and relation.','cases':cases}
p=D/'color-metamorphic.json'
if p.exists():raise SystemExit('Refusing overwrite')
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');digest=hashlib.sha256(p.read_bytes()).hexdigest();p.with_suffix('.sha256').write_text(digest+'  '+p.name+'\n');print(digest)
