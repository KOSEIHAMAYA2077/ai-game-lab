import Foundation
import MetalKit
import simd

func metalWordGPUCheck(shaderURL: URL, fixtureURL: URL, outputDirectory: URL) throws -> [String: Any] {
    let fixture = try JSONDecoder().decode(WordTSFixture.self, from: Data(contentsOf: fixtureURL))
    guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else { throw MetalLabError.unavailableDevice }
    let options = MTLCompileOptions(); options.fastMathEnabled = false
    let library = try device.makeLibrary(source: String(contentsOf: shaderURL, encoding: .utf8), options: options)
    var perShape: [String: [Double]] = [:], finiteFailures = 0, degenerateFailures = 0
    var directionDiagnostics: [[String: Any]] = []
    var referenceUndefinedDirections = ["du":0,"dv":0,"normal":0], referenceFallbackCount = 0
    func angle(_ a: SIMD3<Double>, _ b: SIMD3<Double>, _ axis: String) -> Double {
        if simd_length(b) <= 1e-12 { referenceUndefinedDirections[axis, default:0] += 1; return 0 }
        guard simd_length(a) > 1e-12 else { degenerateFailures += 1; return Double.pi }
        return acos(max(-1, min(1, simd_dot(simd_normalize(a), simd_normalize(b)))))
    }
    func webBasis(_ frame: MetalSurfaceFrame) -> MetalSurfaceFrame {
        let u = simd_normalize(frame.u)
        var v = frame.v - u * simd_dot(u,frame.v)
        if simd_length(v) < 1e-10 {
            referenceFallbackCount += 1
            let axis = abs(u.x) < 0.8 ? SIMD3<Double>(1,0,0) : SIMD3<Double>(0,1,0)
            v = axis - u * simd_dot(u,axis)
        }
        return MetalSurfaceFrame(p:frame.p,u:u,v:simd_normalize(v))
    }
    func compare(_ functionName: String, _ inputs: [MetalValidationInput], _ expected: [MetalSurfaceFrame], _ names: [String]) throws {
        guard let function = library.makeFunction(name: functionName),
            let input = inputs.withUnsafeBytes({ device.makeBuffer(bytes: $0.baseAddress!, length: $0.count, options: .storageModeShared) }),
            let output = device.makeBuffer(length: inputs.count * MemoryLayout<MetalValidationOutput>.stride, options: .storageModeShared),
            let command = queue.makeCommandBuffer(), let encoder = command.makeComputeCommandEncoder() else { throw MetalLabError.bufferFailure }
        let pipeline = try device.makeComputePipelineState(function: function)
        encoder.setComputePipelineState(pipeline); encoder.setBuffer(input, offset: 0, index: 0); encoder.setBuffer(output, offset: 0, index: 1)
        encoder.dispatchThreads(MTLSize(width: inputs.count, height: 1, depth: 1), threadsPerThreadgroup: MTLSize(width: min(64, pipeline.maxTotalThreadsPerThreadgroup), height: 1, depth: 1))
        encoder.endEncoding(); command.commit(); command.waitUntilCompleted()
        check(command.status == .completed, "authored surface GPU kernel completes")
        let raw = output.contents().bindMemory(to: MetalValidationOutput.self, capacity: inputs.count)
        for i in inputs.indices {
            let p = SIMD3<Double>(Double(raw[i].p.x), Double(raw[i].p.y), Double(raw[i].p.z))
            let u = SIMD3<Double>(Double(raw[i].u.x), Double(raw[i].u.y), Double(raw[i].u.z))
            let v = SIMD3<Double>(Double(raw[i].v.x), Double(raw[i].v.y), Double(raw[i].v.z))
            if !(0..<3).allSatisfy({ p[$0].isFinite && u[$0].isFinite && v[$0].isFinite }) { finiteFailures += 1; continue }
            let e = expected[i]
            let values = [simd_length(p - e.p), simd_length(u - e.u), simd_length(v - e.v),
                          angle(u, e.u, "du"), angle(v, e.v, "dv"), angle(simd_cross(u, v), simd_cross(e.u, e.v), "normal")]
            if values[3] > 0.03 || values[4] > 0.03 || values[5] > 0.06 {
                let cross = simd_cross(e.u,e.v), condition = simd_length(cross)/(simd_length(e.u)*simd_length(e.v))
                directionDiagnostics.append(["group":names[i],"index":i,"inputMaterialTime":[inputs[i].materialTime.x,inputs[i].materialTime.y,inputs[i].materialTime.z,inputs[i].materialTime.w],"idOrPart":inputs[i].identity.z,"seed":inputs[i].identity.y,"values":values,"expectedP":[e.p.x,e.p.y,e.p.z],"expectedU":[e.u.x,e.u.y,e.u.z],"expectedV":[e.v.x,e.v.y,e.v.z],"gpuU":[u.x,u.y,u.z],"gpuV":[v.x,v.y,v.z],"referenceCrossLength":simd_length(cross),"referenceConditionSine":condition.isFinite ? condition : -1])
            }
            var maxima = perShape[names[i]] ?? [Double](repeating: 0, count: 6)
            for j in 0..<6 { maxima[j] = max(maxima[j], values[j]) }
            perShape[names[i]] = maxima
        }
    }
    var inputs: [MetalValidationInput] = [], expected: [MetalSurfaceFrame] = [], names: [String] = []
    for item in fixture.frames {
        let material = metalMaterial(item.id, item.seed)
        let word = metalWordPhases(time:item.time,seed:item.seed)
        inputs.append(MetalValidationInput(materialTime: [material.x, material.y, Float(item.time), 0], identity: [UInt32(item.shape), item.seed, UInt32(item.id), 0], wordSeeds:word.a,wordTime1:word.b,wordTime2:word.c,wordTime3:word.d,wordTime4:word.e))
        expected.append(MetalSurfaceFrame(p: SIMD3(item.p), u: SIMD3(item.u), v: SIMD3(item.v))); names.append("\(item.name)-material")
    }
    try compare("validateSurface", inputs, expected, names)
    inputs = []; expected = []; names = []
    for item in fixture.points {
        let word = metalWordPhases(time:item.time,seed:1)
        inputs.append(MetalValidationInput(materialTime: [Float(item.uCoord), Float(item.vCoord), Float(item.time), 0], identity: [UInt32(item.shape), 1, UInt32(item.part), 0],wordSeeds:word.a,wordTime1:word.b,wordTime2:word.c,wordTime3:word.d,wordTime4:word.e))
        expected.append(MetalSurfaceFrame(p: SIMD3(item.p), u: SIMD3(item.u), v: SIMD3(item.v))); names.append("\(item.name)-patch")
    }
    try compare("validateWordPoint", inputs, expected, names)
    let pointExpected = expected
    expected = pointExpected.map(webBasis)
    names = names.map { $0.replacingOccurrences(of:"-patch",with:"-basis") }
    try compare("validateWordBasis", inputs, expected, names)
    let passed = finiteFailures == 0 && degenerateFailures == 0 && perShape.values.allSatisfy { $0[0] <= 0.002 && $0[3] <= 0.03 && $0[4] <= 0.03 && $0[5] <= 0.06 }
    let report: [String: Any] = ["status": passed ? "passed" : "failed", "device": device.name,
        "framesCompared": fixture.frames.count, "pointsCompared": fixture.points.count, "sourceSHA256": fixture.sourceSHA256,
        "columns": ["positionL2", "rawDuL2", "rawDvL2", "duAngleRad", "dvAngleRad", "normalAngleRad"],
        "directionDiagnostics": directionDiagnostics, "butterflyAnalyticDifferential": true,
        "referenceUndefinedDirections":referenceUndefinedDirections,"referenceFallbackCount":referenceFallbackCount,
        "singularPolicy":"Reference direction length <= 1e-12 is undefined, reported separately; actual normalized GPU basis must match Web Gram-Schmidt with perpendicular fallback at projected-v length < 1e-10, including singular cases.",
        "basisPointsCompared":fixture.points.count,
        "perShapeMaximum": perShape, "finiteFailures": finiteFailures, "degenerateFailures": degenerateFailures,
        "thresholds": ["positionL2": 0.002, "duAngleRad": 0.03, "dvAngleRad": 0.03, "normalAngleRad": 0.06],
        "wordSeedAndTimePhasesReducedOnHost": true, "perGlyphGPUUpdate": true, "webGLPixelExact": false, "windowCPURAMMeasured": false]
    try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: outputDirectory.appendingPathComponent("word-gpu-report.json"), options: .withoutOverwriting)
    check(passed, "Float authored surface positions and differential directions agree with TS fixture")
    return report
}
