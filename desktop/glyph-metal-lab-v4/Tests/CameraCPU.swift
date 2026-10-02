import Foundation
import simd

// Read-only framing check: bounding spheres cover arbitrary surface orientation
// and the convex old/new center blend. Actual TS vertices check separate cases.
private struct CameraTSFixture:Decodable {var frames:[WordTSFrame]}
func metalAuthoredCameraCPUCheck(fixtureURL: URL, outputDirectory: URL, reportName:String="camera-cpu-report.json") throws -> [String: Any] {
    let fixture = try JSONDecoder().decode(CameraTSFixture.self,from:Data(contentsOf:fixtureURL))
    let sizes:[(Float,Float)] = [(300,340),(400,440),(640,400),(1000,340)]
    let tau = Double.pi * 2, tangent = tan(Float.pi*43/360)
    var combinations=0, boundFailures=0, depthFailures=0, maximumBoundRatio=0.0
    for shape in MetalShape.allCases { for previous in MetalShape.allCases {
        for count in [1,2,385,1536] { for since:Float in [0,0.2,0.8,1.6,3.8] {
            for (width,height) in sizes { for formation:Float in [0,0.73,1] {
                let scale:Float = 1+0.22*log2(1+Float(max(0,count-1))/64)
                let focus:Float = exp(-Float(max(0,count-1))/18)
                let minimum = MetalCameraFraming.minimumDistance(count:count,scale:scale,formation:formation,seedFocus:focus,width:width,height:height,shape:shape,previous:previous,sinceSwitch:since)
                // Renderer also keeps its original base-distance floor. Aspect
                // and Mobius factors are >=1, so omitting them is conservative.
                let d = max(3.8+(scale-1)*4.1+0.7*formation,minimum)
                let far = MetalCameraFraming.farDistance(distance:d,count:count,scale:scale,formation:formation,seedFocus:focus,height:height,shape:shape,previous:previous,sinceSwitch:since)
                let phase=max(0,min(1,since/1.6)),blend=phase*phase*(3-2*phase)
                let body=(MetalCameraFraming.radius(previous)*(1-blend)+MetalCameraFraming.radius(shape)*blend)*formation*scale
                let base=max(0.065,0.145/pow(max(1,Float(count)/80),0.1))
                let size=base*(1-focus)+104*d/(height/(2*tangent))/scale*focus
                let radius=body+size*1.06/sqrt(2)*scale+(count==1 ? 0.04*scale:0)
                let safe=min(tangent*(height-80)/height,tangent*(width-32)/height)
                let sine=safe/sqrt(1+safe*safe),ratio=radius/d
                if !d.isFinite || !far.isFinite || ratio>sine+1e-6 {boundFailures+=1}
                if d-radius<0.1 || d+radius>=far {depthFailures+=1}
                maximumBoundRatio=max(maximumBoundRatio,Double(ratio/sine));combinations+=1
            }}
        }}
    }}
    var projectedVertices=0, projectionFailures=0, maximumMarginNormalized=0.0
    let count=1536,scale:Double=1+0.22*log2(1+Double(count-1)/64)
    let base=max(0.065,0.145/pow(Double(count)/80,0.1))
    for item in fixture.frames {
        let shape=MetalShape(rawValue:item.shape)!,p=SIMD3<Double>(item.p)
        let x=simd_normalize(SIMD3<Double>(item.u))
        var y=SIMD3<Double>(item.v)-x*simd_dot(x,SIMD3<Double>(item.v))
        if simd_length(y)<1e-10 {let a=abs(x.x)<0.8 ? SIMD3<Double>(1,0,0):SIMD3<Double>(0,1,0);y=a-x*simd_dot(x,a)}
        y=simd_normalize(y)
        for (width,height) in sizes {
            let d=Double(MetalCameraFraming.minimumDistance(count:count,scale:Float(scale),formation:1,seedFocus:0,width:width,height:height,shape:shape,previous:shape,sinceSwitch:10))
            let far=Double(MetalCameraFraming.farDistance(distance:Float(d),count:count,scale:Float(scale),formation:1,seedFocus:0,height:height,shape:shape,previous:shape,sinceSwitch:10))
            let tanY=tan(Double.pi*43/360),tanX=tanY*Double(width/height)
            for (ax,ay) in [(0.0,0.0),(0.4,0.8),(1.1,2.4),(tau/2,tau/3)] {
                func rotate(_ v:SIMD3<Double>)->SIMD3<Double>{
                    let q=SIMD3<Double>(cos(ay)*v.x+sin(ay)*v.z,v.y,-sin(ay)*v.x+cos(ay)*v.z)
                    return SIMD3(q.x,cos(ax)*q.y-sin(ax)*q.z,sin(ax)*q.y+cos(ax)*q.z)
                }
                for sx in [-0.5,0.5] {for sy in [-0.5,0.5] {
                    let v=rotate((p+(x*sx+y*sy)*base*1.06)*scale),z=d-v.z
                    let px=abs(v.x/(z*tanX)),py=abs(v.y/(z*tanY))
                    let safeX=Double((width-32)/width),safeY=Double((height-80)/height)
                    maximumMarginNormalized=max(maximumMarginNormalized,px/safeX,py/safeY)
                    if !px.isFinite || !py.isFinite || px>safeX+1e-6 || py>safeY+1e-6 || z<=0.1 || z>=far {projectionFailures+=1}
                    projectedVertices+=1
                }}
            }
        }
    }
    let report:[String:Any] = ["status":boundFailures==0 && depthFailures==0 && projectionFailures==0 ? "passed":"failed","boundingCombinations":combinations,"boundFailures":boundFailures,"depthFailures":depthFailures,"maximumBoundRatioToAllowedSine":maximumBoundRatio,"tsMaterialFrames":fixture.frames.count,"projectedVertices":projectedVertices,"projectionFailures":projectionFailures,"maximumNormalizedMarginUse":maximumMarginNormalized,"defaultZoomOnly":true,"settledReferenceVertices":true,"intakeTrajectoriesTested":false,"actualWindowTested":false,"model":"R2 conservative sphere plus maximum pulse quad radius; 16x16 transitions, count-dependent growth/focus, four supported sizes; separately TS material vertices at 4 rotations" ]
    try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:outputDirectory.appendingPathComponent(reportName),options:.withoutOverwriting)
    check(boundFailures==0 && depthFailures==0 && projectionFailures==0,"new authored shape camera bounds and settled projected quads fit default zoom")
    return report
}
