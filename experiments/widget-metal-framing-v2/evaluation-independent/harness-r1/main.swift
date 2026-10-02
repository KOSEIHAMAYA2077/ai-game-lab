import Foundation
import simd

// Independent CPU projection oracle, not a renderer. The production framing
// function is compiled unchanged from the frozen snapshot beside this file.
struct Pose {
    var center: SIMD3<Double>
    var plane: [SIMD3<Double>]
}
struct Extent {
    var left = Double.infinity, right = -Double.infinity
    var top = Double.infinity, bottom = -Double.infinity
    var nearBad = 0, farBad = 0, viewportBad = 0, finiteBad = 0
    var vertices = 0
    mutating func add(_ point: SIMD3<Double>, distance: Double, width: Double, height: Double) {
        vertices += 1
        let z = distance - point.z
        if !point.x.isFinite || !point.y.isFinite || !point.z.isFinite || !z.isFinite || z <= 0 {
            finiteBad += 1; return
        }
        if z < 0.1 { nearBad += 1 }
        if z > 100 { farBad += 1 }
        let projection = height / (2 * tan(Double.pi * 43 / 360))
        let x = width / 2 + point.x * projection / z
        let y = height / 2 - point.y * projection / z
        left = min(left, x); right = max(right, x)
        top = min(top, y); bottom = max(bottom, y)
        if x < 0 || x > width || y < 0 || y > height { viewportBad += 1 }
    }
    func minimumMargin(_ width: Double, _ height: Double) -> Double {
        min(left, width - right, top, height - bottom)
    }
    func verticalMargin(_ height: Double) -> Double { min(top, height-bottom) }
    func horizontalMargin(_ width: Double) -> Double { min(left, width-right) }
}
func rotated(_ p: SIMD3<Double>, _ angleX: Double, _ angleY: Double) -> SIMD3<Double> {
    let y = SIMD3<Double>(cos(angleY)*p.x+sin(angleY)*p.z,p.y,-sin(angleY)*p.x+cos(angleY)*p.z)
    return [y.x,cos(angleX)*y.y-sin(angleX)*y.z,sin(angleX)*y.y+cos(angleX)*y.z]
}
func frame(_ shape: MetalShape, material ab: SIMD2<Float>, _ time: Double, _ seed: UInt32) -> MetalSurfaceFrame {
    let a = Double(ab.x), b = Double(ab.y)
    if shape == .sphere { return metalReferenceSphere(a:a,b:b,time:time,seed:seed) }
    if shape == .cube { return metalReferenceCube(a:a,b:b,time:time,seed:seed) }
    let phase=Double(metalHash(seed &+ 43))/4_294_967_296*2*Double.pi
    let q=2*b-1,base=a*4*Double.pi+time*0.13
    let u=base+0.48*q*sin(base/2+time*0.061+phase)+0.19*sin(2*base-time*0.071+phase)
    let drift=0.35*sin(u/2+time*0.09+phase)+0.12*sin(1.5*u-time*0.057+phase)
    let w=0.47*(q+drift)/(1+q*drift)
    return metalReferenceMobius(u:u,w:w,time:time)
}
func blendAt(_ since: Double) -> Double {
    let p = min(1,max(0,since/1.6)); return p*p*(3-2*p)
}
func poses(ids: [Int], seed: UInt32, shape: MetalShape, previous: MetalShape,
           time: Double, since: Double, formation: Double, angleX: Double, angleY: Double) -> [Pose] {
    let blend = blendAt(since), n = ids.count
    let density = min(1,max(0,(log2(Double(max(1,n)))-4)/5))
    let alignment = 0.98*density*density*(3-2*density)
    let quad = [SIMD2<Double>(-0.5,-0.5),[0.5,-0.5],[-0.5,0.5],[0.5,0.5]]
    return ids.map { id in
        let ab = metalMaterial(id,seed)
        var current = frame(shape,material:ab,time,seed)
        current.u = simd_normalize(current.u)
        current.v -= current.u * simd_dot(current.u,current.v)
        if simd_length_squared(current.v)<1e-20 {
            let a: SIMD3<Double> = abs(current.u.x)<0.8 ? [1,0,0] : [0,1,0]
            current.v = a-current.u*simd_dot(current.u,a)
        }
        current.v = simd_normalize(current.v)
        var center = current.p * formation * (shape == .sphere ? 1.2 : 1)
        if blend < 1 && shape != previous {
            let old = frame(previous,material:ab,time-since,seed).p * formation * (previous == .sphere ? 1.2 : 1)
            center = old+(center-old)*blend
        }
        if n == 1 { center = [0.018*sin(time*1.3),0.024*sin(time*0.9),0.012*sin(time)] }
        let phase = id == 0 ? 0 : Double(metalUnit(UInt32(truncatingIfNeeded:id) &* 2_654_435_761 &+ seed) * 2 * .pi)
        let pulse = 1+0.06*sin(time*0.19+phase),roll=0.12*sin(time*0.13+phase*1.3)
        let pitch=0.15*sin(time*0.17+phase),yaw=phase+time*(0.09+0.025*sin(phase))
        let planes = quad.map { point -> SIMD3<Double> in
            let q = point*pulse,c=cos(roll),s=sin(roll)
            let on = SIMD2<Double>(c*q.x-s*q.y,s*q.x+c*q.y)
            var free = SIMD3<Double>(q.x,cos(pitch)*q.y,sin(pitch)*q.y)
            free = [cos(yaw)*free.x+sin(yaw)*free.z,free.y,-sin(yaw)*free.x+cos(yaw)*free.z]
            free = [c*free.x-s*free.y,s*free.x+c*free.y,free.z]
            let tangent = current.u*on.x+current.v*on.y
            let plane = free+(tangent-free)*(alignment*blend)
            return rotated(plane,angleX,angleY)
        }
        return Pose(center:rotated(center,angleX,angleY),plane:planes)
    }
}
func extent(_ poses: [Pose], count: Int, scale: Double, focus: Double, distance: Double,
            width: Double, height: Double) -> Extent {
    let baseSize=max(0.065,0.145/pow(max(1,Double(count)/80),0.10))
    let projectionScale=height/(2*tan(Double.pi*43/360))
    let size=baseSize+(104*distance/projectionScale/scale-baseSize)*focus
    var result=Extent()
    for glyph in poses {
        for plane in glyph.plane {
            result.add(glyph.center*scale+plane*scale*size,distance:distance,width:width,height:height)
        }
    }
    return result
}
func originalDistance(_ shape: MetalShape, scale: Double, formation: Double, width: Double, height: Double) -> Double {
    let fit=max(1,0.93/(width/height)),mobiusFit=shape == .mobius ? 1+0.2*formation : 1
    return (3.8+(scale-1)*4.1+0.7*formation)*fit*mobiusFit
}
let args=CommandLine.arguments
guard args.count == 2 else { fatalError("Expected a new absolute output directory") }
let output=URL(fileURLWithPath:args[1],isDirectory:true)
guard output.path.hasPrefix("/"),!FileManager.default.fileExists(atPath:output.path) else { fatalError("Output exists") }
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
let casesURL=output.appendingPathComponent("cases.csv")
FileManager.default.createFile(atPath:casesURL.path,contents:nil)
let csv=try FileHandle(forWritingTo:casesURL)
try csv.write(contentsOf:Data("group,stored,drawn,seed,shape,previous,time,since,angle_x,angle_y,width,height,scale,formation,seed_focus,v1_distance,v2_distance,v1_min_margin,v2_min_margin,v2_horizontal_margin,v2_vertical_margin,v1_viewport_bad,v2_viewport_bad,v2_near_bad,v2_far_bad,v2_nonfinite\n".utf8))
var caseCount=0,vertexCount=0,oldBadCases=0,newBadCases=0,newSafeMarginFailures=0,finiteBad=0,nearBad=0,farBad=0
var worstOld=Double.infinity,worstNew=Double.infinity,worstH=Double.infinity,worstV=Double.infinity
var examples=[[String:Any]](),farExamples=[[String:Any]]()
let times: [Double]=[0,24,100,186,900,3600,18000,28800]
let angles:[SIMD2<Double>]=[[0.12,-0.25],[0,0],[Double.pi/2,0],[0,Double.pi/2],[0.4,1.6],[-0.8,3.4]]
let sizes:[SIMD2<Double>]=[[300,340],[400,440],[300,900],[900,340],[300,1200]]
func evaluate(group:String,stored:Int,ids:[Int],seed:UInt32,shape:MetalShape,previous:MetalShape,
              time:Double,since:Double,turn:SIMD2<Double>,scale:Double,formation:Double,focus:Double,
              dimensions:[SIMD2<Double>],diagnostic:Bool=false) throws {
    let angleX=turn.x+0.09*sin(time*0.038),angleY=turn.y+time*0.03
    let surface=poses(ids:ids,seed:seed,shape:shape,previous:previous,time:time,since:since,formation:formation,angleX:angleX,angleY:angleY)
    for size in dimensions {
        let width=size.x,height=size.y,n=ids.count
        let d1=originalDistance(shape,scale:scale,formation:formation,width:width,height:height)
        let bound=Double(MetalCameraFraming.minimumDistance(count:n,scale:Float(scale),formation:Float(formation),seedFocus:Float(focus),width:Float(width),height:Float(height),shape:shape,previous:previous,sinceSwitch:Float(since)))
        let d2=max(d1,bound)
        let old=extent(surface,count:n,scale:scale,focus:focus,distance:d1,width:width,height:height)
        let new=extent(surface,count:n,scale:scale,focus:focus,distance:d2,width:width,height:height)
        let om=old.minimumMargin(width,height),nm=new.minimumMargin(width,height),hm=new.horizontalMargin(width),vm=new.verticalMargin(height)
        let number: (Double)->String={String(format:"%.9g",$0)}
        let values=[group,String(stored),String(n),String(seed),String(shape.rawValue),String(previous.rawValue)]+[time,since,angleX,angleY,width,height,scale,formation,focus,d1,d2,om,nm,hm,vm].map(number)+[String(old.viewportBad),String(new.viewportBad),String(new.nearBad),String(new.farBad),String(new.finiteBad)]
        try csv.write(contentsOf:Data((values.joined(separator:",")+"\n").utf8))
        let record:[String:Any]=["group":group,"stored":stored,"drawn":n,"seed":seed,"shape":shape.rawValue,"previous":previous.rawValue,"time":time,"since":since,"turnX":turn.x,"turnY":turn.y,"width":width,"height":height,"v1Distance":d1,"v2Distance":d2,"v1Margin":om,"v2Margin":nm,"v2HorizontalMargin":hm,"v2VerticalMargin":vm,"v2FarVertices":new.farBad]
        if diagnostic { if new.farBad>0 && farExamples.count<12 {farExamples.append(record)}; continue }
        caseCount += 1;vertexCount += new.vertices
        if old.viewportBad>0 {oldBadCases += 1;if examples.count<12 && shape == .mobius && n==1536 && width==400 && height==440 {examples.append(record)}}
        if new.viewportBad>0 {newBadCases += 1}
        if hm<15.99 || vm<39.99 {newSafeMarginFailures += 1}
        finiteBad += new.finiteBad;nearBad += new.nearBad;farBad += new.farBad
        worstOld=min(worstOld,om);worstNew=min(worstNew,nm);worstH=min(worstH,hm);worstV=min(worstV,vm)
    }
}
for stored in [1,2,8,24,80,256,512,1536,32000] {
    let ids=MetalMatter.fixture(count:stored).displayed().map(\.id),n=ids.count
    let scale=1+0.22*log2(1+Double(max(0,n-1))/64)
    let formation=1-exp(-sqrt(Double(max(0,n-1))/30)),focus=exp(-Double(max(0,n-1))/18)
    for seed:UInt32 in [1,37,UInt32.max] { for shape in MetalShape.allCases { for time in times {for turn in angles {
        try evaluate(group:"settled",stored:stored,ids:ids,seed:seed,shape:shape,previous:shape,time:time,since:100,turn:turn,scale:scale,formation:formation,focus:focus,dimensions:sizes)
    }}}}
}
for n in [2,256,1536] {
    let ids=Array(0..<n),scale=1+0.22*log2(1+Double(max(0,n-1))/64)
    let formation=1-exp(-sqrt(Double(max(0,n-1))/30)),focus=exp(-Double(max(0,n-1))/18)
    for seed:UInt32 in [1,37] {for shape in MetalShape.allCases {for previous in MetalShape.allCases where previous != shape {for time:Double in [24,186,900] {for since:Double in [0,0.05,0.4,0.8,1.2,1.6] {for turn in angles {
        try evaluate(group:"morph",stored:n,ids:ids,seed:seed,shape:shape,previous:previous,time:time,since:since,turn:turn,scale:scale,formation:formation,focus:focus,dimensions:Array(sizes.prefix(4)))
    }}}}}}
}
for n in [1,2,1536] {for formation:Double in [0,0.05,0.25,0.5,1] {for focus:Double in [0,0.5,1] {for shape in MetalShape.allCases {
    try evaluate(group:"easing-state",stored:n,ids:Array(0..<n),seed:37,shape:shape,previous:.mobius,time:186,since:0.8,turn:[0.4,1.6],scale:2.1,formation:formation,focus:focus,dimensions:sizes)
}}}}
for time in times {for turn in angles {
    try evaluate(group:"extreme-tall-diagnostic",stored:1536,ids:Array(0..<1536),seed:1,shape:.mobius,previous:.mobius,time:time,since:100,turn:turn,scale:1+0.22*log2(1+1535/64.0),formation:1-exp(-sqrt(1535/30.0)),focus:0,dimensions:[[300,2160],[300,3000]],diagnostic:true)
}}
try csv.close()
var radiusMax=[Double](repeating:0,count:3)
for time in times {for seed:UInt32 in [1,37,UInt32.max] {for shape in MetalShape.allCases {for i in 0..<2048 {
    let f=frame(shape,material:metalMaterial(i,seed),time,seed)
    let radius=simd_length(f.p)*(shape == .sphere ? 1.2 : 1)
    radiusMax[shape.rawValue]=max(radiusMax[shape.rawValue],radius)
}}}}
let analyticSphere=1.2,analyticCube=pow(3,0.5-1/12.0),analyticMobius=hypot(1.58+0.47*1.18,0.47*1.18+0.34)
let report:[String:Any]=["scope":"independent-double-CPU-projection-not-GPU-not-window","settledBodyOnly":true,"defaultZoom":1,"intakeExcluded":true,"manualZoomBelowOneExcluded":true,"productionMSLUnchanged":true,"actualMaterialCoordinatesFloat32":true,"oracleSurfaceArithmetic":"frozen-Double-reference-port-materials-rounded-to-Float32","productionFramingArithmetic":"frozen-v2-Float32-function","safeMarginsPixels":["horizontal":16,"vertical":40],"caseCount":caseCount,"projectedVerticesPerVersion":vertexCount,"v1ViewportBadCases":oldBadCases,"v2ViewportBadCases":newBadCases,"v2SafeMarginFailedCases":newSafeMarginFailures,"v2NonfiniteVertices":finiteBad,"v2NearClippedVertices":nearBad,"v2FarClippedVertices":farBad,"v1WorstPixelMargin":worstOld,"v2WorstPixelMargin":worstNew,"v2MinimumHorizontalMargin":worstH,"v2MinimumVerticalMargin":worstV,"observedRadiusMaxima":radiusMax,"analyticRadiusBounds":[analyticSphere,analyticCube,analyticMobius],"productionRadiusBounds":[1.2,1.59,2.32],"v1Mobius400x440ClippingExamples":examples,"extremeTallFarPlaneExamples":farExamples,"fullCases":"cases.csv"]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);try data.write(to:output.appendingPathComponent("report.json"),options:.atomic)
print(String(data:data,encoding:.utf8)!)
