import Foundation
import JavaScriptCore

// File/stdin I/O belongs only to the artificial CLI host. No callbacks expose it to JS.
func emit(_ object: [String: Any], _ code: Int32 = 0) -> Never {
    let bytes = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    FileHandle.standardOutput.write(bytes)
    FileHandle.standardOutput.write(Data([10]))
    exit(code)
}
guard CommandLine.arguments.count == 3 else { emit(["status": "host-error", "message": "bundle and capability-script paths required"], 2) }
let bundle: String, capabilityScript: String
do {
    bundle = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
    capabilityScript = try String(contentsOfFile: CommandLine.arguments[2], encoding: .utf8)
} catch { emit(["status": "host-error", "message": "selected artificial bundle/script could not be read"], 2) }
let input = FileHandle.standardInput.readDataToEndOfFile()
guard input.count <= 1_048_576, let inputJSON = String(data: input, encoding: .utf8) else { emit(["status": "host-error", "message": "bounded UTF8 artificial JSON required"], 2) }
guard let context = JSContext() else { emit(["status": "host-error", "message": "JSContext unavailable"], 2) }
var exception: String? = nil
context.exceptionHandler = { _, value in exception = value?.toString() ?? "unknown JavaScript exception" }
let capabilityValue = context.evaluateScript(capabilityScript)?.toString() ?? "{}"
let capabilityData = capabilityValue.data(using: .utf8) ?? Data("{}".utf8)
let capabilities = (try? JSONSerialization.jsonObject(with: capabilityData)) ?? [:]
exception = nil
context.evaluateScript(bundle)
if let error = exception { emit(["engine": "JavaScriptCore", "status": "unsupported-or-bundle-error", "phase": "bundle", "message": error, "capabilities": capabilities], 1) }
exception = nil
guard let namespace = context.objectForKeyedSubscript("AmbientJSC"), let function = namespace.objectForKeyedSubscript("evaluateJSON"), !function.isUndefined else { emit(["engine": "JavaScriptCore", "status": "bridge-missing", "capabilities": capabilities], 1) }
let output = function.call(withArguments: [inputJSON])?.toString()
if let error = exception { emit(["engine": "JavaScriptCore", "status": "execution-error", "phase": "fixture", "message": error, "capabilities": capabilities], 1) }
guard let output = output, let bytes = output.data(using: .utf8), bytes.count <= 16_777_216, let result = try? JSONSerialization.jsonObject(with: bytes) else { emit(["engine": "JavaScriptCore", "status": "result-error", "capabilities": capabilities], 1) }
emit(["engine": "JavaScriptCore", "status": "completed", "capabilities": capabilities, "result": result])
