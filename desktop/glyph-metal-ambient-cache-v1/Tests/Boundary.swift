import Foundation
import simd

@main struct CacheBoundaryRegression {
 static func bytes(_ g:[AmbientGlyphView],old:Bool)->Data {let rect:(String)->SIMD4<Float>={_ in [0,0,1/32,1]};let x=old ? baselineInstances(g,seed:1,distance:3.8,scale:1,height:440,atlasRect:rect):ambientInstances(g,seed:1,distance:3.8,scale:1,height:440,atlasRect:rect);return x.withUnsafeBytes{Data($0)}}
 static func main() throws {
  guard CommandLine.arguments.count==4 else{fatalError("old bundle cache bundle newoutput")}
  let old=try BaselineReceiverBridge(bundleURL:URL(fileURLWithPath:CommandLine.arguments[1])),new=try AmbientReceiverBridge(bundleURL:URL(fileURLWithPath:CommandLine.arguments[2]),receiverSession:"boundary")
  let a=BaselineProjection(),b=AmbientProjection();try b.bindSession("boundary")
  let out=URL(fileURLWithPath:CommandLine.arguments[3]);guard !FileManager.default.fileExists(atPath:out.path) else {fatalError("preserve output")}
  var failures=[String](),largestOld=0,largestDelta=0,largestMeta=0,maxReencodedOld=0,traces=[[String:Any]]()
  func apply(_ command:[String:Any]) throws {
    let oldBytes=old.fullBytes,bodyBytes=new.bodyBytes,metaBytes=new.metadataBytes
    a.time=Double(command["at"] as! Int)/1000;b.time=a.time
    let v=try old.send(command),u=try new.send(command);_=try a.apply(v);_=try b.apply(u)
    largestOld=max(largestOld,old.fullBytes-oldBytes);largestDelta=max(largestDelta,new.bodyBytes-bodyBytes);largestMeta=max(largestMeta,new.metadataBytes-metaBytes)
    maxReencodedOld=max(maxReencodedOld,try JSONEncoder().encode(v).count)
    if v.units.count != b.renderingUnits.count || !zip(v.units,b.renderingUnits).allSatisfy({$0.id==$1.id && $0.ink==$1.ink && $0.text.utf16.elementsEqual($1.text.utf16)}){failures.append("literal prefix")}
    if bytes(a.glyphs,old:true) != bytes(b.glyphs,old:false) {failures.append("80B instance mismatch")}
  }
  try apply(["op":"init","at":0,"value":""])
  let cluster="A"+String(repeating:"\u{20D0}",count:255)
  for i in 0..<256 {
    try apply(["op":"commit","at":i*2+1,"base":"","value":cluster,"text":cluster,"range":[0,0]])
    try apply(["op":"observe","at":i*2+2,"value":""])
    traces.append(["insert":i+1,"bodyCount":b.bodyCount,"cacheBodyCalls":new.bodyCalls,"cacheDecodedUnits":new.decodedUnits])
  }
  try apply(["op":"advance","at":7000]);let idleCalls=new.bodyCalls,idleValidated=b.validatedUnits
  for i in 1...60 {try apply(["op":"advance","at":7000+i*67])}
  let oldExport=try old.exportOff(),newExport=try new.exportOff()
  let oldJ=try JSONSerialization.jsonObject(with:oldExport) as! NSDictionary,newJ=try JSONSerialization.jsonObject(with:newExport) as! NSDictionary
  let keys=Set(newJ.allKeys as! [String]),allowed:Set<String>=["grammar","version","savingOff","seed","shape","now","count","presentedCount","inkCounts","counters"]
  let exportSafe=keys==allowed && oldJ==newJ
  let allUTF16=b.renderingUnits.reduce(0){$0+$1.text.utf16.count}
  if b.bodyCount != 256 || allUTF16 != 65536 || new.bodyCalls != 256 || new.decodedUnits != 256 || new.bodyCalls-idleCalls != 0 || b.validatedUnits-idleValidated != 0 || !exportSafe {failures.append("expected boundary/count/export")}
  let result:[String:Any]=["version":"cache-boundary-r1","knownR5Regression":true,"bodyCount":b.bodyCount,"presented":b.glyphs.count,"bodyUTF16":allUTF16,"clusterUTF16":cluster.utf16.count,"cache":new.diagnostics(),"largestOldRawResponseBytes":largestOld,"largestOldReencodedResponseBytes":maxReencodedOld,"largestCacheDeltaBytes":largestDelta,"largestMetadataBytes":largestMeta,"idleBodyCalls":new.bodyCalls-idleCalls,"idleValidatedUnits":b.validatedUnits-idleValidated,"offExportKeys":Array(keys).sorted(),"offExportSameAndSafe":exportSafe,"inputCommandLimitBytes":8192,"responseLimitBytes":524288,"metadataLimitBytes":4096,"traces":traces,"failures":failures,"actualUI":false,"GPU":false,"wholeRAMClaim":false]
  try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:out,options:.withoutOverwriting)
  print("legal cluster boundary body=\(b.bodyCount),UTF16=\(allUTF16),failures=\(failures.count)")
  old.destroy();new.destroy();if !failures.isEmpty{exit(1)}
 }
}
