import Foundation
import simd
struct CreaturePaletteCase: Decodable { var name:String;var shape:Int;var time:Double?;var matrices:[Double];var joints:[Double] }
struct CreatureInfluenceCase: Decodable {var name:String;var shape:Int;var part:Int;var v:Double;var point:[Double];var indices:[Int];var weights:[Double]}
struct CreatureRestCase:Decodable {var name:String;var shape:Int;var point:[Double];var p:[Double]}
struct CreatureTSFixture:Decodable {var frames:[WordTSFrame];var points:[WordTSPoint];var palettes:[CreaturePaletteCase];var influences:[CreatureInfluenceCase];var restChecks:[CreatureRestCase]}
func metalCreatureCPUCheck(fixtureURL:URL,outputDirectory:URL)throws->[String:Any] {
    let fixture=try JSONDecoder().decode(CreatureTSFixture.self,from:Data(contentsOf:fixtureURL))
    var maxPalette=0.0,maxJoint=0.0,maxWeight=0.0,maxRest=0.0,maxP=0.0,maxU=0.0,maxV=0.0,finite=0,radii=0,indices=0
    var perShape:[String:[Double]]=[:],poseCache:[String:MetalCreaturePose]=[:]
    func pose(_ shape:MetalShape,_ t:Double)->MetalCreaturePose {let key="\(shape.rawValue):\(t)";if let cached=poseCache[key] {return cached};let p=metalCreaturePose(shape,time:t);poseCache[key]=p;return p}
    for r in fixture.palettes {
        let p=metalCreaturePose(MetalShape(rawValue:r.shape)!,time:r.time)
        for i in p.matrices.indices {for c in 0..<4 {for row in 0..<4 {maxPalette=max(maxPalette,abs(Double(p.matrices[i][c][row])-r.matrices[i*16+c*4+row]))}};for row in 0..<3 {maxJoint=max(maxJoint,abs(Double(p.joints[i][row])-r.joints[i*3+row]))}}
    }
    for r in fixture.influences {
        let shape=MetalShape(rawValue:r.shape)!,p=SIMD3<Double>(r.point),a=metalCreatureInfluences(shape,part:r.part,v:r.v,point:p)
        if a.indices != r.indices {indices+=1}
        if abs(a.weights.reduce(0,+)-1)>1e-12 || a.weights.contains(where:{$0<0 || $0>1}) || a.indices.contains(where:{$0<0 || $0>=metalCreatureDefinitions(shape).count}) {indices+=1}
        for j in 0..<3 {maxWeight=max(maxWeight,abs(a.weights[j]-r.weights[j]))}
    }
    for r in fixture.restChecks {let s=MetalShape(rawValue:r.shape)!,p=metalCreatureSkin(s,part:32,v:0.61,point:SIMD3<Double>(r.point),pose:metalCreaturePose(s,time:nil));for j in 0..<3 {maxRest=max(maxRest,abs(p[j]-r.p[j]))}}
    func record(_ f:MetalSurfaceFrame,_ p:[Double],_ u:[Double],_ v:[Double],_ name:String,_ shape:MetalShape) {
        if !(0..<3).allSatisfy({f.p[$0].isFinite && f.u[$0].isFinite && f.v[$0].isFinite}) {finite+=1;return}
        var errors=perShape[name] ?? [0,0,0]
        for j in 0..<3 {errors[0]=max(errors[0],abs(f.p[j]-p[j]));errors[1]=max(errors[1],abs(f.u[j]-u[j]));errors[2]=max(errors[2],abs(f.v[j]-v[j]))}
        perShape[name]=errors;maxP=max(maxP,errors[0]);maxU=max(maxU,errors[1]);maxV=max(maxV,errors[2])
        if simd_length(f.p)>Double(MetalCameraFraming.radius(shape))+1e-8 {radii+=1}
    }
    for r in fixture.frames {let s=MetalShape(rawValue:r.shape)!,f=metalCreatureReferenceFrame(shape:s,id:r.id,time:r.time,seed:r.seed);record(f,r.p,r.u,r.v,r.name,s)}
    for r in fixture.points {let s=MetalShape(rawValue:r.shape)!,f=metalCreaturePointFrame(s,u:r.uCoord,v:r.vCoord,time:r.time,part:r.part,pose:pose(s,r.time));record(f,r.p,r.u,r.v,r.name,s)}
    let passed=maxP<=1e-8 && maxPalette<=1e-6 && maxWeight<=1e-12 && maxRest<=1e-8 && finite==0 && radii==0 && indices==0
    let report:[String:Any]=["status":passed ? "passed":"failed","framesCompared":fixture.frames.count,"pointsCompared":fixture.points.count,"palettesCompared":fixture.palettes.count,"influencesCompared":fixture.influences.count,"restChecks":fixture.restChecks.count,"maximumPositionComponentError":maxP,"maximumDuComponentError":maxU,"maximumDvComponentError":maxV,"maximumPaletteComponentError":maxPalette,"maximumJointComponentError":maxJoint,"maximumWeightError":maxWeight,"maximumRestError":maxRest,"finiteFailures":finite,"radiusFailures":radii,"influenceFailures":indices,"perShapeMaximumPUV":perShape,"paletteQuantizedFloat32":true,"originalTSDirectTeacher":true,"osUIValidated":false]
    try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:outputDirectory.appendingPathComponent("creature-cpu-report.json"),options:.withoutOverwriting)
    check(passed,"original creature position/palette/weights/rest/finite/camera gate")
    check(MemoryLayout<MetalCreatureUniforms>.stride==1200,"fixed rig uniform stride")
    let bank=MetalCreatureUniformBank()
    for _ in 0..<5 {_=bank.uniforms(shape:.bird,previous:.fish,time:24,switchedAt:20,seed:42)}
    check(bank.currentUpdates==1 && bank.previousUpdates==1,"same paused time reuses both fixed palettes")
    for t in [24.1,24.2,24.3] {_=bank.uniforms(shape:.bird,previous:.fish,time:t,switchedAt:20,seed:42)}
    check(bank.currentUpdates==4 && bank.previousUpdates==1,"only current pose updates while switch pose remains frozen")
    for t in [25.0,25.1] {_=bank.uniforms(shape:.sphere,previous:.sphere,time:t,switchedAt:25,seed:42)}
    check(bank.currentUpdates==4 && bank.previousUpdates==1,"old non-rig shapes do not calculate bone poses")
    for shape in [MetalShape.fish,.bird,.snake] {
        let a=metalCreaturePose(shape,time:nil),b=metalCreaturePose(shape,time:0)
        check(zip(a.matrices,b.matrices).contains(where:{$0 != $1}),"time zero is animated pose, distinct from rest")
        let aFrame=metalCreatureReferenceFrame(shape:shape,id:46,time:0,seed:42),bFrame=metalCreatureReferenceFrame(shape:shape,id:46,time:2,seed:42)
        check(simd_length(aFrame.p-bFrame.p)>1e-4,"stable material/part changes with original rig motion")
        var matter=MetalMatter.fixture(count:385);matter.state.shape=shape
        if let known=MetalShape.inText("未収録の仕事メモ quartz notebook") {matter.state.shape=known}
        check(matter.state.shape==shape,"unknown input holds creature shape")
        let restored=try MetalMatter.restored(matter.state);check(restored.state.shape==shape && restored.glyphs.map(\.text)==matter.glyphs.map(\.text),"creature state roundtrip")
    }
    return report
}
