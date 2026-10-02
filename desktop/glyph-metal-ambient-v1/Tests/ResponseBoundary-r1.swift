import Foundation

// Artificial maximum operation-local grapheme accumulation; never native input.
@main struct ResponseBoundary {
    static func main() throws {
        guard CommandLine.arguments.count==3 else {throw AmbientLabError.invalidArgument}
        let bridge=try AmbientReceiverBridge(bundleURL:URL(fileURLWithPath:CommandLine.arguments[1]))
        _=try bridge.send(["op":"init","at":0])
        let cluster="A"+String(repeating:"\u{20d0}",count:255)
        var failures=[[String:Any]](), lastSuccessfulBody=0
        for i in 1...256 {
            for command in [["op":"commit","at":i*2-1,"base":"","value":cluster,"text":cluster,"range":[0,0]] as [String:Any], ["op":"observe","at":i*2,"value":""]] {
                do {lastSuccessfulBody=try bridge.send(command).aggregate.bodyCount}
                catch {failures.append(["cycle":i,"op":command["op"]!,"error":"bridgeFailure"])}
            }
        }
        do {lastSuccessfulBody=try bridge.send(["op":"advance","at":10000]).aggregate.bodyCount}
        catch {failures.append(["cycle":256,"op":"advance","error":"bridgeFailure"])}
        let current=try bridge.current()
        let size=try JSONEncoder().encode(current).count
        let sameIDs=current.units.map(\.id)==Array(1...256)
        let unitSizes=current.units.map{$0.text.utf16.count}
        let bodyUTF16=unitSizes.reduce(0,+)
        let pass=failures.isEmpty && current.units.count==256 && sameIDs && unitSizes.allSatisfy{$0==256} && bodyUTF16==65536
        let output:[String:Any]=["version":"native-json-response-boundary-r1","passed":pass,"bodyUnits":current.units.count,"bodyUtf16":bodyUTF16,"unitUtf16Min":unitSizes.min() ?? 0,"unitUtf16Max":unitSizes.max() ?? 0,"sequentialIDs":sameIDs,"responseEncodedBytes":size,"lastSuccessfulBodyCount":lastSuccessfulBody,"sendFailures":failures,"noRealText":true,"actualNativeWindow":false,"actualNativeIME":false,"resourceMeasured":false]
        try JSONSerialization.data(withJSONObject:output,options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:CommandLine.arguments[2]),options:.withoutOverwriting)
        print("Artificial response boundary: units=\(current.units.count), bytes=\(size), sendFailures=\(failures.count)")
        bridge.destroy()
        if !pass {exit(1)}
    }
}
