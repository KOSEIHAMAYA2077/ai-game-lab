import Foundation
import simd
// Original GeometryR3 hash/material helpers only, no Matter/storage instantiation.
func metalHash(_ x: UInt32) -> UInt32 {
    var value = x
    value = (value ^ (value >> 16)) &* 0x21f0aaad
    value = (value ^ (value >> 15)) &* 0x735a2d97
    return value ^ (value >> 15)
}
func metalUnit(_ x: UInt32) -> Float { Float(Double(metalHash(x)) / 4_294_967_296) }
func metalPhase(_ seed: UInt32, _ salt: UInt32) -> Float { metalUnit(seed &+ salt) * 2 * .pi }
func metalMaterial(_ id: Int, _ seed: UInt32) -> SIMD2<Float> {
    let a = (Double(id) + Double(seed) * 0.13) * 0.618033988749895
    let b = (Double(id) + Double(seed) * 0.27) * 0.754877666246693
    return [Float(a - floor(a)), Float(b - floor(b))]
}
