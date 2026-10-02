import Foundation
import JavaScriptCore
import simd

let arguments = CommandLine.arguments
guard arguments.count == 5 else { fatalError("artificial bundle, manual12, original20, new results paths required") }
let output = URL(fileURLWithPath: arguments[4], isDirectory: true)
guard !FileManager.default.fileExists(atPath: output.path) else { fatalError("preserve earlier results") }
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let context = JSContext()!
let source = try String(contentsOfFile: arguments[1], encoding: .utf8)
context.evaluateScript(source)
guard context.exception == nil else { fatalError("unsupported bundle builtin") }
let namespace = context.objectForKeyedSubscript("AmbientNativeReceiver")!
func evaluate(_ name: String, _ file: String) throws -> Data {
    let json = try String(contentsOfFile: file, encoding: .utf8)
    guard let string = namespace.objectForKeyedSubscript(name)?.call(withArguments: [json])?.toString(), context.exception == nil else { throw AmbientLabError.bridgeFailure }
    return Data(string.utf8)
}
let manual = try evaluate("evaluateManualJSON", arguments[2])
let original = try evaluate("evaluateOriginal20JSON", arguments[3])
try manual.write(to: output.appendingPathComponent("manual12.json")); try original.write(to: output.appendingPathComponent("original20.json"))
let object = try JSONSerialization.jsonObject(with: manual) as! [String: Any]
let runs = object["runs"] as! [[String: Any]]
var failures = [[String: Any]](), instanceCount = 0, frameChecks = 0
func check(_ value: Bool, _ label: String) { if !value { failures.append(["label": label]) } }
for run in runs {
    let projection = AmbientProjection()
    for trace in run["traces"] as! [[String: Any]] {
        let data = try JSONSerialization.data(withJSONObject: trace["view"]!)
        let view = try JSONDecoder().decode(AmbientReceiverView.self, from: data)
        projection.time = Double((trace["command"] as! [String: Any])["at"] as! Int) / 1000
        try projection.apply(view)
        check(projection.glyphs.count == view.presentedCount, "presented prefix")
        check(projection.glyphs.count <= 256 && projection.bodyCount <= 256, "projection finite")
        check(projection.placeholder == (view.presentedCount == 0), "placeholder material0")
        let instances = ambientInstances(projection.glyphs, seed: 1, distance: 3.8, scale: 1, height: 440, atlasRect: { _ in [0, 0, 1/32, 1] })
        check(instances.count == view.presentedCount, "no sampling/extra@ instance")
        for (i, instance) in instances.enumerated() {
            let unit = view.units[i], glyph = projection.glyphs[i]
            check(glyph.id == unit.id && glyph.text.utf16.elementsEqual(unit.text.utf16) && glyph.ink == unit.ink, "original id/literalUTF16/ink")
            check(instance.identity.x == UInt32(unit.id), "instance originalid")
            check(instance.ink.w == 1, "persistent ink alpha")
            let ref = metalMaterial(unit.id, 1)
            check(instance.material.x == ref.x && instance.material.y == ref.y, "old GeometryR3 material coordinates")
            let phase = metalUnit(UInt32(unit.id) &* 2_654_435_761 &+ 1) * 2 * Float.pi
            check(instance.material.w == phase, "old GeometryR3 id phase")
            check([instance.ink.x,instance.ink.y,instance.ink.z,instance.material.x,instance.material.y,instance.material.z,instance.material.w,instance.source.y,instance.source.w].allSatisfy(\.isFinite), "instance finite")
            instanceCount += 1
        }
    }
}
for shape in [AmbientShape.sphere, .cube, .mobius] { for time in [0.0, 3.0, 21.0] { for id in 1...256 {
    let frame = ambientReferenceFrame(shape: shape, id: id, time: time, seed: 1)
    check([frame.p.x,frame.p.y,frame.p.z,frame.u.x,frame.u.y,frame.u.z,frame.v.x,frame.v.y,frame.v.z].allSatisfy(\.isFinite), "original basis finite")
    check(simd_length(frame.u) > 1e-9 && simd_length(simd_cross(frame.u,frame.v)) > 1e-9, "basis nonsingular")
    if shape == .sphere { check(abs(simd_length(frame.p)-1) < 1e-9, "sphere base radius before shader1.2") }
    if shape == .cube { check(abs(pow(abs(frame.p.x),12)+pow(abs(frame.p.y),12)+pow(abs(frame.p.z),12)-1) < 1e-9, "cube L12=1") }
    frameChecks += 1
} } }
let originalObject = try JSONSerialization.jsonObject(with: original) as! [String: Any]
let summary: [String: Any] = ["scope": "CPU JSC/readonly renderprojection only; no Metal device/GPU/window/nativeIME/resource", "manualPassed": object["passed"]!, "original20Passed": originalObject["passed"]!, "instanceChecks": instanceCount, "geometryFrameChecks": frameChecks, "instanceStride": MemoryLayout<AmbientGlyphInstance>.stride, "failures": failures, "projectionCPU": failures.isEmpty]
let bytes = try JSONSerialization.data(withJSONObject: summary, options: [.sortedKeys, .prettyPrinted]); try bytes.write(to: output.appendingPathComponent("summary.json"))
FileHandle.standardOutput.write(bytes); FileHandle.standardOutput.write(Data([10]))
if !failures.isEmpty || object["passed"] as? Int != 12 || originalObject["passed"] as? Int != 20 { exit(1) }
