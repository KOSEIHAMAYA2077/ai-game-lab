import Foundation
import Darwin
import simd

// Same synthetic commands/time through immutable baseline and the cache candidate.
guard CommandLine.arguments.count == 7 else { fatalError("old bundle, cache bundle, native14, core3 results, invalid8 and new output directory required") }
let oldBundle=URL(fileURLWithPath:CommandLine.arguments[1]),cacheBundle=URL(fileURLWithPath:CommandLine.arguments[2])
let output=URL(fileURLWithPath:CommandLine.arguments[6],isDirectory:true)
guard !FileManager.default.fileExists(atPath:output.path) else {fatalError("preserve outputs")}
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
let nativeFixture=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[3]))) as! [String:Any]
let coreResult=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[4]))) as! [String:Any]
let invalidFixture=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[5]))) as! [String:Any]
var failures=[[String:Any]](),nativeRows=[[String:Any]](),coreRows=[[String:Any]](),invalidRows=[[String:Any]]()
var instancePairs=0,geometryChecks=0
func check(_ good:Bool,_ label:String,_ detail:String="") {if !good {failures.append(["label":label,"detail":detail])}}
func literal(_ a:String,_ b:String)->Bool {a.utf16.elementsEqual(b.utf16)}
func unitsEqual(_ a:[AmbientUnit],_ b:[AmbientUnit])->Bool {a.count==b.count && zip(a,b).allSatisfy{$0.id==$1.id && $0.ink==$1.ink && literal($0.text,$1.text)}}
func payloads(_ glyphs:[AmbientGlyphView],baseline:Bool)->Data {
    var tiles=[String:Int]()
    for g in glyphs where tiles[g.text]==nil {tiles[g.text]=tiles.count}
    var rows=1;while rows*32<max(1,tiles.count) {rows*=2}
    let rect:(String)->SIMD4<Float>={text in let id=tiles[text]!;return [Float(id%32)/32,Float(id/32)/Float(rows),1/32,1/Float(rows)]}
    let instances=baseline ? baselineInstances(glyphs,seed:1,distance:3.8,scale:1,height:440,atlasRect:rect) : ambientInstances(glyphs,seed:1,distance:3.8,scale:1,height:440,atlasRect:rect)
    for x in instances {check((0..<4).allSatisfy{x.ink[$0].isFinite && x.material[$0].isFinite && x.source[$0].isFinite && x.atlasRect[$0].isFinite},"finite-instance")}
    return instances.withUnsafeBytes{Data($0)}
}
func equalProjection(_ a:BaselineProjection,_ b:AmbientProjection,_ id:String) {
    check(a.bodyCount==b.bodyCount && a.shape==b.shape && a.glyphs.count==b.glyphs.count,"projection-count-shape",id)
    for (x,y) in zip(a.glyphs,b.glyphs) {check(x.id==y.id && literal(x.text,y.text) && x.ink==y.ink && x.born==y.born && x.intakeSeed==y.intakeSeed && x.inputIndex==y.inputIndex,"view-identity-birth",id)}
    check(payloads(a.glyphs,baseline:true)==payloads(b.glyphs,baseline:false),"instance-byte-exact",id)
    instancePairs+=a.glyphs.count
}
for f in nativeFixture["cases"] as! [[String:Any]] {
    let id=f["id"] as! String,before=failures.count
    var session=id,old=try BaselineReceiverBridge(bundleURL:oldBundle),cached=try AmbientReceiverBridge(bundleURL:cacheBundle,receiverSession:session)
    var oldProjection=BaselineProjection(),cacheProjection=AmbientProjection(),doc="",thrown=0,idleBodyCalls=0,oldValidated=0
    try cacheProjection.bindSession(session)
    var trace=[[String:Any]]()
    func apply(_ command:[String:Any]) throws {
        let at=command["at"] as! Int
        // Shared artificial visual clock, not actual pause/hide presentation timing.
        oldProjection.time=Double(at)/1000;cacheProjection.time=Double(at)/1000
        let oldView=try old.send(command),update=try cached.send(command)
        _=try oldProjection.apply(oldView);_=try cacheProjection.apply(update)
        oldValidated+=oldView.units.count
        check(unitsEqual(oldView.units,cacheProjection.renderingUnits),"readBody-cache-prefix",id)
        equalProjection(oldProjection,cacheProjection,id)
        trace.append(["at":at,"body":update.metadata.bodyCount,"presented":update.metadata.presentedCount,"shape":update.metadata.shape,"deltaUnits":update.delta?.units.count ?? 0])
        if let value=command["value"] as? String, ["init","commit","observe","mark-cancel"].contains(command["op"] as! String) {doc=value}
    }
    for original in f["commands"] as! [[String:Any]] {
        let op=original["op"] as! String
        if op=="reset-session" {
            old.destroy();cached.destroy();session=original["session"] as! String
            old=try BaselineReceiverBridge(bundleURL:oldBundle);cached=try AmbientReceiverBridge(bundleURL:cacheBundle,receiverSession:session)
            oldProjection=BaselineProjection();cacheProjection=AmbientProjection();try cacheProjection.bindSession(session);doc="";continue
        }
        if op=="unsupported-command" {
            var a=false,b=false;do {_=try old.send(original["original"] as! [String:Any])}catch{a=true};do {_=try cached.send(original["original"] as! [String:Any])}catch{b=true}
            check(a && b,"same-unsupported-native-source",id);thrown+=1;continue
        }
        if op=="idle-ticks" {
            let start=cached.bodyCalls
            for i in 1...(original["count"] as! Int) {try apply(["op":"advance","at":(original["at"] as! Int)+i*(original["step"] as! Int)])}
            idleBodyCalls+=cached.bodyCalls-start;continue
        }
        var command=original
        if op=="commit-repeat" || op=="commit-after-current" {
            let text=op=="commit-repeat" ? String(repeating:original["text"] as! String,count:original["count"] as! Int) : original["text"] as! String
            command=["op":"commit","at":original["at"]!,"base":doc,"value":doc+text,"text":text,"range":[doc.utf16.count,0]]
        }
        try apply(command)
    }
    let e=f["expected"] as! [String:Any],units=cacheProjection.renderingUnits
    check(literal(units.map(\.text).joined(),e["body"] as! String),"manual-body",id)
    check(units.count==e["unitCount"] as! Int && units.map{ $0.ink.rawValue }==e["inks"] as! [String],"manual-unit-ink",id)
    check(cached.lastMetadata?.shape==e["shape"] as? String,"manual-shape",id)
    if let n=e["presented"] as? Int {check(cacheProjection.glyphs.count==n,"manual-presented",id)}
    if let n=e["bodyCalls"] as? Int {check(cached.bodyCalls==n,"manual-body-calls",id)}
    if let n=e["bodyCallsPerFinalSession"] as? Int {check(cached.bodyCalls==n,"manual-final-session-calls",id)}
    if let n=e["throws"] as? Int {check(thrown==n,"manual-unsupported-count",id)}
    if let texts=e["unitTexts"] as? [String] {check(units.count==texts.count && zip(units,texts).allSatisfy{literal($0.text,$1)},"manual-operation-local-unicode",id)}
    if let reason=e["lastHold"] as? String {check(cached.lastMetadata?.aggregate.reason==reason,"manual-hold",id)}
    check(idleBodyCalls==0,"idle-no-body-transfer",id)
    nativeRows.append(["id":id,"passed":failures.count==before,"bodyCount":units.count,"presented":cacheProjection.glyphs.count,"oldFullCalls":old.fullCalls,"oldFullBytes":old.fullBytes,"oldValidatedUnits":oldValidated,"cache":cached.diagnostics(),"cacheValidatedUnits":cacheProjection.validatedUnits,"projectionUpdates":cacheProjection.projectionUpdates,"traces":trace])
    old.destroy();cached.destroy()
}
for r in coreResult["runs"] as! [[String:Any]] {
    let id=r["id"] as! String,before=failures.count,a=BaselineProjection(),b=AmbientProjection();try b.bindSession(id)
    check(r["passed"] as? Bool==true,"core-manual-expected",id)
    for trace in r["traces"] as! [[String:Any]] {
        a.time=Double(trace["at"] as! Int)/1000;b.time=a.time
        let full=try JSONDecoder().decode(AmbientReceiverView.self,from:JSONSerialization.data(withJSONObject:trace["full"]!))
        let meta=try JSONDecoder().decode(AmbientCacheMetadata.self,from:JSONSerialization.data(withJSONObject:trace["metadata"]!))
        let delta=(trace["delta"] is NSNull) ? nil : try JSONDecoder().decode(AmbientCacheDelta.self,from:JSONSerialization.data(withJSONObject:trace["delta"]!))
        _=try a.apply(full);_=try b.apply(AmbientCacheUpdate(metadata:meta,delta:delta))
        check(unitsEqual(full.units,b.renderingUnits),"multi-source-single-body",id);equalProjection(a,b,id)
    }
    coreRows.append(["id":id,"passed":failures.count==before,"finalBodyCount":b.bodyCount,"cacheValidatedUnits":b.validatedUnits])
}
func basePacket()->[String:Any] {
    ["metadata":["cacheVersion":AmbientProjection.cacheVersion,"receiverSession":"S","materialGeneration":1,"nextId":2,"bodyCount":1,"presentedCount":1,"shape":"sphere",
                 "aggregate":["version":"metal-ambient-v1-r1","savingOff":true,"bodyCount":1,"presentedCount":1,"shape":"sphere","status":"ready","reason":"ready","pending":false,"composing":false,"paused":false,"visible":true,"now":0]],
     "delta":["cacheVersion":AmbientProjection.cacheVersion,"receiverSession":"S","materialGeneration":1,"nextId":2,"bodyCount":1,"afterId":0,"units":[["id":1,"text":"A","ink":"blue"]]]]
}
func updateFrom(_ packet:[String:Any]) throws -> AmbientCacheUpdate {
    let m=try JSONDecoder().decode(AmbientCacheMetadata.self,from:JSONSerialization.data(withJSONObject:packet["metadata"]!))
    let d=packet["delta"] == nil ? nil : try JSONDecoder().decode(AmbientCacheDelta.self,from:JSONSerialization.data(withJSONObject:packet["delta"]!))
    return AmbientCacheUpdate(metadata:m,delta:d)
}
for f in invalidFixture["cases"] as! [[String:Any]] {
    let id=f["id"] as! String,b=AmbientProjection();try b.bindSession("S");_=try b.apply(updateFrom(basePacket()))
    var packet=basePacket(),m=packet["metadata"] as! [String:Any],d=packet["delta"] as! [String:Any]
    packet.removeValue(forKey:"delta")
    if ["I03","I04","I06","I08"].contains(id) {
        m["materialGeneration"]=2;m["bodyCount"]=2;m["nextId"]=3
        var agg=m["aggregate"] as! [String:Any];agg["bodyCount"]=2;m["aggregate"]=agg
        d["materialGeneration"]=2;d["bodyCount"]=2;d["nextId"]=3;d["afterId"]=1;d["units"]=[["id":2,"text":"B","ink":"blue"]]
    }
    switch id {
    case "I01":m["receiverSession"]="foreign"
    case "I02":m["materialGeneration"]=0;m["bodyCount"]=0;m["nextId"]=1
    case "I03":break
    case "I04":d["units"]=[["id":1,"text":"B","ink":"blue"]];packet["delta"]=d
    case "I05":d["afterId"]=1;d["units"]=[["id":1,"text":"A","ink":"green"]];packet["delta"]=d
    case "I06":d["units"]=[["id":2,"text":String(repeating:"A",count:257),"ink":"blue"]];packet["delta"]=d
    case "I07":m["presentedCount"]=0;var agg=m["aggregate"] as! [String:Any];agg["presentedCount"]=0;m["aggregate"]=agg
    case "I08":m["nextId"]=99;packet["delta"]=d
    default:break
    }
    packet["metadata"]=m
    var rejected=false;do {_=try b.apply(updateFrom(packet))}catch{rejected=true}
    let unchanged=b.bodyCount==1 && b.glyphs.count==1 && b.validatedUnits==1 && b.renderingUnits[0].id==1 && b.renderingUnits[0].ink == .blue && literal(b.renderingUnits[0].text,"A")
    check(rejected && unchanged,"malformed-wire-whole-update-rejected",id)
    invalidRows.append(["id":id,"passed":rejected && unchanged,"rejected":rejected,"cacheUnchanged":unchanged])
}
for shape in AmbientShape.allCases {for time in [0.0,24.0] {for id in [1,128,256] {
    let f=ambientReferenceFrame(shape:shape,id:id,time:time,seed:1)
    check([f.p.x,f.p.y,f.p.z,f.u.x,f.u.y,f.u.z,f.v.x,f.v.y,f.v.z].allSatisfy(\.isFinite),"unchanged16-geometry-finite",String(shape.rawValue))
    geometryChecks+=1
}}}
check(MemoryLayout<AmbientGlyphInstance>.stride==80,"instance-stride-80")
let result:[String:Any]=["version":"cache-native-cpu-r1","native14Passed":nativeRows.filter{$0["passed"] as? Bool==true}.count,"core3Passed":coreRows.filter{$0["passed"] as? Bool==true}.count,"invalid8Passed":invalidRows.filter{$0["passed"] as? Bool==true}.count,"native":nativeRows,"core":coreRows,"invalid":invalidRows,"instancePairs":instancePairs,"geometryChecks":geometryChecks,"failures":failures,"actualNativeUI":false,"actualNativeIME":false,"GPUExecuted":false,"wholeWidgetResourcesMeasured":false,"artificialVisualClock":true]
try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output.appendingPathComponent("cpu-report-r1.json"),options:.withoutOverwriting)
print("native14/core3/invalid8: \(nativeRows.filter{$0["passed"] as? Bool==true}.count)/\(coreRows.filter{$0["passed"] as? Bool==true}.count)/\(invalidRows.filter{$0["passed"] as? Bool==true}.count); failures=\(failures.count)")
if !failures.isEmpty {exit(1)}
