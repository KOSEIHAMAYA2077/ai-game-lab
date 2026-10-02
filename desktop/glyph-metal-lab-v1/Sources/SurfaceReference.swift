import Foundation
import simd

// Double-precision reference port of the original surface-flow.ts. Used for
// finite geometry / differential / Möbius chart tests, not per-frame rendering.
struct MetalSurfaceFrame { var p: SIMD3<Double>; var u: SIMD3<Double>; var v: SIMD3<Double> }
func metalReferenceSphere(a: Double, b: Double, time t: Double, seed: UInt32) -> MetalSurfaceFrame {
    let angle = a * 2 * Double.pi, y = 2 * b - 1, r = sqrt(max(0, 1 - y*y))
    let c = cos(angle), s = sin(angle)
    var f = MetalSurfaceFrame(p: [r*c,y,r*s], u: [-s,0,c], v: [y*c,-r,y*s])
    func shear(_ frame: inout MetalSurfaceFrame, _ axis: Int, _ angle: Double, _ derivative: Double) {
        let i = (axis+1)%3, j = (axis+2)%3, c = cos(angle), s = sin(angle)
        let x = c*frame.p[i]-s*frame.p[j], y = s*frame.p[i]+c*frame.p[j]
        let ux = c*frame.u[i]-s*frame.u[j]-y*derivative*frame.u[axis]
        let uy = s*frame.u[i]+c*frame.u[j]+x*derivative*frame.u[axis]
        let vx = c*frame.v[i]-s*frame.v[j]-y*derivative*frame.v[axis]
        let vy = s*frame.v[i]+c*frame.v[j]+x*derivative*frame.v[axis]
        frame.p[i]=x; frame.p[j]=y; frame.u[i]=ux; frame.u[j]=uy; frame.v[i]=vx; frame.v[j]=vy
    }
    func phase(_ salt: UInt32) -> Double { Double(metalHash(seed &+ salt))/4_294_967_296*2*Double.pi }
    var q = 2.4*f.p[1]+0.075*t+phase(71)
    shear(&f, 1, 0.13*t+0.65*sin(q), 1.56*cos(q))
    q = 2.8*f.p[0]-0.063*t+phase(119)
    shear(&f, 0, 0.5*sin(q), 1.4*cos(q))
    q = 2.6*f.p[2]+0.043*t+phase(213)
    shear(&f, 2, 0.4*sin(q), 1.04*cos(q))
    return f
}
func metalReferenceCube(a: Double, b: Double, time: Double, seed: UInt32) -> MetalSurfaceFrame {
    var f = metalReferenceSphere(a:a,b:b,time:time,seed:seed)
    let powers = SIMD3<Double>(pow(f.p.x,11),pow(f.p.y,11),pow(f.p.z,11))
    let sum = simd_dot(f.p,powers), m = pow(sum,1/12.0)
    f.u = (f.u-f.p*(simd_dot(f.u,powers)/sum))/m
    f.v = (f.v-f.p*(simd_dot(f.v,powers)/sum))/m
    f.p /= m
    return f
}
func metalReferenceMobius(u: Double, w: Double, time t: Double) -> MetalSurfaceFrame {
    let a = 2*u-0.09*t, b = 3*u+0.071*t
    let theta=u+0.22*sin(a)+0.08*sin(b)
    let r=1.25+0.23*cos(2*u+0.11*t)+0.10*sin(3*u-0.073*t)
    let twist=u/2+0.65*sin(u-0.13*t)+0.22*sin(3*u+0.071*t)+0.3*sin(0.091*t)
    let width=1+0.18*sin(2*u-0.1*t)
    let cw=cos(twist),sw=sin(twist),ct=cos(theta),st=sin(theta)
    let radial=r+w*width*cw,sy=0.84+0.07*sin(0.069*t)
    let p=SIMD3<Double>(radial*ct,radial*st*sy,w*width*sw+0.22*sin(2*u+0.083*t)+0.12*cos(3*u-0.097*t))
    let thetaU=1+0.44*cos(a)+0.24*cos(b)
    let rU = -0.46*sin(2*u+0.11*t)+0.3*cos(3*u-0.073*t)
    let twistU=0.5+0.65*cos(u-0.13*t)+0.66*cos(3*u+0.071*t)
    let widthU=0.36*cos(2*u-0.1*t)
    let radialU=rU+w*(widthU*cw-width*sw*twistU)
    let du=SIMD3<Double>(radialU*ct-radial*st*thetaU,(radialU*st+radial*ct*thetaU)*sy,w*(widthU*sw+width*cw*twistU)+0.44*cos(2*u+0.083*t)-0.36*sin(3*u-0.097*t))
    let dw=SIMD3<Double>(width*cw*ct,width*cw*st*sy,width*sw)
    return MetalSurfaceFrame(p:p,u:du,v:dw)
}
func metalReferenceFrame(shape: MetalShape, id: Int, time: Double, seed: UInt32) -> MetalSurfaceFrame {
    let af=(Double(id)+Double(seed)*0.13)*0.618033988749895,bf=(Double(id)+Double(seed)*0.27)*0.754877666246693
    let a=af-floor(af),b=bf-floor(bf)
    if shape == .sphere { return metalReferenceSphere(a:a,b:b,time:time,seed:seed) }
    if shape == .cube { return metalReferenceCube(a:a,b:b,time:time,seed:seed) }
    let phase=Double(metalHash(seed &+ 43))/4_294_967_296*2*Double.pi
    let q=2*b-1,base=a*4*Double.pi+time*0.13
    let u=base+0.48*q*sin(base/2+time*0.061+phase)+0.19*sin(2*base-time*0.071+phase)
    let drift=0.35*sin(u/2+time*0.09+phase)+0.12*sin(1.5*u-time*0.057+phase)
    let w=0.47*(q+drift)/(1+q*drift)
    return metalReferenceMobius(u:u,w:w,time:time)
}
