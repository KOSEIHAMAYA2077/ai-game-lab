import Foundation
import simd
// Known boundary stress only. No AppKit window/IME, Metal, global capture, settings or user text.
@main struct IndependentJSONBoundary {
 static func main() throws {
  guard CommandLine.arguments.count==5 else {throw AmbientLabError.invalidArgument}
  let bridge=try AmbientReceiverBridge(bundleURL:URL(fileURLWithPath:CommandLine.arguments[1]))
  let output=URL(fileURLWithPath:CommandLine.arguments[2]),label=CommandLine.arguments[3],expectFailures=CommandLine.arguments[4]=="expect-old-failure"
  let cluster="a"+String(repeating:"\u{0301}",count:255)
  var at=0,errors=[[String:Any]](),checks=[String](),prefixValid=true
  _=try bridge.send(["op":"init","at":0,"value":""])
  func send(_ command:[String:Any]) {
   at+=1;var c=command;c["at"]=at
   do {
    let view=try bridge.send(c)
    if view.units.enumerated().contains(where:{$0.element.id != $0.offset+1 || $0.element.ink != .blue || !$0.element.text.utf16.elementsEqual(cluster.utf16)}) {prefixValid=false}
   }catch{errors.append(["commandIndex":at,"op":command["op"] as? String ?? "unknown"])}
  }
  for _ in 1...256 {
   send(["op":"commit","base":"","value":cluster,"text":cluster,"range":[0,0]])
   send(["op":"observe","value":""])
  }
  at=6999;send(["op":"advance"])
  let view=try bridge.current(),bytes=try JSONEncoder().encode(view).count
  let utf16=view.units.reduce(0){$0+$1.text.utf16.count}
  let idsCorrect=view.units.map(\.id)==Array(1...256)
  let textsCorrect=view.units.allSatisfy{$0.text.utf16.elementsEqual(cluster.utf16)}
  let inksCorrect=view.units.allSatisfy{$0.ink == .blue}
  if view.units.count != 256 {checks.append("body256")};if utf16 != 65536 {checks.append("utf16-65536")}
  if !idsCorrect||!prefixValid {checks.append("sole-stable-ids")};if !textsCorrect {checks.append("old-cluster-text")};if !inksCorrect {checks.append("old-ink")}
  if expectFailures && errors.isEmpty {checks.append("expected-old-guard-sensitivity")}
  if !expectFailures && !errors.isEmpty {checks.append("new-guard-errors")}
  let result:[String:Any]=["version":"independent-known-response-boundary-r1","sourceLabel":label,"knownAfterAuthorFinding":true,"independent18Denominator":false,"clusterUTF16":cluster.utf16.count,"clusterNativeCharacters":cluster.count,"bodyCount":view.units.count,"bodyUTF16":utf16,"idsCorrect":idsCorrect,"prefixChecks":prefixValid,"textsPreserved":textsCorrect,"inkPreserved":inksCorrect,"nativeDecodedViewReencodedBytes":bytes,"guardBudgetBytes":417792,"newGuardBytes":524288,"sendErrors":errors,"sendErrorCount":errors.count,"firstSendError":errors.first ?? [:],"checksFailed":checks,"passed":checks.isEmpty,"actualWindow":false,"actualNativeIME":false,"GPUOperations":0,"logsContainText":false]
  try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output,options:.withoutOverwriting)
  bridge.destroy()
  print("Known JSON boundary: body=\(view.units.count), UTF16=\(utf16), decoded-view reencoded=\(bytes) B, sendErrors=\(errors.count), failures=\(checks.count)")
  if !checks.isEmpty {exit(1)}
 }
}
