import Foundation
import JavaScriptCore
let directory=CommandLine.arguments.count>1 ? CommandLine.arguments[1] : "experiments/ambient-shape-retrieval-v1"
func read(_ name:String)throws->String{try String(contentsOfFile:directory+"/"+name,encoding:.utf8)}
func literal(_ s:String)throws->String{let b=try JSONSerialization.data(withJSONObject:[s],options:[.fragmentsAllowed]);let t=String(data:b,encoding:.utf8)!;return String(t.dropFirst().dropLast())}
let context=JSContext()!
var errors:[String]=[]
context.exceptionHandler={_,value in errors.append(value?.toString() ?? "unknown JS exception")}
let start=Date()
context.evaluateScript(try read("retriever.js"))
context.evaluateScript("var __weights=JSON.parse("+(try literal(read("weights-r1.json")))+"); var __retriever=AmbientShapeRetrieval.createRetriever(__weights);")
let initMs=Date().timeIntervalSince(start)*1000
context.evaluateScript("var __cases=JSON.parse("+(try literal(read("JSC-CASES-R1.json")))+").cases;")
let script="""
var __maxError=0, __failures=[], __count=0;
function __compact(p){return {accepted:p.accepted,shape:p.shape,nextShape:p.nextShape,reason:p.reason,rawTop1:p.rawTop1,query:p.query,queryUTF16:p.queryUTF16,score:p.score,margin:p.margin,ranking:p.ranking.map(function(r){return {shape:r.shape,score:r.score,cosine:r.cosine,channel:r.channel};}),evidence:p.evidence};}
function __compare(a,b,path){if(typeof a==='number'&&typeof b==='number'){var e=Math.abs(a-b);__maxError=Math.max(__maxError,e);if(!Number.isFinite(e)||e>1e-12)__failures.push(path+': number');return;}if(typeof a!==typeof b||a===null||b===null){if(a!==b)__failures.push(path+': scalar');return;}if(typeof a==='object'){var ak=Object.keys(a),bk=Object.keys(b);if(ak.join('|')!==bk.join('|'))__failures.push(path+': keys');for(var k of ak)__compare(a[k],b[k],path+'.'+k);return;}if(a!==b)__failures.push(path+': value');}
for(var c of __cases){__compare(__compact(__retriever.predict(c.text,c.options)),c.expected,c.id);__count++;}
var __dev=__cases.filter(function(c){return c.id.endsWith('-full');});
for(var i=0;i<200;i++)__retriever.predict(__dev[i%__dev.length].text);
var __time=Date.now();for(var j=0;j<10;j++)for(var c of __dev)__retriever.predict(c.text);var __elapsed=Date.now()-__time;
JSON.stringify({cases:__count,maxAbsoluteError:__maxError,tolerance:1e-12,failures:__failures,warmCalls:200,timedCalls:__dev.length*10,batchMs:__elapsed,meanMs:__elapsed/(__dev.length*10),timer:'Date.now millisecond granularity, pure JS batch',engine:'System JavaScriptCore via JSContext',GPU:false,UI:false});
"""
let value=context.evaluateScript(script)?.toString() ?? "{}"
var result=(try JSONSerialization.jsonObject(with:Data(value.utf8))) as! [String:Any]
result["initializationMs"]=initMs;result["exceptions"]=errors;result["schema"]=1
let data=try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys])
let destination=directory+"/CPU-JSC-R1.json"
guard !FileManager.default.fileExists(atPath:destination) else {fatalError("Output already exists")}
try data.write(to:URL(fileURLWithPath:destination),options:.withoutOverwriting)
print(String(data:data,encoding:.utf8)!)
if !errors.isEmpty || !(result["failures"] as! [String]).isEmpty {exit(1)}
