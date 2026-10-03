import Foundation
import JavaScriptCore

enum ReviewError: Error { case failed(String) }
func fields(_ value: AmbientGlyphInstance) -> [UInt32] {
    let floats = [value.atlasRect, value.ink, value.material, value.source]
    return floats.flatMap { [$0.x.bitPattern,$0.y.bitPattern,$0.z.bitPattern,$0.w.bitPattern] }
        + [value.identity.x,value.identity.y,value.identity.z,value.identity.w]
}
@main struct OldJSCReference {
    static func main() throws {
        let base = "experiments/widget-metal-ambient-cache-review-v1/"
        let bundle = "experiments/widget-metal-ambient-v1/work/GlyphMatter-Ambient-ProducerR2-BridgeR2-BuildR5.app/Contents/Resources/Receiver.js"
        let input = try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:base+"CASES-R1.json"))) as! [String:Any]
        let cases = input["sessions"] as! [[String:Any]]
        guard let context=JSContext() else { throw ReviewError.failed("context") }
        context.evaluateScript(try String(contentsOf:URL(fileURLWithPath:bundle)))
        guard context.exception==nil,let namespace=context.objectForKeyedSubscript("AmbientNativeReceiver"),let create=namespace.objectForKeyedSubscript("createSession") else {throw ReviewError.failed("old bundle")}
        var runs:[[String:Any]]=[]
        for row in cases {
            var session=create.call(withArguments:[])!,projection=AmbientProjection(),atlas:[[UInt16]:Int]=[:],traces:[[String:Any]]=[]
            let steps=row["steps"] as! [[String:Any]]
            for (index,original) in steps.enumerated() {
                if original["op"] as? String == "reset-review-session" {
                    _=session.objectForKeyedSubscript("destroy")!.call(withArguments:[])
                    session=create.call(withArguments:[])!;projection=AmbientProjection();atlas=[:]
                    traces.append(["step":index,"reset":true]);continue
                }
                var command=original;let time=(command.removeValue(forKey:"projectionTime") as! NSNumber).doubleValue
                let data=try JSONSerialization.data(withJSONObject:command,options:[.sortedKeys])
                context.exception=nil
                guard let json=session.objectForKeyedSubscript("executeJSON")!.call(withArguments:[String(decoding:data,as:UTF8.self)])?.toString(),context.exception==nil else {throw ReviewError.failed("old execute")}
                let view=try JSONDecoder().decode(AmbientReceiverView.self,from:Data(json.utf8))
                projection.time=time;let changed=try projection.apply(view)
                let instances=ambientInstances(projection.glyphs,seed:1,distance:4,scale:0.9,height:440) { text in
                    let key=Array(text.utf16);let id:Int
                    if let found=atlas[key]{id=found}else{id=atlas.count;atlas[key]=id}
                    return [Float(id%32)/32,Float(id/32)/8,Float(1)/32,Float(1)/8]
                }
                guard MemoryLayout<AmbientGlyphInstance>.stride==80 else {throw ReviewError.failed("80B layout")}
                traces.append(["step":index,"aggregate":["bodyCount":view.aggregate.bodyCount,"presentedCount":view.presentedCount,"shape":view.shape,"status":view.aggregate.status,"reason":view.aggregate.reason],"bodyLiteral":view.units.map{Array($0.text.utf16)},"bodyIDs":view.units.map{$0.id},"bodyInks":view.units.map{$0.ink.rawValue},"glyphs":projection.glyphs.map{["id":$0.id,"literal":Array($0.text.utf16),"ink":$0.ink!.rawValue,"born":$0.born,"intakeSeed":$0.intakeSeed,"inputIndex":$0.inputIndex] as [String:Any]},"instances":instances.map(fields),"projectionChanged":changed,"wireBytes":json.utf8.count])
            }
            guard let off=session.objectForKeyedSubscript("offExportJSON")!.call(withArguments:[])?.toString(),context.exception==nil else {throw ReviewError.failed("old off export")}
            runs.append(["id":row["id"]!,"traces":traces,"offExport":try JSONSerialization.jsonObject(with:Data(off.utf8))])
            _=session.objectForKeyedSubscript("destroy")!.call(withArguments:[])
        }
        let output=base+"OLD-JSC-SWIFT-R1.json"
        guard !FileManager.default.fileExists(atPath:output) else {throw ReviewError.failed("output exists")}
        let result:[String:Any]=["version":"old-jsc-real-projection-cpu-r1","cases":runs.count,"instanceFieldPayloadBytes":80,"runs":runs,"candidateCalls":0,"scope":"Old immutable JS plus unchanged old real CPU projection/instance functions, no Metal device/UI/OS capture/model/resource measurement."]
        try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys,.prettyPrinted]).write(to:URL(fileURLWithPath:output),options:.withoutOverwriting)
        print("{\"oldJSCSessions\":\(runs.count),\"GPU\":false}")
    }
}
