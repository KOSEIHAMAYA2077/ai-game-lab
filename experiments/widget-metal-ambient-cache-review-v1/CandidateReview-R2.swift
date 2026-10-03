import Foundation
import JavaScriptCore

enum ReviewError:Error {case failed(String)}
func fields(_ value:AmbientGlyphInstance)->[UInt32] {
    [value.atlasRect,value.ink,value.material,value.source].flatMap{[$0.x.bitPattern,$0.y.bitPattern,$0.z.bitPattern,$0.w.bitPattern]}
        + [value.identity.x,value.identity.y,value.identity.z,value.identity.w]
}
func glyphRecord(_ g:AmbientGlyphView)->[String:Any] {
    ["id":g.id,"literal":Array(g.text.utf16),"ink":g.ink!.rawValue,"born":g.born,"intakeSeed":g.intakeSeed,"inputIndex":g.inputIndex]
}
func semantic(_ p:AmbientProjection)->[String:Any] {
    ["bodyCount":p.bodyCount,"shape":p.shape.rawValue,"receiverSession":p.receiverSession ?? "",
     "units":p.renderingUnits.map{["id":$0.id,"literal":Array($0.text.utf16),"ink":$0.ink.rawValue] as [String:Any]},
     "glyphs":p.glyphs.map(glyphRecord),"validatedUnits":p.validatedUnits,"projectionUpdates":p.projectionUpdates]
}
func lastMeta(_ b:AmbientReceiverBridge)->[String:Any] {
    guard let m=b.lastMetadata else{return [:]}
    return ["bodyCount":m.bodyCount,"presentedCount":m.presentedCount,"shape":m.shape,"now":m.aggregate.now,"generation":m.materialGeneration,"session":m.receiverSession]
}
func same(_ a:[String:Any],_ b:[String:Any])throws->Bool {
    try JSONSerialization.data(withJSONObject:a,options:[.sortedKeys])==JSONSerialization.data(withJSONObject:b,options:[.sortedKeys])
}
func update(_ record:[String:Any])throws->AmbientCacheUpdate {
    let data=try JSONSerialization.data(withJSONObject:record["metadata"]!,options:[.sortedKeys])
    let m=try JSONDecoder().decode(AmbientCacheMetadata.self,from:data)
    var d:AmbientCacheDelta?
    if let delta=record["delta"]{d=try JSONDecoder().decode(AmbientCacheDelta.self,from:JSONSerialization.data(withJSONObject:delta))}
    return AmbientCacheUpdate(metadata:m,delta:d)
}
@main struct CandidateReview {
    static func main()throws {
        let base="experiments/widget-metal-ambient-cache-review-v1/"
        let bundle=URL(fileURLWithPath:"experiments/widget-metal-ambient-cache-v1/work/GlyphMatter-Ambient-Cache-R1.app/Contents/Resources/Receiver.js")
        let input=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:base+"CASES-R1.json"))) as! [String:Any]
        var runs:[[String:Any]]=[]
        for row in input["sessions"] as! [[String:Any]] {
            let id=row["id"] as! String
            var serial=0,sessionID=id+"-0",bridge=try AmbientReceiverBridge(bundleURL:bundle,receiverSession:id+"-0"),projection=AmbientProjection(),atlas:[[UInt16]:Int]=[:],traces:[[String:Any]]=[]
            try projection.bindSession(sessionID)
            var totalMetadataBytes=0,totalBodyBytes=0,totalBodyCalls=0,error:String?
            do {
                for (index,original) in (row["steps"] as! [[String:Any]]).enumerated() {
                    if original["op"] as? String == "reset-review-session" {
                        bridge.destroy();serial+=1;sessionID=id+"-"+String(serial)
                        bridge=try AmbientReceiverBridge(bundleURL:bundle,receiverSession:sessionID);projection=AmbientProjection();try projection.bindSession(sessionID);atlas=[:]
                        traces.append(["step":index,"reset":true]);continue
                    }
                    var command=original;let time=(command.removeValue(forKey:"projectionTime") as! NSNumber).doubleValue
                    let before=bridge.diagnostics(),value=try bridge.send(command),m=value.metadata,after=bridge.diagnostics()
                    func increment(_ k:String)->Int{(after[k] as! Int)-(before[k] as! Int)}
                    totalMetadataBytes+=increment("metadataBytes");totalBodyBytes+=increment("bodyBytes");totalBodyCalls+=increment("bodyCalls")
                    projection.time=time;let changed=try projection.apply(value)
                    let instances=ambientInstances(projection.glyphs,seed:1,distance:4,scale:0.9,height:440){text in
                        let key=Array(text.utf16),position:Int
                        if let found=atlas[key]{position=found}else{position=atlas.count;atlas[key]=position}
                        return [Float(position%32)/32,Float(position/32)/8,Float(1)/32,Float(1)/8]
                    }
                    guard MemoryLayout<AmbientGlyphInstance>.stride==80 else{throw ReviewError.failed("80B")}
                    traces.append(["step":index,"aggregate":["bodyCount":m.bodyCount,"presentedCount":m.presentedCount,"shape":m.shape,"status":m.aggregate.status,"reason":m.aggregate.reason],"bodyLiteral":projection.renderingUnits.map{Array($0.text.utf16)},"bodyIDs":projection.renderingUnits.map{$0.id},"bodyInks":projection.renderingUnits.map{$0.ink.rawValue},"glyphs":projection.glyphs.map(glyphRecord),"instances":instances.map(fields),"projectionChanged":changed,"metadataBytes":increment("metadataBytes"),"bodyBytes":increment("bodyBytes"),"bodyCalls":increment("bodyCalls"),"deltaIDs":value.delta?.units.map{$0.id} ?? [],"validatedUnits":projection.validatedUnits,"metadataUpdates":projection.metadataUpdates,"projectionUpdates":projection.projectionUpdates])
                }
            }catch let e{error=String(describing:e)}
            let off=try JSONSerialization.jsonObject(with:bridge.exportOff())
            var record:[String:Any]=["id":id,"traces":traces,"offExport":off,"totalMetadataBytes":totalMetadataBytes,"totalBodyBytes":totalBodyBytes,"totalBodyCalls":totalBodyCalls]
            if let error=error{record["error"]=error}
            runs.append(record);bridge.destroy()
        }
        let wire=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:base+"WIRE-MAPPING-R1.json"))) as! [String:Any]
        var wireRuns:[[String:Any]]=[]
        for packet in wire["packets"] as! [[String:Any]] {
            let id=packet["id"] as! String,beforePacket=packet["before"] as! [String:Any],incoming=packet["incoming"] as! [String:Any],allowNoOp=(packet["expected"] as! String)=="noOpOrRejectUnchanged"
            let direct=AmbientProjection();try direct.bindSession("reviewwire");direct.time=0.25;_ = try direct.apply(update(beforePacket))
            let beforeDirect=semantic(direct);direct.time=0.5;var directRejected=false,directError:String?
            do{_ = try direct.apply(update(incoming))}catch{directRejected=true;directError=String(describing:error)}
            let directUnchanged=try same(beforeDirect,semantic(direct))
            let fake=URL(fileURLWithPath:base+"fake-wire-"+id+"-r1.js"),bridge=try AmbientReceiverBridge(bundleURL:fake,receiverSession:"reviewwire"),projection=AmbientProjection()
            try projection.bindSession("reviewwire");projection.time=0.25;_ = try projection.apply(bridge.send(["op":"checkpoint","at":0]))
            let beforeHost=semantic(projection),beforeMeta=lastMeta(bridge);projection.time=0.5
            var hostRejected=false,hostError:String?
            do{_ = try projection.apply(bridge.send(["op":"checkpoint","at":1]))}catch{hostRejected=true;hostError=String(describing:error)}
            let hostUnchanged=try same(beforeHost,semantic(projection)),metadataUnchanged=try same(beforeMeta,lastMeta(bridge))
            let passed=directUnchanged && hostUnchanged && metadataUnchanged && ((directRejected && hostRejected)||allowNoOp)
            var result:[String:Any]=["id":id,"parentCase":packet["parentCase"]!,"passed":passed,"directRejected":directRejected,"directUnchanged":directUnchanged,"hostRejected":hostRejected,"hostUnchanged":hostUnchanged,"metadataUnchanged":metadataUnchanged,"beforeMetadata":beforeMeta,"afterMetadata":lastMeta(bridge),"hostDiagnostics":bridge.diagnostics()]
            if let e=directError{result["directError"]=e};if let e=hostError{result["hostError"]=e};wireRuns.append(result);bridge.destroy()
        }
        let result:[String:Any]=["version":"independent-cache-r1-native-host-review-helper-r2","sessionCases":runs.count,"runs":runs,"wireParentCases":14,"wireAttempts":wireRuns.count,"wirePassed":wireRuns.filter{($0["passed"] as? Bool)==true}.count,"wireRuns":wireRuns,"instanceFieldPayloadBytes":80,"scope":"Fixed independent artificial cases, actual candidate JS/Swift bridge/projection/CPU instance math. No Metal device, app launch, UI, OS capture, model calls or whole-window resource measurement."]
        let output=URL(fileURLWithPath:base+"CANDIDATE-JSC-SWIFT-R2.json")
        guard !FileManager.default.fileExists(atPath:output.path) else{throw ReviewError.failed("output exists")}
        try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output,options:.withoutOverwriting)
        let passed=wireRuns.filter{($0["passed"] as? Bool)==true}.count
        print("{\"sessions\":\(runs.count),\"wirePassed\":\(passed),\"wireAttempts\":\(wireRuns.count)}")
    }
}
