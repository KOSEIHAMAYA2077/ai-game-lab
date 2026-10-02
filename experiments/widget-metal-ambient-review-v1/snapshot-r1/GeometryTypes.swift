import Foundation
import simd
// Geometry R3 enums/math only. No MetalMatter, add/split/restore/state store/word parser.
enum AmbientShape: Int, Codable, CaseIterable { case sphere, cube, mobius, sword, vase, jellyfish, flower, butterfly, tree, star, helix, hourglass, saturn, fish, bird, snake
    var label: String { ["球", "箱", "メビウス", "剣", "花瓶", "クラゲ", "花", "蝶", "木", "星", "螺旋", "砂時計", "土星", "魚", "鳥", "蛇"][rawValue] }
    var isWordSurface: Bool { rawValue >= 3 && rawValue <= 12 }
    var isCreature: Bool { rawValue >= 13 }

}
enum AmbientInk: String, Codable { case white, red, blue, yellow, green, pink, cyan, purple
    var rgb: SIMD3<Float> {
        switch self {
        case .white: return [0.94, 0.95, 0.94]
        case .red: return [1, 0.19, 0.16]
        case .blue: return [0.25, 0.48, 1]
        case .yellow: return [1, 0.85, 0.12]
        case .green: return [0.25, 1, 0.48]
        case .pink: return [1, 0.4, 0.7]
        case .cyan: return [0.15, 0.9, 1]
        case .purple: return [0.8, 0.4, 1]
        }
    }

}
func ambientHash(_ x: UInt32) -> UInt32 {
    var value = x
    value = (value ^ (value >> 16)) &* 0x21f0aaad
    value = (value ^ (value >> 15)) &* 0x735a2d97
    return value ^ (value >> 15)
}
func ambientUnit(_ x: UInt32) -> Float { Float(Double(ambientHash(x)) / 4_294_967_296) }
func ambientPhase(_ seed: UInt32, _ salt: UInt32) -> Float { ambientUnit(seed &+ salt) * 2 * .pi }
func ambientMaterial(_ id: Int, _ seed: UInt32) -> SIMD2<Float> {
    let a = (Double(id) + Double(seed) * 0.13) * 0.618033988749895
    let b = (Double(id) + Double(seed) * 0.27) * 0.754877666246693
    return [Float(a - floor(a)), Float(b - floor(b))]
}

enum AmbientLabError: Error { case invalidProjection, invalidArgument, unavailableDevice, missingShader, atlasFull, bufferFailure, bridgeFailure }
