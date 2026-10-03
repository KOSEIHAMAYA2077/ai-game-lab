import Foundation
import simd

@main struct ClockBoundary {
 static func meta(session:String,now:Int,count:Int=2,presented:Int?=nil,shape:String="sphere")->[String:Any] {
  let p=presented ?? count
  return ["cacheVersion":AmbientProjection.cacheVersion,"receiverSession":session,"materialGeneration":count,"nextId":count+1,"bodyCount":count,"presentedCount":p,"shape":shape,
    "aggregate":["version":"metal-ambient-v1-r1","savingOff":true,"bodyCount":count,"presentedCount":p,"shape":shape,"status":"ready","reason":"ready","pending":false,"composing":false,"paused":false,"visible":true,"now":now]]
 }
 static func delta(session:String,count:Int,after:Int,id:Int?=nil)->[String:Any] {
  var units=[[String:Any]]()
  for i in (after+1)...count {units.append(["id":id ?? i,"text":i==1 ? "A":i==2 ? "B":"C","ink":i==1 ? "blue":i==2 ? "green":"purple"])}
  return ["cacheVersion":AmbientProjection.cacheVersion,"receiverSession":session,"materialGeneration":count,"nextId":count+1,"bodyCount":count,"afterId":after,"units":units]
 }
 static func update(_ p:[String:Any]) throws -> AmbientCacheUpdate {
  let m=try JSONDecoder().decode(AmbientCacheMetadata.self,from:JSONSerialization.data(withJSONObject:p["metadata"]!))
  let d=(p["delta"]==nil || p["delta"] is NSNull) ? nil : try JSONDecoder().decode(AmbientCacheDelta.self,from:JSONSerialization.data(withJSONObject:p["delta"]!))
  return AmbientCacheUpdate(metadata:m,delta:d)
 }
 static func fake(_ packets:[[String:Any]],url:URL) throws {
  let json=String(decoding:try JSONSerialization.data(withJSONObject:packets,options:[.sortedKeys]),as:UTF8.self)
  let script="""
  var AmbientCacheReceiver={createSession:function(){var packets=\(json),last=null;return {
    executeMetaJSON:function(){if(!packets.length)throw Error('queue exhausted');last=packets.shift();return JSON.stringify(last.metadata)},
    snapshotMetaJSON:function(){return JSON.stringify(last.metadata)},
    readBodyDeltaJSON:function(){return JSON.stringify(last.delta)},
    offExportJSON:function(){return '{}'},destroy:function(){}}}};
  """
  try script.write(to:url,atomically:false,encoding:.utf8)
 }
 static func main() throws {
  guard CommandLine.arguments.count==4 else{fatalError("clockfixture newwork newoutput")}
  let fixtures=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))) as! [String:Any]
  let work=URL(fileURLWithPath:CommandLine.arguments[2]),out=URL(fileURLWithPath:CommandLine.arguments[3]);guard !FileManager.default.fileExists(atPath:work.path),!FileManager.default.fileExists(atPath:out.path) else{fatalError("preserve output")}
  try FileManager.default.createDirectory(at:work,withIntermediateDirectories:true)
  var rows=[[String:Any]](),failures=[String]()
  for f in fixtures["cases"] as! [[String:Any]] {
    let id=f["id"] as! String,s=id+"_S",next=f["nextNow"] as! Int,e=f["expected"] as! [String:Any]
    let initial=(f["initialNow"] as? Int),reset=id=="C06",firstEmpty=initial==nil
    var packets=[[String:Any]]()
    if let initial {packets.append(["metadata":meta(session:s,now:initial),"delta":delta(session:s,count:2,after:0)])}
    let shape=id=="C02" ? "box":"sphere"
    let badGrowth=id=="C04" || id=="C08",n=firstEmpty || reset ? 0:badGrowth ? 3:2
    if !reset {packets.append(["metadata":meta(session:s,now:next,count:n,presented:badGrowth ? 2:n,shape:shape),"delta":badGrowth ? delta(session:s,count:3,after:2,id:id=="C08" ? 2:nil) as Any:NSNull()])}
    if id=="C08" {packets.append(["metadata":meta(session:s,now:110,count:3,presented:3),"delta":delta(session:s,count:3,after:2)])}
    let path=work.appendingPathComponent(id+".js");try fake(packets,url:path)
    var bridge=try AmbientReceiverBridge(bundleURL:path,receiverSession:s),projection=AmbientProjection();try projection.bindSession(s)
    var projectionClock:Int?,attempts=[[String:Any]]()
    if initial != nil {let u=try bridge.send(["op":"synthetic-wire","at":0]);_=try projection.apply(u);projectionClock=u.metadata.aggregate.now}
    if reset {
      bridge.destroy();let s2=id+"_fresh",p2=work.appendingPathComponent(id+"_fresh.js");packets=[["metadata":meta(session:s2,now:0,count:0),"delta":NSNull()]];try fake(packets,url:p2)
      bridge=try AmbientReceiverBridge(bundleURL:p2,receiverSession:s2);projection=AmbientProjection();try projection.bindSession(s2);projectionClock=nil
    }
    let count=id=="C08" ? 2:1
    var good=true
    for attempt in 0..<count {
      let packet=reset ? packets[0]:packets[(initial==nil ? 0:1)+attempt]
      let beforeBody=projection.bodyCount,beforeNow=bridge.lastMetadata?.aggregate.now,beforeCalls=bridge.bodyCalls
      var br=false,pr=false
      do{_=try bridge.send(["op":"synthetic-wire","at":attempt+1])}catch{br=true}
      do {let u=try update(packet);_=try projection.apply(u);projectionClock=u.metadata.aggregate.now}catch{pr=true}
      let expectedReject=id=="C08" ? attempt==0:e["bridgeReject"] as! Bool
      var pass=br==expectedReject && pr==expectedReject
      if expectedReject {pass=pass && projection.bodyCount==beforeBody && bridge.lastMetadata?.aggregate.now==beforeNow && projectionClock==beforeNow}
      if id=="C04" {pass=pass && bridge.bodyCalls-beforeCalls==e["newDeltaFetches"] as! Int}
      if id=="C08" && attempt==1 {pass=pass && projection.bodyCount==3 && bridge.lastMetadata?.aggregate.now==110 && projectionClock==110}
      if !expectedReject && id != "C08" {pass=pass && bridge.lastMetadata?.aggregate.now==e["acceptedNow"] as? Int && projectionClock==e["acceptedNow"] as? Int}
      #if CACHE_R2
      pass=pass && projection.observedAt==projectionClock
      #endif
      if let expectedShape=e["shape"] as? String {pass=pass && bridge.lastMetadata?.shape==expectedShape && projection.shape==AmbientProjection.mappedShape(expectedShape)}
      good=good && pass
      attempts.append(["attempt":attempt,"bridgeRejected":br,"projectionRejected":pr,"acceptedBridgeNow":(bridge.lastMetadata?.aggregate.now).map { $0 as Any } ?? NSNull(),"acceptedProjectionClock":projectionClock.map { $0 as Any } ?? NSNull(),"bodyCount":projection.bodyCount,"deltaCallsAdded":bridge.bodyCalls-beforeCalls,"passed":pass])
    }
    rows.append(["id":id,"passed":good,"attempts":attempts]);if !good{failures.append(id)};bridge.destroy()
  }
  #if CACHE_R2
  let version="cache-host-clock-r2"
  #else
  let version="cache-host-clock-r1-known-reproduction"
  #endif
  let result:[String:Any]=["version":version,"passed":rows.filter{$0["passed"] as? Bool==true}.count,"total":rows.count,"cases":rows,"failures":failures,"syntheticFakeWireInRealJavaScriptCore":true,"actualOSIMEUI":false,"wholeWidgetResourceClaim":false]
  try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:out,options:.withoutOverwriting)
  print("clock gate \(rows.filter{$0["passed"] as? Bool==true}.count)/\(rows.count)");if !failures.isEmpty{exit(1)}
 }
}
