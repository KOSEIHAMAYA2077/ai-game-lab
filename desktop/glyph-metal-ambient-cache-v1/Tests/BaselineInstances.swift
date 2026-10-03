import Foundation
import simd
// Original R5 actual80B builder; function name substitution only.
func baselineInstances(_ glyphs: [AmbientGlyphView], seed: UInt32, distance: Float, scale: Float, height: Float,
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
