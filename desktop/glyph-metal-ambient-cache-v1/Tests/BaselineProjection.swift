import Foundation
import simd
// Original R5 projection class, namespace substitution only.
final class BaselineProjection {
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
