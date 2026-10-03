// Geometry R3 read-only reference copied with namespace substitution only.
import Foundation

// Bounds apply to settled glyph quads at the default zoom. Intake paths and
// deliberate manual zoom are separate; no per-glyph CPU projection is needed.
enum AmbientCameraFraming {
    static func radius(_ shape: AmbientShape) -> Float {
        switch shape {
        case .sphere: return 1.2
        case .cube: return 1.59 // 3^(1/2 - 1/12), rounded upwards.
        case .mobius: return 2.32 // hypot(1.58 + .47*1.18, .47*1.18 + .34).
        case .sword: return 1.65 // max blade y=1.6, x=.20, z=.065.
        case .vase: return 1.75 // r <= (0.28+0.63+0.16)*1.035, |y|<=1.3.
        case .jellyfish: return 2.25 // arms: horizontal<1.396, |y|<1.667.
        case .flower: return 1.55 // r<=1.37; |z|<=.24*r*r+.18*r.
        case .butterfly: return 2.20 // horizontal<=1.7378, |y|<=1.24.
        case .tree: return 1.80 // r<=.99425, |y|<=1.45.
        case .star: return 1.23 // radial<=1.2, |z|<=.214.
        case .helix: return 1.75 // radial<=.87, |y|<=1.48.
        case .hourglass: return 1.65 // r<=.93*1.035, |y|<=1.3.
        case .fish: return 2.00 // fixed analytic rest + bounded joint displacement.
        case .bird: return 1.65 // shoulder/wrist path + patch bound + .028 bob.
        case .snake: return 2.2 // XYZ angle + active v interval proof in CAMERA-METHOD-R1.
        case .saturn: return 1.52 // ring radius<=1.5; tilt is rigid.
        }
    }

    private static func boundaryTerms(count: Int, scale: Float, formation: Float,
                                      seedFocus: Float, height: Float, shape: AmbientShape,
                                      previous: AmbientShape, sinceSwitch: Float) -> (Float, Float) {
        let h = max(1, height), tangent = tan(Float.pi * 43 / 360)
        let focus = min(1, max(0, seedFocus))
        let baseSize = max(0.065, 0.145 / pow(max(1, Float(count) / 80), 0.10))
        let quadFactor: Float = 1.06 / sqrt(2)
        let fixedQuadRadius = baseSize * (1 - focus) * quadFactor * scale
        let distanceQuadFactor = 104 / (h / (2 * tangent)) * focus * quadFactor
        let phase = min(1, max(0, sinceSwitch / 1.6))
        let blend = phase * phase * (3 - 2 * phase)
        let bodyRadius = (radius(previous) + (radius(shape) - radius(previous)) * blend)
            * formation * scale
        let seedWriggle: Float = count == 1 ? 0.04 * scale : 0
        return (bodyRadius + fixedQuadRadius + seedWriggle, distanceQuadFactor)
    }

    static func minimumDistance(count: Int, scale: Float, formation: Float, seedFocus: Float,
                                width: Float, height: Float, shape: AmbientShape,
                                previous: AmbientShape, sinceSwitch: Float) -> Float {
        let w = max(1, width), h = max(1, height)
        let tangent = tan(Float.pi * 43 / 360)
        let safeTangent = min(tangent * max(1, h - 80) / h,
                              tangent * max(1, w - 32) / h)
        let sine = safeTangent / sqrt(1 + safeTangent * safeTangent)
        let (fixedRadius, distanceFactor) = boundaryTerms(count: count, scale: scale,
            formation: formation, seedFocus: seedFocus, height: h,
            shape: shape, previous: previous, sinceSwitch: sinceSwitch)
        // At supported window sizes the denominator is positive. Tiny startup
        // layouts get a finite result; resize recomputes before the first draw.
        return fixedRadius / max(0.001, sine - distanceFactor)
    }

    static func farDistance(distance: Float, count: Int, scale: Float, formation: Float,
                            seedFocus: Float, height: Float, shape: AmbientShape,
                            previous: AmbientShape, sinceSwitch: Float) -> Float {
        let (fixedRadius, distanceFactor) = boundaryTerms(count: count, scale: scale,
            formation: formation, seedFocus: seedFocus, height: height,
            shape: shape, previous: previous, sinceSwitch: sinceSwitch)
        return max(100, distance + fixedRadius + distanceFactor * distance + 1)
    }
}
