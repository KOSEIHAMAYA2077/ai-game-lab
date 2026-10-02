import Foundation
var assertions=0
func check(_ condition:@autoclosure()->Bool,_ message:String) {assertions+=1;if !condition(){fputs("FAIL: \(message)\n",stderr);exit(1)}}
@main struct GPUCheck {
    static func main() throws {
        guard CommandLine.arguments.count==3 else{throw MetalLabError.invalidArgument}
        var report=try metalGPUValidation(shaderURL:URL(fileURLWithPath:CommandLine.arguments[1]),outputDirectory:URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true))
        report["assertions"]=assertions
        print(String(data:try JSONSerialization.data(withJSONObject:report,options:[.sortedKeys,.prettyPrinted]),encoding:.utf8)!)
    }
}
