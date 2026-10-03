import Foundation
import simd

struct AmbientUnit: Codable { let id: Int; let text: String; let ink: AmbientInk }
struct AmbientAggregate: Codable {
    let version: String; let savingOff: Bool; let bodyCount: Int; let presentedCount: Int; let shape: String
    let status: String; let reason: String; let pending: Bool; let composing: Bool; let paused: Bool; let visible: Bool; let now: Int
}
struct AmbientReceiverView: Codable { let aggregate: AmbientAggregate; let units: [AmbientUnit]; let presentedCount: Int; let shape: String }
struct AmbientGlyphView {
    let text: String; let id: Int; let born: Double; let ink: AmbientInk?
    let intakeSeed: UInt32; let inputIndex: Int
}
// This is a renderer projection, not material storage, segmentation or an ID allocator.
final class AmbientProjection {
    let seed: UInt32 = 1
    var time: Double = 0
    var shape: AmbientShape = .sphere
    private(set) var glyphs: [AmbientGlyphView] = []
    private(set) var bodyCount = 0
    static func mappedShape(_ label: String) -> AmbientShape? {
        switch label { case "sphere": return .sphere; case "box": return .cube; case "ring": return .mobius; default: return nil }
    }
    @discardableResult func apply(_ view: AmbientReceiverView) throws -> Bool {
        guard view.units.count == view.aggregate.bodyCount, view.units.count <= 256,
              view.presentedCount == view.aggregate.presentedCount, view.presentedCount >= glyphs.count,
              view.presentedCount <= view.units.count, let mapped = Self.mappedShape(view.shape), view.aggregate.savingOff else { throw AmbientLabError.invalidProjection }
        for (i, unit) in view.units.enumerated() {
            guard unit.id == i + 1, !unit.text.isEmpty, unit.text.utf16.count <= 256 else { throw AmbientLabError.invalidProjection }
            if i < glyphs.count {
                let old = glyphs[i]
                guard old.id == unit.id, old.ink == unit.ink, old.text.utf16.elementsEqual(unit.text.utf16) else { throw AmbientLabError.invalidProjection }
            }
        }
        let oldCount = glyphs.count
        for unit in view.units.prefix(view.presentedCount).dropFirst(oldCount) {
            glyphs.append(AmbientGlyphView(text: unit.text, id: unit.id, born: time, ink: unit.ink,
                intakeSeed: UInt32(unit.id) &* 2_654_435_761 &+ seed, inputIndex: unit.id - 1))
        }
        bodyCount = view.aggregate.bodyCount; shape = mapped
        return glyphs.count != oldCount
    }
    var placeholder: Bool { glyphs.isEmpty }
}
struct AmbientGlyphInstance {
    var atlasRect: SIMD4<Float>; var ink: SIMD4<Float>; var material: SIMD4<Float>; var source: SIMD4<Float>; var identity: SIMD4<UInt32>
}
// Shared by real renderer and the CPU boundary test, so testing does not use a parallel allocator.
func ambientInstances(_ glyphs: [AmbientGlyphView], seed: UInt32, distance: Float, scale: Float, height: Float,
                      atlasRect: (String) -> SIMD4<Float>) -> [AmbientGlyphInstance] {
    let projectionScale = max(1, height) / (2 * tan(Float.pi * 43 / 360))
    let birthSize = 20 * 64 / 42 * distance / projectionScale
    return glyphs.map { glyph in
        let material = ambientMaterial(glyph.id, seed), rgb = (glyph.ink ?? .white).rgb
        let phase = ambientUnit(UInt32(glyph.id) &* 2_654_435_761 &+ seed) * 2 * .pi
        return AmbientGlyphInstance(atlasRect: atlasRect(glyph.text), ink: [rgb.x, rgb.y, rgb.z, 1],
            material: [material.x, material.y, Float(glyph.born), phase], source: [0, -1.9 / scale, 0, birthSize],
            identity: [UInt32(glyph.id), glyph.intakeSeed, UInt32(glyph.inputIndex), 0])
    }
}
