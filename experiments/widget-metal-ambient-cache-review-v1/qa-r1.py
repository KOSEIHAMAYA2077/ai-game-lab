"""Read-only static final audit: no candidate/model/GUI calls."""
import json,hashlib,re,sys
from pathlib import Path
BASE=Path(__file__).resolve().parent
ROOT=BASE.parent.parent
OUTPUT=BASE/'FINAL-QA-R1.json'
assert not OUTPUT.exists()
files=sorted(p for p in BASE.iterdir() if p.is_file())
issues=[];parsed={};verified=[];links=[];private=[]
def rel(p):return str(p.relative_to(ROOT))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def resolve(value):
 p=ROOT/value
 return p if p.exists() else BASE/value
def verify(value,want,context):
 p=resolve(value)
 if not p.is_file():issues.append({'kind':'missing-sha-reference','file':context,'reference':value});return
 actual=sha(p);verified.append({'file':context,'reference':value,'matched':actual==want})
 if actual!=want:issues.append({'kind':'sha-mismatch','file':context,'reference':value})
def walk(v,context):
 if isinstance(v,dict):
  if isinstance(v.get('path'),str) and isinstance(v.get('sha256'),str):verify(v['path'],v['sha256'],context)
  if isinstance(v.get('candidateManifest'),str) and isinstance(v.get('candidateManifestSHA256'),str):verify(v['candidateManifest'],v['candidateManifestSHA256'],context)
  if isinstance(v.get('oldSource'),str) and isinstance(v.get('oldSHA256'),str):verify(v['oldSource'],v['oldSHA256'],context)
  if isinstance(v.get('candidateSource'),str) and isinstance(v.get('newSHA256'),str):verify(v['candidateSource'],v['newSHA256'],context)
  if isinstance(v.get('independentFreezeSHA256'),str):verify('FREEZE-R1.json',v['independentFreezeSHA256'],context)
  for vv in v.values():walk(vv,context)
 elif isinstance(v,list):
  for vv in v:walk(vv,context)
patterns=[('private-user-home',b'/'+b'Users/'),('private-volume',b'/'+b'Volumes/'),('unix-home',b'/'+b'home/'),('file-uri',b'file'+b'://'),('windows-profile',b'C:'+bytes([92])+b'Users'+bytes([92]))]
for p in files:
 data=p.read_bytes()
 for label,pattern in patterns:
  start=0
  while (pos:=data.find(pattern,start))>=0:
   private.append({'file':rel(p),'kind':label,'offset':pos});start=pos+len(pattern)
 if p.suffix=='.json':
  try:parsed[p.name]=json.loads(data)
  except Exception as e:issues.append({'kind':'json-parse','file':rel(p),'errorType':type(e).__name__})
 if p.suffix=='.md':
  for label,target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)',data.decode()):
   if '://' in target or target.startswith('#'):continue
   target=target.split('#')[0].strip('<>');exists=(p.parent/target).exists();links.append({'file':rel(p),'target':target,'exists':exists})
   if not exists:issues.append({'kind':'broken-link','file':rel(p),'target':target})
for name,v in parsed.items():walk(v,rel(BASE/name))
# Explicit immutable core gate and preserved result expectations.
for name,want in [('CASES-R1.json','c864ec5270af14ef4484a6256841035b31c6b9b92e3f259129e5f2c2eb704db8'),('METHOD-R1.md','2fd3863cc6cb21343d43232e35a7943a8d09e158313606741d7dc6b95b3cd62f'),('FREEZE-R1.json','77501bae09c91e9265af08ee9a7bcbe1501560adcf44adf96cfb9bde3ab56bfe')]:verify(name,want,'explicit-independent-freeze')
r1=parsed['COMPARISON-R1.json'];r2=parsed['COMPARISON-R2.json'];clock=parsed['CLOCK-TRACE-COMPARISON-R2.json']
assert r1['wirePassedAttempts']==14 and r1['wireFailedAttempts']==['W12']
assert r2['wirePassedAttempts']==15 and r2['wireFailedAttempts']==[]
assert r1['normalFailures']==r2['normalFailures']==[]
assert clock['passed']==clock['traces']==66
assert r1['transferTotals']==r2['transferTotals']
for r in [r1,r2]:
 assert r['nativeSessionsComparedPassed']==12 and r['normalSteps']==66
 assert r['instanceRecordsCompared']==804 and r['float32FieldsBitwiseCompared']==12864 and r['uint32FieldsCompared']==3216
 assert r['wireParentCases']==14 and r['wireAttempts']==15
# Metadata records contain source/binary file digests, never absolute private paths.
result={'version':'ambient-cache-independent-final-qa-r1','filesAudited':len(files),'jsonParsed':len(parsed),'fixedSHAReferencesVerified':len(verified),'shaReferences':verified,'markdownLinksChecked':len(links),'links':links,'genericPrivatePathFindings':private,'issues':issues,'knownR1FailurePreserved':True,'knownR2RegressionExpectedCountsValid':True,'noCandidateCalls':True,'scope':'Static JSON/SHA/link/binary-text-pattern audit only; generic patterns, no literal personal paths. All files scanned including CPU executables and failed compiler logs.'}
with OUTPUT.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps({k:result[k] for k in ['filesAudited','jsonParsed','fixedSHAReferencesVerified','markdownLinksChecked','genericPrivatePathFindings','issues']}))
sys.exit(1 if private or issues else 0)
