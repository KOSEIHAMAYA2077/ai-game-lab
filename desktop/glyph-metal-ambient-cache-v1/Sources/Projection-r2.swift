// R2 host clock guard only; original ID-derived instance expression unchanged.
import Foundation
import simd

struct AmbientUnit: Codable { let id: Int; let text: String; let ink: AmbientInk }
struct AmbientAggregate: Codable {
    let version: String; let savingOff: Bool; let bodyCount: Int; let presentedCount: Int; let shape: String
    let status: String; let reason: String; let pending: Bool; let composing: Bool; let paused: Bool; let visible: Bool; let now: Int
}
// Legacy representation is used only by the immutable baseline test class.
struct AmbientReceiverView: Codable { let aggregate: AmbientAggregate; let units: [AmbientUnit]; let presentedCount: Int; let shape: String }
struct AmbientCacheMetadata: Codable {
    let cacheVersion: String; let receiverSession: String; let materialGeneration: Int; let nextId: Int
    let bodyCount: Int; let presentedCount: Int; let shape: String; let aggregate: AmbientAggregate
}
struct AmbientCacheDelta: Codable {
    let cacheVersion: String; let receiverSession: String; let materialGeneration: Int; let nextId: Int
    let bodyCount: Int; let afterId: Int; let units: [AmbientUnit]
}
struct AmbientCacheUpdate {
    let metadata: AmbientCacheMetadata; let delta: AmbientCacheDelta?
    var aggregate: AmbientAggregate { metadata.aggregate }
}
struct AmbientGlyphView {
    let text: String; let id: Int; let born: Double; let ink: AmbientInk?
    let intakeSeed: UInt32; let inputIndex: Int
}

// Volatile rendering views only. R3 owns all material/IDs and canonical input state.
final class AmbientProjection {
    static let cacheVersion = "ambient.cache.transport.v1"
    let seed: UInt32 = 1
    var time: Double = 0
    var shape: AmbientShape = .sphere
    private(set) var glyphs: [AmbientGlyphView] = []
    private(set) var bodyCount = 0
    private(set) var receiverSession: String?
    private(set) var observedAt: Int?
    private var stagedViews: [AmbientUnit] = []
    private(set) var validatedUnits = 0
    private(set) var metadataUpdates = 0
    private(set) var projectionUpdates = 0

    func bindSession(_ session: String) throws {
        guard receiverSession == nil, stagedViews.isEmpty, glyphs.isEmpty,
              (1...64).contains(session.utf8.count), session.utf8.allSatisfy({ ($0 >= 65 && $0 <= 90) || ($0 >= 97 && $0 <= 122) || ($0 >= 48 && $0 <= 57) || $0 == 45 || $0 == 95 }) else { throw AmbientLabError.invalidProjection }
        receiverSession = session
    }
    static func mappedShape(_ label: String) -> AmbientShape? {
        switch label { case "sphere": return .sphere; case "box": return .cube; case "ring": return .mobius; default: return nil }
    }
    @discardableResult func apply(_ update: AmbientCacheUpdate) throws -> Bool {
        let m = update.metadata
        guard m.cacheVersion == Self.cacheVersion, m.receiverSession == receiverSession,
              m.bodyCount >= bodyCount, m.bodyCount <= 256, m.materialGeneration == m.bodyCount, m.nextId == m.bodyCount + 1,
              m.presentedCount >= glyphs.count, m.presentedCount <= m.bodyCount,
              m.aggregate.savingOff, m.aggregate.now >= 0, m.aggregate.now <= 9_007_199_254_740_991,
              m.aggregate.now >= (observedAt ?? 0), m.aggregate.bodyCount == m.bodyCount,
              m.aggregate.presentedCount == m.presentedCount, m.aggregate.shape == m.shape,
              let mapped = Self.mappedShape(m.shape) else { throw AmbientLabError.invalidProjection }
        let expectedAdded = m.bodyCount - bodyCount
        let incoming: [AmbientUnit]
        if let d = update.delta {
            guard expectedAdded > 0, d.cacheVersion == m.cacheVersion, d.receiverSession == m.receiverSession,
                  d.materialGeneration == m.materialGeneration, d.nextId == m.nextId,
                  d.bodyCount == m.bodyCount, d.afterId == bodyCount, d.units.count == expectedAdded else { throw AmbientLabError.invalidProjection }
            for (i, unit) in d.units.enumerated() {
                guard unit.id == bodyCount + i + 1, !unit.text.isEmpty, unit.text.utf16.count <= 256,
                      [.blue, .white, .green, .purple].contains(unit.ink) else { throw AmbientLabError.invalidProjection }
            }
            incoming = d.units
        } else {
            guard expectedAdded == 0 else { throw AmbientLabError.invalidProjection }
            incoming = []
        }
        // Verify the complete update before changing any visible or staged cache.
        stagedViews.append(contentsOf: incoming)
        validatedUnits += incoming.count
        let oldCount = glyphs.count
        for unit in stagedViews.prefix(m.presentedCount).dropFirst(oldCount) {
            glyphs.append(AmbientGlyphView(text: unit.text, id: unit.id, born: time, ink: unit.ink,
                intakeSeed: UInt32(unit.id) &* 2_654_435_761 &+ seed, inputIndex: unit.id - 1))
        }
        bodyCount = m.bodyCount; shape = mapped; observedAt = m.aggregate.now
        metadataUpdates += 1
        if glyphs.count != oldCount { projectionUpdates += 1 }
        return glyphs.count != oldCount
    }
    var placeholder: Bool { glyphs.isEmpty }
    // Read-only audit view for artificial tests. No canonical write or persistence API.
    var renderingUnits: [AmbientUnit] { stagedViews }
}

struct AmbientGlyphInstance {
    var atlasRect: SIMD4<Float>; var ink: SIMD4<Float>; var material: SIMD4<Float>; var source: SIMD4<Float>; var identity: SIMD4<UInt32>
}
// Exactly the existing renderer's ID-derived instance expression.
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
