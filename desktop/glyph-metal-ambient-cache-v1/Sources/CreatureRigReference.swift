// Geometry R3 read-only reference copied with namespace substitution only.
import Foundation
import simd

// Direct CPU reference of authoredSurfacePoint + CreatureRig. Runtime uses only
// the fixed-size pose; glyph positions, weights and differentials stay on GPU.
struct AmbientCreatureJoint { var parent: Int; var bind: SIMD3<Double> }
func ambientCreatureDefinitions(_ shape: AmbientShape) -> [AmbientCreatureJoint] {
    let values: [(Int, SIMD3<Double>)]
    switch shape {
    case .fish: values = [(-1,[0.35,0,0]),(0,[-0.20,0,0]),(1,[-0.68,0,0]),(2,[-1.18,0,0])]
    case .bird: values = [(-1,[0,0,0]),(0,[0,0.39,0]),(0,[-0.20,0.20,0]),(2,[-0.72,0.28,0]),(0,[0.20,0.20,0]),(4,[0.72,0.28,0]),(0,[0,-0.49,0])]
    case .snake: values = (0..<9).map { i in let v=Double(i)/8,a=v*2*Double.pi*1.3; return (i-1,[0.51*cos(a),1.1-2.3*v,0.18*sin(a)]) }
    default: values = []
    }
    return values.map { AmbientCreatureJoint(parent:$0.0,bind:$0.1) }
}
private func creatureCompose(_ position: SIMD3<Double>, _ e: SIMD3<Double>) -> simd_double4x4 {
    let c1=cos(e.x/2),c2=cos(e.y/2),c3=cos(e.z/2),s1=sin(e.x/2),s2=sin(e.y/2),s3=sin(e.z/2)
    let x=s1*c2*c3+c1*s2*s3,y=c1*s2*c3-s1*c2*s3,z=c1*c2*s3+s1*s2*c3,w=c1*c2*c3-s1*s2*s3
    let x2=x+x,y2=y+y,z2=z+z,xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2
    return simd_double4x4(columns:([1-(yy+zz),xy+wz,xz-wy,0],[xy-wz,1-(xx+zz),yz+wx,0],[xz+wy,yz-wx,1-(xx+yy),0],[position.x,position.y,position.z,1]))
}
// Explicit multiplication retains Three's summation order before Float32 storage.
private func creatureMultiply(_ a: simd_double4x4,_ b: simd_double4x4)->simd_double4x4 {
    var out=simd_double4x4()
    for col in 0..<4 { for row in 0..<4 { out[col][row]=a[0][row]*b[col][0]+a[1][row]*b[col][1]+a[2][row]*b[col][2]+a[3][row]*b[col][3] } }
    return out
}
struct AmbientCreaturePose { var matrices: [simd_float4x4]; var joints: [SIMD3<Float>] }
func ambientCreaturePose(_ shape: AmbientShape, time: Double?) -> AmbientCreaturePose {
    let definitions=ambientCreatureDefinitions(shape)
    var rotations=[SIMD3<Double>](repeating:.zero,count:definitions.count),bob=0.0
    if let t=time {
        if shape == .fish {
            let phase=t*2*Double.pi/4.8
            rotations[0].y = 0.018*sin(phase);rotations[1].y = 0.065*sin(phase-0.35)
            rotations[2].y = 0.21*sin(phase-0.75);rotations[3].y = 0.09*sin(phase-1.05)
        } else if shape == .bird {
            let phase=t*2*Double.pi/6,flap = 0.38*sin(phase),wrist = 0.11*sin(phase-0.55)
            bob = 0.028*sin(phase-0.3);rotations[0].y = 0.025*sin(t*0.31);rotations[1].x = 0.035*sin(t*0.52)
            rotations[2].z = -flap;rotations[3].z = -wrist;rotations[4].z=flap;rotations[5].z=wrist;rotations[6].x = 0.075*sin(phase-0.8)
        } else if shape == .snake {
            let phase=t*2*Double.pi/7.6
            for i in rotations.indices { let a=Double(i)/8,k=Double(i);rotations[i]=[(0.008+0.035*a)*sin(phase-k*0.58),(0.008+0.07*a)*sin(phase-k*0.64),(0.008+0.045*a)*sin(phase-k*0.69)] }
        }
    }
    var world=[simd_double4x4](),rest=[simd_double4x4](),matrices=[simd_float4x4](),joints=[SIMD3<Float>]()
    for (i,joint) in definitions.enumerated() {
        let parent=joint.parent<0 ? SIMD3<Double>.zero:definitions[joint.parent].bind
        let local=joint.bind-parent
        var current=local;if i==0 {current.y+=bob}
        let r=creatureCompose(local,.zero),c=creatureCompose(current,rotations[i])
        rest.append(joint.parent<0 ? r:creatureMultiply(rest[joint.parent],r))
        world.append(joint.parent<0 ? c:creatureMultiply(world[joint.parent],c))
        // Rest is translation only. Three's inverse bind world is its inverse.
        var inverse=matrix_identity_double4x4;inverse.columns.3 = [-rest[i][3].x,-rest[i][3].y,-rest[i][3].z,1]
        let p=creatureMultiply(world[i],inverse)
        matrices.append(simd_float4x4(columns:(SIMD4<Float>(p[0]),SIMD4<Float>(p[1]),SIMD4<Float>(p[2]),SIMD4<Float>(p[3]))))
        joints.append([Float(world[i][3].x),Float(world[i][3].y),Float(world[i][3].z)])
    }
    return AmbientCreaturePose(matrices:matrices,joints:joints)
}
func ambientCreatureInfluences(_ shape:AmbientShape,part:Int,v:Double,point:SIMD3<Double>)->(indices:[Int],weights:[Double]) {
    func smooth(_ x:Double)->Double {let q=max(0,min(1,x));return q*q*(3-2*q)}
    var indices=[0,0,0],weights=[1.0,0,0]
    if shape == .bird {
        if part>=16 && part<28 {indices[0]=1}
        else if part>=58 {indices[1]=6;weights[1]=smooth((-point.y-0.42)/0.25);weights[0]=1-weights[1]}
        else if part>=28 {let shoulder=part%2==1 ? 4:2,d=abs(point.x),a=smooth((d-0.13)/0.30),tip=smooth((d-0.64)/0.45);indices=[0,shoulder,shoulder+1];weights=[1-a,a*(1-tip),a*tip]}
    } else if shape == .fish {
        let anchors=[0.35,-0.20,-0.68,-1.18],i=point.x >= -0.20 ? 0:point.x >= -0.68 ? 1:2
        indices=[i,i+1,0];weights[1]=smooth((anchors[i]-point.x)/(anchors[i]-anchors[i+1]));weights[0]=1-weights[1]
    } else if shape == .snake && part<58 {
        let at=max(0,min(1,v))*8,i=min(7,Int(floor(at)));indices=[i,i+1,0];weights[1]=smooth(at-Double(i));weights[0]=1-weights[1]
    }
    return (indices,weights)
}
func ambientCreatureRestPoint(_ shape:AmbientShape,u:Double,v:Double,part:Int)->SIMD3<Double> {
    let a=u*2*Double.pi,c=cos(a),s=sin(a),b=Double.pi*v,p=part%64
    func ellipsoid(_ center:SIMD3<Double>,_ radii:SIMD3<Double>)->SIMD3<Double> {let q=acos(1-2*v),r=sin(q);return center+radii*SIMD3(r*c,cos(q),r*s)}
    func triangle(_ points:[SIMD2<Double>],_ z:Double)->SIMD3<Double> {
        let q=(u-floor(u))*3,i=Int(floor(q)),f=q-Double(i),r=sqrt(v)
        let center=(points[0]+points[1]+points[2])/3,edge=points[i]+(points[(i+1)%3]-points[i])*f,result=center+(edge-center)*r
        return [result.x,result.y,z]
    }
    if shape == .fish {
        if p<45 {return ellipsoid([0.1,0,0],[0.94,0.45,0.29])}
        if p<58 {return triangle([[-0.68,0],[-1.36,0.64],[-1.36,-0.64]],p%2==1 ? 0.055:-0.055)}
        return [0.15-0.65*v,0.33+0.43*sin(b)*abs(c),0.065*s*sin(b)]
    }
    if shape == .bird {
        if p<16 {return ellipsoid([0,-0.03,0],[0.27,0.58,0.25])}
        if p<24 {return ellipsoid([0,0.61,0],[0.23,0.25,0.23])}
        if p<28 {return [0.075*c*(1-v),0.66+0.075*s*(1-v),0.22+0.31*v]}
        if p>=58 {return triangle([[-0.19,-0.49],[0.19,-0.49],[0,-1.01]],p%2==1 ? 0.047:-0.047)}
        var result=triangle([[0.18,0.23],[1.42,0.52],[0.55,-0.25]],0.05*sin(a));result.x *= p%2==1 ? 1:-1;return result
    }
    if p>=58 {return ellipsoid([0.49,1.14,0.08],[0.28,0.20,0.23])}
    let q=v*2*Double.pi*1.3,r = 0.115+0.035*(1-v)
    return [0.51*cos(q)+r*c,1.1-2.3*v,0.18*sin(q)+r*s]
}
func ambientCreatureSkin(_ shape:AmbientShape,part:Int,v:Double,point:SIMD3<Double>,pose:AmbientCreaturePose)->SIMD3<Double> {
    let influence=ambientCreatureInfluences(shape,part:part,v:v,point:point)
    var out=SIMD3<Double>.zero
    for j in 0..<3 where influence.weights[j] != 0 {
        let m=pose.matrices[influence.indices[j]]
        for row in 0..<3 {out[row]+=influence.weights[j]*(Double(m[0][row])*point.x+Double(m[1][row])*point.y+Double(m[2][row])*point.z+Double(m[3][row]))}
    }
    return out
}
func ambientCreaturePointFrame(_ shape:AmbientShape,u:Double,v:Double,time:Double,part:Int,pose given:AmbientCreaturePose?=nil)->AmbientSurfaceFrame {
    let pose=given ?? ambientCreaturePose(shape,time:time),h=1e-5
    func p(_ x:Double,_ y:Double)->SIMD3<Double> {ambientCreatureSkin(shape,part:part,v:y,point:ambientCreatureRestPoint(shape,u:x,v:y,part:part),pose:pose)}
    return AmbientSurfaceFrame(p:p(u,v),u:(p(u+h,v)-p(u-h,v))/(2*h),v:(p(u,v+h)-p(u,v-h))/(2*h))
}
func ambientCreatureReferenceFrame(shape:AmbientShape,id:Int,time:Double,seed:UInt32)->AmbientSurfaceFrame {
    let aa=(Double(id)+Double(seed)*0.13)*0.618033988749895,bb=(Double(id)+Double(seed)*0.27)*0.754877666246693,a=aa-floor(aa),b=bb-floor(bb)
    let u=a+time*0.018+0.045*sin(b*2*Double.pi+time*0.071+Double(seed))
    let v=max(1e-5,min(1-1e-5,b+0.055*sin(Double.pi*b)*sin(a*2*Double.pi+time*0.083+Double(seed)*0.3)))
    var f=ambientCreaturePointFrame(shape,u:u,v:v,time:time,part:id%64)
    if simd_length(f.u)<1e-9 {f.u=[1,0,0]};if simd_length(f.v)<1e-9 {f.v=[0,1,0]};return f
}
// Layout is 18 matrices + 3 vec4 = 1,200 bytes, a separate fixed vertex binding.
struct AmbientCreatureUniforms {
    var c0=matrix_identity_float4x4,c1=matrix_identity_float4x4,c2=matrix_identity_float4x4,c3=matrix_identity_float4x4,c4=matrix_identity_float4x4,c5=matrix_identity_float4x4,c6=matrix_identity_float4x4,c7=matrix_identity_float4x4,c8=matrix_identity_float4x4
    var p0=matrix_identity_float4x4,p1=matrix_identity_float4x4,p2=matrix_identity_float4x4,p3=matrix_identity_float4x4,p4=matrix_identity_float4x4,p5=matrix_identity_float4x4,p6=matrix_identity_float4x4,p7=matrix_identity_float4x4,p8=matrix_identity_float4x4
    var currentPhase=SIMD4<Float>.zero,previousPhase=SIMD4<Float>.zero
    var counts=SIMD4<UInt32>.zero
}
func ambientCreaturePhases(time:Double,seed:UInt32)->SIMD4<Float> {
    let tau=2*Double.pi,drift=time*0.018
    return [Float(drift-floor(drift)),Float((time*0.071+Double(seed)).truncatingRemainder(dividingBy:tau)),Float((time*0.083+Double(seed)*0.3).truncatingRemainder(dividingBy:tau)),0]
}
func ambientCreatureUniforms(shape:AmbientShape,previous:AmbientShape,time:Double,switchedAt:Double,seed:UInt32)->AmbientCreatureUniforms {
    var u=AmbientCreatureUniforms()
    let c=ambientCreaturePose(shape,time:time).matrices,p=ambientCreaturePose(previous,time:switchedAt).matrices
    // Padding matrices remain identity for non-creature and absent joints.
    withUnsafeMutableBytes(of:&u) { raw in let ptr=raw.baseAddress!.assumingMemoryBound(to:simd_float4x4.self);for i in c.indices {ptr[i]=c[i]};for i in p.indices {ptr[9+i]=p[i]} }
    u.currentPhase=ambientCreaturePhases(time:time,seed:seed);u.previousPhase=ambientCreaturePhases(time:switchedAt,seed:seed);u.counts=[UInt32(c.count),UInt32(p.count),0,0];return u
}

// Runtime has at most two palettes, with the previous pose cached at switchTime.
// No per-glyph hierarchy and no timer updates while the view is stopped.
final class AmbientCreatureUniformBank {
    private var currentShape:AmbientShape?;private var currentTime:Double?
    private var previousShape:AmbientShape?;private var previousTime:Double?
    private var current=AmbientCreaturePose(matrices:[],joints:[])
    private var previous=AmbientCreaturePose(matrices:[],joints:[])
    private(set) var currentUpdates=0,previousUpdates=0
    func uniforms(shape:AmbientShape,previous old:AmbientShape,time:Double,switchedAt:Double,seed:UInt32)->AmbientCreatureUniforms {
        if currentShape != shape || currentTime != time {
            current=ambientCreaturePose(shape,time:time);currentShape=shape;currentTime=time
            if shape.isCreature {currentUpdates+=1}
        }
        if previousShape != old || previousTime != switchedAt {
            previous=ambientCreaturePose(old,time:switchedAt);previousShape=old;previousTime=switchedAt
            if old.isCreature {previousUpdates+=1}
        }
        var u=AmbientCreatureUniforms()
        withUnsafeMutableBytes(of:&u) {raw in let ptr=raw.baseAddress!.assumingMemoryBound(to:simd_float4x4.self);for i in current.matrices.indices {ptr[i]=current.matrices[i]};for i in previous.matrices.indices {ptr[9+i]=previous.matrices[i]}}
        u.currentPhase=ambientCreaturePhases(time:time,seed:seed);u.previousPhase=ambientCreaturePhases(time:switchedAt,seed:seed)
        u.counts=[UInt32(current.matrices.count),UInt32(previous.matrices.count),0,0];return u
    }
}
