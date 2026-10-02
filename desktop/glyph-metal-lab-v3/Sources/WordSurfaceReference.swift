import Foundation
import simd

// Double reference of authored word-surfaces.ts, not a learned mesh generator.
// Position and numerical differentials use the same patch and stable glyph ID.
func metalWordPoint(shape: MetalShape, u: Double, v: Double, time t: Double, part: Int) -> SIMD3<Double> {
    let a = u * 2 * Double.pi, c = cos(a), s = sin(a), b = Double.pi * v
    switch shape {
    case .vase, .hourglass:
        let y = 1.3 - 2.6 * v
        let radius = shape == .vase
            ? 0.28 + 0.63 * exp(-pow((v - 0.62) / 0.26, 2)) + 0.16 * exp(-pow((v - 0.015) / 0.065, 2))
            : 0.18 + 0.75 * pow(abs(2 * v - 1), 1.35)
        let wave = 1 + 0.035 * sin(3 * a + 4 * v + t * 0.12)
        return [radius * c * wave, y, radius * s * wave]
    case .flower:
        let r = sqrt(1 - v) * (1.02 + 0.35 * cos(5 * a))
        let cup = 0.24 * r * r + 0.10 * cos(5 * a + t * 0.10) * r
        return [r * c, r * s, cup + 0.08 * sin(t * 0.16 + 2 * a) * r]
    case .butterfly:
        if part < 2 { return [0.07 * sin(b) * c, 0.85 * cos(b), 0.06 * sin(b) * s] }
        let side = part % 2 == 0 ? -1.0 : 1.0
        let r = sqrt(1 - v), wing = 0.68 + 0.23 * sin(a) - 0.2 * cos(2 * a)
        let x = side * (0.025 + r * wing * (1 + c) * 0.74)
        let y = r * s * (1.05 + 0.19 * s)
        let flap = 0.24 * sin(t * 0.19) + 0.10 * sin(t * 0.071)
        return [x * cos(flap), y, abs(x) * sin(flap) + 0.07 * r * sin(3 * a + t * 0.13)]
    case .tree:
        if part < 9 {
            let layer = Double(part % 3), top = 1.4 - layer * 0.53
            let rise = sqrt(v), r = (0.57 + 0.2 * layer) * (0.012 + 0.988 * rise)
            let ripple = 1 + 0.025 * sin(a * 5 + t * 0.14 + v)
            return [r * c * ripple, top - 0.95 * rise, r * s * ripple]
        }
        return [0.14 * c, -0.65 - 0.8 * v, 0.14 * s]
    case .star:
        let angle = (u - floor(u)) * 2 * Double.pi
        let sector = Int(floor(angle / (Double.pi / 5))), f = angle - Double(sector) * Double.pi / 5
        let r0 = sector % 2 != 0 ? 0.53 : 1.2, r1 = sector % 2 != 0 ? 1.2 : 0.53
        let radial = r0 * r1 * sin(Double.pi / 5) / (r1 * sin(Double.pi / 5 - f) + r0 * sin(f))
        let height = 1 - 2 * v, r = sqrt(1 - height * height), z = 0.20 * height
        return [radial * r * sin(a), radial * r * cos(a), z * (1 + 0.07 * sin(t * 0.12))]
    case .helix:
        let turn = v * 2 * Double.pi * 2.2 + 0.10 * sin(t * 0.13)
        let radius = 0.66 + 0.08 * sin(v * 2 * Double.pi - t * 0.10)
        let q = radius + 0.13 * c
        return [q * cos(turn), 1.35 - 2.7 * v + 0.13 * s, q * sin(turn)]
    case .saturn:
        if part < 6 {
            let r = 0.72 * sin(b)
            return [r * c, 0.72 * cos(b), r * s]
        }
        let r = 1.05 + v * 0.45, tilt = 0.38 + 0.045 * sin(t * 0.08)
        return [r * c, r * s * sin(tilt), r * s * cos(tilt)]
    case .sword:
        if part < 7 {
            let r = pow(sin(b), 0.35)
            return [0.20 * c * r, 1.6 - 2.28 * v, 0.065 * s * r]
        }
        if part < 9 { return [0.64 - 1.28 * v, -0.65 + 0.10 * c, 0.10 * s] }
        return [0.10 * c, -0.72 - 0.68 * v, 0.10 * s]
    case .jellyfish:
        let phase = t * 2 * Double.pi / 7.2
        let pulse = pow(0.5 + 0.5 * sin(phase), 2)
        let bob = 0.055 * sin(t * 0.31) + 0.015 * sin(t * 0.12)
        if part < 24 {
            let y = 1 - v * 0.97
            let r = sqrt(1 - y * y) * (1 - 0.10 * pulse)
                * (1 + 0.015 * v * v * sin(8 * a + t * 0.14))
            return [r * c, 0.1 + 0.9 * y * (1 + 0.065 * pulse) + bob - 0.025 * v * v * pulse, r * s]
        }
        let arm = Double(part - 24), angle = arm * 2 * Double.pi / 8
        let rootY = 0.127 + 0.001755 * pulse + bob - 0.025 * pulse
        let y = rootY - v * (1.65 + 0.05 * sin(phase - v * 1.8))
        let lag = pow(v, 1.25)
        let bend = lag * (0.16 * sin(v * 5 - t * 0.70 + arm * 0.77)
            + 0.045 * sin(t * 0.19 + arm * 1.13 + v * 7))
        let radius = 0.017 + 0.014 * (1 - v)
        let r = (sqrt(1 - 0.03 * 0.03) + 0.10 * v)
            * (1 - 0.10 * pow(1 - v, 2) * pulse) * (1 + 0.015 * sin(8 * angle + t * 0.14))
        return [r * cos(angle) + bend + radius * c, y,
                r * sin(angle) + lag * 0.14 * sin(v * 4 - t * 0.45 + arm * 0.63) + radius * s]
    default:
        preconditionFailure("Not an authored word surface")
    }
}

func metalWordPointFrame(shape: MetalShape, u: Double, v: Double, time: Double, part: Int) -> MetalSurfaceFrame {
    let h = 0.00001
    let p = metalWordPoint(shape: shape, u: u, v: v, time: time, part: part)
    let du = (metalWordPoint(shape: shape, u: u + h, v: v, time: time, part: part)
        - metalWordPoint(shape: shape, u: u - h, v: v, time: time, part: part)) / (2 * h)
    var dv = (metalWordPoint(shape: shape, u: u, v: v + h, time: time, part: part)
        - metalWordPoint(shape: shape, u: u, v: v - h, time: time, part: part)) / (2 * h)
    if shape == .sword && part >= 7 && part < 9 { dv *= -1 }
    return MetalSurfaceFrame(p: p, u: du, v: dv)
}

func metalWordReferenceFrame(shape: MetalShape, id: Int, time: Double, seed: UInt32) -> MetalSurfaceFrame {
    let aaRaw = (Double(id) + Double(seed) * 0.13) * 0.618033988749895
    let bbRaw = (Double(id) + Double(seed) * 0.27) * 0.754877666246693
    let aa = aaRaw - floor(aaRaw), bb = bbRaw - floor(bbRaw)
    let part = id % (shape == .jellyfish ? 32 : shape == .butterfly ? 20 : 10)
    let u = aa + time * 0.022 + 0.055 * sin(bb * 2 * Double.pi + time * 0.073 + Double(seed))
    let v = max(0.00001, min(0.99999,
        bb + 0.065 * sin(Double.pi * bb) * sin(aa * 2 * Double.pi + time * 0.095 + Double(seed) * 0.3)))
    return metalWordPointFrame(shape: shape, u: u, v: v, time: time, part: part)
}

// Metal does not use Double in its shader. Reduce the large integer seed phases
// once on the host, not once per glyph per frame; the GPU keeps material motion.
func metalWordSeedPhases(_ seed: UInt32) -> SIMD4<Float> {
    let tau = 2 * Double.pi
    return [Float(Double(seed).truncatingRemainder(dividingBy: tau)),
            Float((Double(seed) * 0.3).truncatingRemainder(dividingBy: tau)), 0, 0]
}

struct MetalWordPhases { var a: SIMD4<Float>; var b: SIMD4<Float>; var c: SIMD4<Float>; var d: SIMD4<Float>; var e: SIMD4<Float> }
// Fixed-size, per-draw uniforms. Material drift and every surface differential
// remain on GPU. Periodic phases stay small even at t=28,800 or seed=UInt32.max.
func metalWordPhases(time: Double, seed: UInt32) -> MetalWordPhases {
    let tau = 2 * Double.pi
    func phase(_ value: Double) -> Float { Float(value.truncatingRemainder(dividingBy: tau)) }
    let drift = time * 0.022
    return MetalWordPhases(a: [Float(drift - floor(drift)), phase(time * 0.073 + Double(seed)),
                               phase(time * 0.095 + Double(seed) * 0.3), phase(time * 0.12)],
        b: [phase(time * tau / 7.2), phase(time * 0.31), phase(time * 0.14), phase(-time * 0.70)],
        c: [phase(time * 0.19), phase(-time * 0.45), 0, 0],
        d: [phase(time * 0.10), phase(time * 0.16), phase(time * 0.071), phase(time * 0.13)],
        e: [phase(time * 0.08), phase(-time * 0.10), 0, 0])
}
