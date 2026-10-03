import Foundation
import Darwin
import simd

@main struct CacheLocalTiming {
 static func cpu() -> Double {var t=timespec();clock_gettime(CLOCK_PROCESS_CPUTIME_ID,&t);return Double(t.tv_sec)+Double(t.tv_nsec)/1e9}
 static func timed(_ f:() throws -> Void) rethrows -> [String:Double] {let c=cpu(),w=ProcessInfo.processInfo.systemUptime;try f();return ["processCPUSeconds":cpu()-c,"localWallSeconds":ProcessInfo.processInfo.systemUptime-w]}
 static func data(_ glyphs:[AmbientGlyphView],old:Bool)->Data {
   let rect:(String)->SIMD4<Float>={_ in [0,0,1/32,1]}
   let v=old ? baselineInstances(glyphs,seed:1,distance:3.8,scale:1,height:440,atlasRect:rect):ambientInstances(glyphs,seed:1,distance:3.8,scale:1,height:440,atlasRect:rect)
   return v.withUnsafeBytes{Data($0)}
 }
 static func main() throws {
   guard CommandLine.arguments.count==5 else {fatalError("oldbundle cachebundle timingmethod newoutput")}
   let oldURL=URL(fileURLWithPath:CommandLine.arguments[1]),newURL=URL(fileURLWithPath:CommandLine.arguments[2]),out=URL(fileURLWithPath:CommandLine.arguments[4])
   guard !FileManager.default.fileExists(atPath:out.path) else {fatalError("preserve timing output")}
   let config=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[3]))) as! [String:Any]
   let warm=config["warm"] as! [String:Any],cold=config["cold"] as! [String:Any],burst=config["burstPresentation"] as! [String:Any]
   var failures=[String](),warmRows=[[String:Any]](),coldRows=[[String:Any]](),burstRows=[[String:Any]]()
   let text=String(repeating:warm["text"] as! String,count:warm["bodyCount"] as! Int),settle=warm["settleAtMs"] as! Int
   func check(_ b:Bool,_ s:String){if !b{failures.append(s)}}
   for round in 0..<(warm["rounds"] as! Int) {
     let old=try BaselineReceiverBridge(bundleURL:oldURL),new=try AmbientReceiverBridge(bundleURL:newURL,receiverSession:"warm_\(round)")
     let a=BaselineProjection(),b=AmbientProjection();try b.bindSession(new.receiverSession)
     for c:[String:Any] in [["op":"init","at":0,"value":""],["op":"commit","at":1,"base":"","value":text,"text":text,"range":[0,0]],["op":"advance","at":settle]] {
       a.time=Double(c["at"] as! Int)/1000;b.time=a.time;_=try a.apply(old.send(c));_=try b.apply(new.send(c))
     }
     let oldStartCalls=old.fullCalls,oldStartBytes=old.fullBytes,newStart=new.diagnostics(),startValidated=b.validatedUnits,startUpdates=b.projectionUpdates
     var oldValidated=0,oldInstanceUpdates=0,newInstanceUpdates=0
     let n=warm["tickCount"] as! Int,step=warm["tickStepMs"] as! Int,ordering=(warm["ordering"] as! [String])[round]
     func oldLoop() throws {for i in 1...n {let at=settle+i*step;a.time=Double(at)/1000;let v=try old.send(["op":"advance","at":at]);oldValidated+=v.units.count;if try a.apply(v){_=data(a.glyphs,old:true);oldInstanceUpdates+=1}}}
     func newLoop() throws {for i in 1...n {let at=settle+i*step;b.time=Double(at)/1000;if try b.apply(new.send(["op":"advance","at":at])){_=data(b.glyphs,old:false);newInstanceUpdates+=1}}}
     let oldTime:[String:Double],newTime:[String:Double]
     if ordering=="old-cache" {oldTime=try timed(oldLoop);newTime=try timed(newLoop)} else {newTime=try timed(newLoop);oldTime=try timed(oldLoop)}
     let stat=new.diagnostics(),delta=stat.mapValues{value -> Int in value as! Int}
     let cacheBodyCalls=delta["bodyCalls"]!-(newStart["bodyCalls"] as! Int),cacheBodyBytes=delta["bodyBytes"]!-(newStart["bodyBytes"] as! Int)
     let exact=data(a.glyphs,old:true)==data(b.glyphs,old:false)
     check(exact && a.bodyCount==b.bodyCount && a.shape==b.shape,"warm parity \(round)")
     check(old.fullCalls-oldStartCalls==n,"warm old calls \(round)")
     check(cacheBodyCalls==0 && cacheBodyBytes==0 && b.validatedUnits-startValidated==0,"warm no cached body \(round)")
     warmRows.append(["round":round,"order":ordering,"ticks":n,"oldTiming":oldTime,"cacheTiming":newTime,"oldFullCalls":old.fullCalls-oldStartCalls,"oldFullBytes":old.fullBytes-oldStartBytes,"oldValidatedUnits":oldValidated,"cacheMetadataCalls":delta["metadataCalls"]!-(newStart["metadataCalls"] as! Int),"cacheMetadataBytes":delta["metadataBytes"]!-(newStart["metadataBytes"] as! Int),"cacheBodyCalls":cacheBodyCalls,"cacheBodyBytes":cacheBodyBytes,"cacheDecodedUnits":delta["decodedUnits"]!-(newStart["decodedUnits"] as! Int),"cacheValidatedUnits":b.validatedUnits-startValidated,"cacheProjectionUpdates":b.projectionUpdates-startUpdates,"oldInstanceUpdates":oldInstanceUpdates,"cacheInstanceUpdates":newInstanceUpdates,"instanceByteExact":exact])
     old.destroy();new.destroy()
   }
   for i in 0..<(cold["pairs"] as! Int) {
     var old:BaselineReceiverBridge?,new:AmbientReceiverBridge?
     let oldTime:[String:Double],newTime:[String:Double]
     func oldCold() throws {old=try BaselineReceiverBridge(bundleURL:oldURL);_=try old!.send(["op":"init","at":0,"value":""])}
     func newCold() throws {new=try AmbientReceiverBridge(bundleURL:newURL,receiverSession:"cold_\(i)");_=try new!.send(["op":"init","at":0,"value":""])}
     if i%2==0 {oldTime=try timed(oldCold);newTime=try timed(newCold)}else{newTime=try timed(newCold);oldTime=try timed(oldCold)}
     check(old!.lastView?.units.count==0 && new!.lastMetadata?.bodyCount==0,"cold empty \(i)")
     coldRows.append(["pair":i,"order":i%2==0 ? "old-cache":"cache-old","oldTiming":oldTime,"cacheTiming":newTime,"oldFullBytes":old!.fullBytes,"cache":new!.diagnostics(),"bodyEmpty":true]);old!.destroy();new!.destroy()
   }
   let old=try BaselineReceiverBridge(bundleURL:oldURL),new=try AmbientReceiverBridge(bundleURL:newURL,receiverSession:"burst")
   let a=BaselineProjection(),b=AmbientProjection();try b.bindSession("burst")
   let burstText=String(repeating:burst["text"] as! String,count:burst["count"] as! Int)
   for c:[String:Any] in [["op":"init","at":0,"value":""],["op":"commit","at":1,"base":"","value":burstText,"text":burstText,"range":[0,0]]] {
     a.time=Double(c["at"] as! Int)/1000;b.time=a.time;_=try a.apply(old.send(c));_=try b.apply(new.send(c))
   }
   var oldTimeTotal:[String:Double]=["processCPUSeconds":0,"localWallSeconds":0],newTimeTotal=oldTimeTotal
   for i in 1...(burst["ticks"] as! Int) {
     let at=1+i*(burst["stepMs"] as! Int);a.time=Double(at)/1000;b.time=a.time
     let c:[String:Any]=["op":"advance","at":at]
     let ot=try timed{_=try a.apply(old.send(c))},nt=try timed{_=try b.apply(new.send(c))}
     for k in ot.keys {oldTimeTotal[k]!+=ot[k]!;newTimeTotal[k]!+=nt[k]!}
     let exact=data(a.glyphs,old:true)==data(b.glyphs,old:false);check(exact,"burst parity \(i)")
     burstRows.append(["tick":i,"at":at,"presented":b.glyphs.count,"bodyCount":b.bodyCount,"instanceByteExact":exact,"cacheBodyCalls":new.bodyCalls,"cacheDecodedUnits":new.decodedUnits])
   }
   check(b.glyphs.count==burst["expectedFinalPresented"] as! Int && new.decodedUnits==burst["expectedTotalTransferredCachedUnits"] as! Int,"burst expected")
   let result:[String:Any]=["version":"local-cache-timing-r1","warm":warmRows,"cold":coldRows,"burst":burstRows,"burstOldTiming":oldTimeTotal,"burstCacheTiming":newTimeTotal,"bundleBytes":["old":try Data(contentsOf:oldURL).count,"cache":try Data(contentsOf:newURL).count],"coldSameGraph":false,"contention":"shared Mac/root agent work uncontrolled; no global process enumeration","timeScope":"own CLI CLOCK_PROCESS_CPUTIME_ID + monotonic wall only","wholeWidgetResourceClaim":false,"actualUI":false,"GPU":false,"failures":failures]
   try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:out,options:.withoutOverwriting)
   print("timing warm=\(warmRows.count),cold=\(coldRows.count),burst=\(burstRows.count), failures=\(failures.count)")
   old.destroy();new.destroy();if !failures.isEmpty {exit(1)}
 }
}
