import Foundation
import MetalKit
import simd
func metalCreatureGPUCheck(shaderURL:URL,fixtureURL:URL,outputDirectory:URL)throws->[String:Any] {
    let fixture=try JSONDecoder().decode(CreatureTSFixture.self,from:Data(contentsOf:fixtureURL))
    guard let device=MTLCreateSystemDefaultDevice(),let queue=device.makeCommandQueue() else {throw MetalLabError.unavailableDevice}
    let options=MTLCompileOptions();options.fastMathEnabled=false
    let library=try device.makeLibrary(source:String(contentsOf:shaderURL,encoding:.utf8),options:options)
    guard let function=library.makeFunction(name:"validateCreature") else {throw MetalLabError.missingShader}
    let pipeline=try device.makeComputePipelineState(function:function)
    struct Row {var input:MetalValidationInput;var expected:MetalSurfaceFrame;var name:String;var shape:MetalShape;var time:Double;var seed:UInt32}
    var groups:[String:[Row]]=[:],perShape:[String:[Double]]=[:],finite=0,undefined=["du":0,"dv":0,"normal":0],fallback=0,degenerate=0,diagnostics:[[String:Any]]=[]
    func add(_ row:Row) {let key="\(row.shape.rawValue):\(row.time):\(row.seed)";groups[key,default:[]].append(row)}
    for r in fixture.frames {let material=metalMaterial(r.id,r.seed);add(Row(input:MetalValidationInput(materialTime:[material.x,material.y,Float(r.time),0],identity:[UInt32(r.shape),r.seed,UInt32(r.id),0]),expected:MetalSurfaceFrame(p:SIMD3(r.p),u:SIMD3(r.u),v:SIMD3(r.v)),name:r.name+"-material",shape:MetalShape(rawValue:r.shape)!,time:r.time,seed:r.seed))}
    for r in fixture.points {
        let input=MetalValidationInput(materialTime:[Float(r.uCoord),Float(r.vCoord),Float(r.time),0],identity:[UInt32(r.shape),1,UInt32(r.part),1]),e=MetalSurfaceFrame(p:SIMD3(r.p),u:SIMD3(r.u),v:SIMD3(r.v))
        add(Row(input:input,expected:e,name:r.name+"-patch",shape:MetalShape(rawValue:r.shape)!,time:r.time,seed:1))
        var b=e;b.u=simd_normalize(e.u);b.v=e.v-b.u*simd_dot(b.u,e.v)
        if simd_length(b.v)<1e-10 {fallback+=1;let a=abs(b.u.x)<0.8 ? SIMD3<Double>(1,0,0):SIMD3<Double>(0,1,0);b.v=a-b.u*simd_dot(b.u,a)}
        b.v=simd_normalize(b.v);var basis=input;basis.identity.w=2
        add(Row(input:basis,expected:b,name:r.name+"-basis",shape:MetalShape(rawValue:r.shape)!,time:r.time,seed:1))
    }
    func angle(_ a:SIMD3<Double>,_ b:SIMD3<Double>,_ axis:String)->Double {
        if simd_length(b)<=1e-12 {undefined[axis,default:0]+=1;return 0}
        if simd_length(a)<=1e-12 {degenerate+=1;return Double.pi}
        return acos(max(-1,min(1,simd_dot(simd_normalize(a),simd_normalize(b)))))
    }
    for key in groups.keys.sorted() {
        let rows=groups[key]!,first=rows[0];var rig=metalCreatureUniforms(shape:first.shape,previous:first.shape,time:first.time,switchedAt:first.time,seed:first.seed),inputs=rows.map(\.input)
        guard let input=inputs.withUnsafeBytes({device.makeBuffer(bytes:$0.baseAddress!,length:$0.count,options:.storageModeShared)}),let output=device.makeBuffer(length:rows.count*MemoryLayout<MetalValidationOutput>.stride,options:.storageModeShared),let command=queue.makeCommandBuffer(),let encoder=command.makeComputeCommandEncoder() else {throw MetalLabError.bufferFailure}
        encoder.setComputePipelineState(pipeline);encoder.setBuffer(input,offset:0,index:0);encoder.setBuffer(output,offset:0,index:1);encoder.setBytes(&rig,length:MemoryLayout<MetalCreatureUniforms>.stride,index:2)
        encoder.dispatchThreads(MTLSize(width:rows.count,height:1,depth:1),threadsPerThreadgroup:MTLSize(width:min(64,pipeline.maxTotalThreadsPerThreadgroup),height:1,depth:1));encoder.endEncoding();command.commit();command.waitUntilCompleted();check(command.status == .completed,"creature same-palette GPU kernel completes")
        let raw=output.contents().bindMemory(to:MetalValidationOutput.self,capacity:rows.count)
        for i in rows.indices {
            let r=rows[i],p=SIMD3<Double>(Double(raw[i].p.x),Double(raw[i].p.y),Double(raw[i].p.z)),u=SIMD3<Double>(Double(raw[i].u.x),Double(raw[i].u.y),Double(raw[i].u.z)),v=SIMD3<Double>(Double(raw[i].v.x),Double(raw[i].v.y),Double(raw[i].v.z)),e=r.expected
            if !(0..<3).allSatisfy({p[$0].isFinite && u[$0].isFinite && v[$0].isFinite}) {finite+=1;continue}
            let values=[simd_length(p-e.p),simd_length(u-e.u),simd_length(v-e.v),angle(u,e.u,"du"),angle(v,e.v,"dv"),angle(simd_cross(u,v),simd_cross(e.u,e.v),"normal")]
            if values[0]>0.002 || values[3]>0.03 || values[4]>0.03 || values[5]>0.06 {diagnostics.append(["group":r.name,"time":r.time,"identity":[r.input.identity.x,r.input.identity.y,r.input.identity.z,r.input.identity.w],"uv":[r.input.materialTime.x,r.input.materialTime.y],"values":values,"expectedU":[e.u.x,e.u.y,e.u.z],"expectedV":[e.v.x,e.v.y,e.v.z],"gpuU":[u.x,u.y,u.z],"gpuV":[v.x,v.y,v.z]])}
            var maxima=perShape[r.name] ?? [Double](repeating:0,count:6);for j in 0..<6 {maxima[j]=max(maxima[j],values[j])};perShape[r.name]=maxima
        }
    }
    let passed=finite==0 && degenerate==0 && diagnostics.isEmpty
    let report:[String:Any]=["status":passed ? "passed":"failed","device":device.name,"framesCompared":fixture.frames.count,"pointsCompared":fixture.points.count,"basisPointsCompared":fixture.points.count,"paletteDispatchGroups":groups.count,"finiteFailures":finite,"degenerateFailures":degenerate,"referenceUndefinedDirections":undefined,"referenceBasisFallbackCount":fallback,"perShapeMaximum":perShape,"columns":["positionL2","rawDuL2","rawDvL2","duAngleRad","dvAngleRad","normalAngleRad"],"directionDiagnostics":diagnostics,"fixedRigUniformBytes":MemoryLayout<MetalCreatureUniforms>.stride,"perGlyphPoseCPU":false,"rawDerivativeStepCPU":1e-5,"rawDerivativeStepGPU":NSNull(),"gpuDifferential":"analytic rest + LBS weight gradient; triangle central seam chart","triangleCentralChartStepGPU":1e-5,"thresholds":["positionL2":0.002,"duAngleRad":0.03,"dvAngleRad":0.03,"normalAngleRad":0.06],"actualWindowTested":false,"cpuRAMMeasured":false]
    try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:outputDirectory.appendingPathComponent("creature-gpu-report.json"),options:.withoutOverwriting)
    check(passed,"creature Float geometry and regular differential directions agree with original TS")
    return report
}
