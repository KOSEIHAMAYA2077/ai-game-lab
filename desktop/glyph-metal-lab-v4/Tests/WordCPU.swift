import Foundation
import simd

struct WordTSFrame: Decodable {
    var shape: Int; var name: String; var id: Int; var seed: UInt32; var time: Double
    var p: [Double]; var u: [Double]; var v: [Double]
}
struct WordTSPoint: Decodable {
    var shape: Int; var name: String; var time: Double; var part: Int
    var uCoord: Double; var vCoord: Double; var p: [Double]; var u: [Double]; var v: [Double]
}
struct WordTSFixture: Decodable {
    var schema: Int; var source: String; var sourceSHA256: String
    var frames: [WordTSFrame]; var points: [WordTSPoint]
}
func metalWordCPUCheck(fixtureURL: URL, outputDirectory: URL) throws -> [String: Any] {
    let fixture = try JSONDecoder().decode(WordTSFixture.self, from: Data(contentsOf: fixtureURL))
    var maxP = 0.0, maxU = 0.0, maxV = 0.0, finiteFailures = 0, radiiFailures = 0
    var maxima: [String: [Double]] = [:]
    func record(_ f: MetalSurfaceFrame, _ p: [Double], _ u: [Double], _ v: [Double], _ name: String) {
        if !(0..<3).allSatisfy({ f.p[$0].isFinite && f.u[$0].isFinite && f.v[$0].isFinite }) { finiteFailures += 1; return }
        var values = maxima[name] ?? [0, 0, 0]
        for axis in 0..<3 {
            values[0] = max(values[0], abs(f.p[axis] - p[axis]))
            values[1] = max(values[1], abs(f.u[axis] - u[axis]))
            values[2] = max(values[2], abs(f.v[axis] - v[axis]))
        }
        maxima[name] = values
        maxP = max(maxP, values[0]); maxU = max(maxU, values[1]); maxV = max(maxV, values[2])
    }
    for item in fixture.frames {
        let shape = MetalShape(rawValue: item.shape)!
        let f = metalReferenceFrame(shape: shape, id: item.id, time: item.time, seed: item.seed)
        record(f, item.p, item.u, item.v, item.name)
        if simd_length(f.p) > Double(MetalCameraFraming.radius(shape)) { radiiFailures += 1 }
    }
    for item in fixture.points {
        let shape = MetalShape(rawValue: item.shape)!
        let f = metalWordPointFrame(shape: shape, u: item.uCoord, v: item.vCoord, time: item.time, part: item.part)
        record(f, item.p, item.u, item.v, item.name)
        if simd_length(f.p) > Double(MetalCameraFraming.radius(shape)) { radiiFailures += 1 }
    }
    let oldText = "青い文字 é 👨‍👩‍👧‍👦"
    var matter = MetalMatter()
    _ = matter.add(oldText, repeatCount: 3, ink: .blue, intakeSeed: 42)
    let oldGlyphs = matter.glyphs.map { ($0.text, $0.id, $0.ink) }
    let originalBatches = matter.state.batches
    for shape in MetalShape.allCases {
        matter.state.shape = shape
        check(matter.glyphs.count == oldGlyphs.count, "shape switch keeps body count")
        for (i, glyph) in matter.glyphs.enumerated() {
            check(glyph.text == oldGlyphs[i].0 && glyph.id == oldGlyphs[i].1 && glyph.ink == oldGlyphs[i].2, "new shape keeps old text/ID/ink")
        }
        check(matter.state.batches == originalBatches, "shape switch keeps original batch text")
        let restored = try MetalMatter.restored(matter.state)
        check(restored.state.shape == shape && restored.state.batches == originalBatches, "new authored shape state roundtrip")
    }
    check(MetalShape.inText("剣 sword") == .sword && MetalShape.inText("花瓶 vase") == .vase && MetalShape.inText("くらげ jellyfish") == .jellyfish, "authored word shape vocabulary")
    matter.state.shape = .vase
    if let recognized = MetalShape.inText("未収録のティーポット quartz notebook") { matter.state.shape = recognized }
    check(matter.state.shape == .vase, "unknown vocabulary holds current shape")
    for shape in MetalShape.allCases.filter({$0.isWordSurface}) {
        let before = metalReferenceFrame(shape: shape, id: 29, time: 0, seed: 42)
        let after = metalReferenceFrame(shape: shape, id: 29, time: 24, seed: 42)
        check(simd_length(before.p - after.p) > 1e-4, "stable glyph material changes with time on authored surface")
    }
    for time in [0.0, 3.6, 7.2, 24, 28800] {
        for arm in 0..<8 {
            let angle = Double(arm) * 2 * Double.pi / 8
            let bell = metalWordPoint(shape: .jellyfish, u: Double(arm) / 8, v: 1, time: time, part: 0)
            let a = metalWordPoint(shape: .jellyfish, u: 0, v: 0, time: time, part: 24 + arm)
            let b = metalWordPoint(shape: .jellyfish, u: 0.5, v: 0, time: time, part: 24 + arm)
            let center = (a + b) / 2
            check(simd_length(bell - center) < 1e-12, "jellyfish arm center joins pulse-moving bell rim")
            check(angle.isFinite, "jellyfish arm index maps to finite angle")
        }
    }
    let report: [String: Any] = ["status": finiteFailures == 0 && radiiFailures == 0 && maxP < 1e-8 && maxU < 1e-8 && maxV < 1e-8 ? "passed" : "failed",
        "source": fixture.source, "sourceSHA256": fixture.sourceSHA256, "framesCompared": fixture.frames.count,
        "pointsCompared": fixture.points.count, "maximumPositionComponentError": maxP, "maximumDuComponentError": maxU,
        "maximumDvComponentError": maxV, "finiteFailures": finiteFailures, "cameraRadiusFailures": radiiFailures,
        "perShapeMaximumPUV": maxima, "unknownKeepsShape": true, "oldTextIDsInkKept": true, "osUIValidated": false]
    try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: outputDirectory.appendingPathComponent("word-cpu-report.json"), options: .withoutOverwriting)
    check(finiteFailures == 0 && radiiFailures == 0 && maxP < 1e-8 && maxU < 1e-8 && maxV < 1e-8, "Double authored surfaces agree with original TS fixture and conservative radius")
    return report
}
