import Foundation
var assertions=0
func check(_ condition:@autoclosure()->Bool,_ message:String) {assertions+=1;if !condition(){fputs("FAIL: \(message)\n",stderr);exit(1)}}
@main struct GPUCheck {
    static func main() throws {
        guard CommandLine.arguments.count==4 else{throw MetalLabError.invalidArgument}
        let words = try metalWordGPUCheck(shaderURL:URL(fileURLWithPath:CommandLine.arguments[1]),fixtureURL:URL(fileURLWithPath:CommandLine.arguments[3]),outputDirectory:URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true))
        var report=try metalGPUValidation(shaderURL:URL(fileURLWithPath:CommandLine.arguments[1]),outputDirectory:URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true))
        report["assertions"]=assertions
        report["wordSurfaces"]=words
        print(String(data:try JSONSerialization.data(withJSONObject:report,options:[.sortedKeys,.prettyPrinted]),encoding:.utf8)!)
    }
}
