import Foundation
import AppKit
import MetalKit
import simd
@main struct DensityGPU {
    static func main() throws {
        guard CommandLine.arguments.count==3 else {throw MetalLabError.invalidArgument}
        let output=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
        let shader=URL(fileURLWithPath:CommandLine.arguments[1])
        guard let device=MTLCreateSystemDefaultDevice(),let queue=device.makeCommandQueue() else {throw MetalLabError.unavailableDevice}
        let view=MTKView(frame:NSRect(x:0,y:0,width:400,height:440),device:device)
        let renderer=try GlyphMetalRenderer(view:view,matter:MetalMatter.fixture(count:1),shaderURL:shader)
        var records=[[String:Any]](),failures=0
        let started=ProcessInfo.processInfo.systemUptime
        for (shape,period) in [(MetalShape.fish,4.8),(.bird,6.0),(.snake,7.6)] {
            for n in [1,2,385,1536] {for step in 0..<4 {for mixed in [false,true] {
                let time=period*Double(step)/4
                var matter=MetalMatter.fixture(count:n,shape:shape);matter.state.time=time
                // This suite isolates settled body pose. Original fixture adds
                // at time zero; shifting render time backwards would test intake.
                for i in matter.glyphs.indices {matter.glyphs[i].born=time-20}
                if mixed {for i in max(1,n/4)..<n {matter.glyphs[i].ink = .blue}}
                renderer.matter=matter;renderer.previousShape=shape;try renderer.rebuild()
                let scale:Float=1+0.22*log2(1+Float(max(0,n-1))/64),formation:Float=1-exp(-sqrt(Float(max(0,n-1))/30)),focus:Float=exp(-Float(max(0,n-1))/18)
                let original:Float=3.8+(scale-1)*4.1+0.7*formation
                let distance=max(original,MetalCameraFraming.minimumDistance(count:n,scale:scale,formation:formation,seedFocus:focus,width:400,height:440,shape:shape,previous:shape,sinceSwitch:100))
                let far=MetalCameraFraming.farDistance(distance:distance,count:n,scale:scale,formation:formation,seedFocus:focus,height:440,shape:shape,previous:shape,sinceSwitch:100)
                let f:Float=1/tan(Float.pi*43/360),near:Float=0.1,projection=simd_float4x4(columns:([f/(400/440.0),0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
                var translation=matrix_identity_float4x4;translation.columns.3.z = -distance
                let density=min(1,max(0,(log2(Float(max(1,n)))-4)/5)),alignment=0.98*density*density*(3-2*density)
                let base=max(0.065,0.145/pow(max(1,Float(n)/80),0.10)),projectionScale:Float=440/(2*tan(Float.pi*43/360)),size=base+(104*distance/projectionScale/scale-base)*focus
                for (rotationIndex,angles) in [(Float(0),Float(0)),(0.4,0.8),(1.1,2.4)].enumerated() {
                    try autoreleasepool {
                        let ax=angles.0,ay=angles.1
                        let rx=simd_float4x4(columns:([1,0,0,0],[0,cos(ax),sin(ax),0],[0,-sin(ax),cos(ax),0],[0,0,0,1]))
                        let ry=simd_float4x4(columns:([cos(ay),0,-sin(ay),0],[0,1,0,0],[sin(ay),0,cos(ay),0],[0,0,0,1]))
                        let word=metalWordPhases(time:time,seed:1)
                        var uniforms=MetalUniforms(viewProjection:projection*translation,rotation:rx*ry,body:[Float(time),scale,formation,size],params:[distance,alignment,-100,0.09],mode:[UInt32(shape.rawValue),UInt32(shape.rawValue),UInt32(n),1],wordSeeds:word.a,wordTime1:word.b,wordTime2:word.c,wordTime3:word.d,wordTime4:word.e)
                        var rig=metalCreatureUniforms(shape:shape,previous:shape,time:time,switchedAt:-100,seed:1)
                        let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:400,height:440,mipmapped:false);descriptor.storageMode = .shared;descriptor.usage = [.renderTarget,.shaderRead]
                        guard let texture=device.makeTexture(descriptor:descriptor),let command=queue.makeCommandBuffer() else {throw MetalLabError.bufferFailure}
                        let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=texture;pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store;pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,1)
                        guard let encoder=command.makeRenderCommandEncoder(descriptor:pass) else {throw MetalLabError.bufferFailure}
                        encoder.setRenderPipelineState(renderer.pipeline);encoder.setCullMode(.none);encoder.setVertexBytes(&uniforms,length:MemoryLayout<MetalUniforms>.stride,index:0);encoder.setVertexBuffer(renderer.instanceBuffer,offset:0,index:1);encoder.setVertexBytes(&rig,length:MemoryLayout<MetalCreatureUniforms>.stride,index:2);encoder.setFragmentTexture(renderer.atlas.texture,index:0)
                        encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:6,instanceCount:n);encoder.endEncoding();command.commit();command.waitUntilCompleted()
                        var bytes=[UInt8](repeating:0,count:400*440*4);bytes.withUnsafeMutableBytes{texture.getBytes($0.baseAddress!,bytesPerRow:1600,from:MTLRegionMake2D(0,0,400,440),mipmapLevel:0)}
                        var lit=0,blue=0,bounds=[400,440,0,0]
                        for y in 0..<440 {for x in 0..<400 {let i=(y*400+x)*4,b=Double(bytes[i]),g=Double(bytes[i+1]),r=Double(bytes[i+2]);if max(b,g,r)>8 {lit+=1;bounds=[min(bounds[0],x),min(bounds[1],y),max(bounds[2],x),max(bounds[3],y)]};if b>1.5*g && b>2*r && b>8 {blue+=1}}}
                        let passed=command.status == .completed && lit>10 && bounds[0]>2 && bounds[1]>2 && bounds[2]<398 && bounds[3]<438 && (!mixed || n<385 || blue>10)
                        if !passed {failures+=1}
                        records.append(["shape":shape.rawValue,"count":n,"time":time,"step":step,"rotation":rotationIndex,"mixedInk":mixed,"litPixels":lit,"bluePixels":blue,"bounds":bounds,"cameraDistance":distance,"drawCalls":1,"metalCompleted":command.status == .completed,"passed":passed])
                        if n==1536 && rotationIndex==0 && (!mixed || step==1) {
                            let image=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:400,pixelsHigh:440,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bitmapFormat:[],bytesPerRow:1600,bitsPerPixel:32)!
                            for i in stride(from:0,to:bytes.count,by:4) {image.bitmapData![i]=bytes[i+2];image.bitmapData![i+1]=bytes[i+1];image.bitmapData![i+2]=bytes[i];image.bitmapData![i+3]=bytes[i+3]}
                            try image.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent("\(shape.rawValue)-\(step)-\(mixed ? "mixed":"white").png"),options:.withoutOverwriting)
                        }
                    }
                }
            }}}
        }
        let report:[String:Any]=["status":failures==0 ? "passed":"failed","runs":records.count,"failures":failures,"records":records,"device":device.name,"elapsedWallSeconds":ProcessInfo.processInfo.systemUptime-started,"elapsedIsNotProcessCPU":true,"actualWindowTested":false,"powerMeasured":false]
        let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]);try data.write(to:output.appendingPathComponent("density-report.json"),options:.withoutOverwriting)
        print("\(records.count) offscreen density/pose/ink cases; failures=\(failures)")
        if failures>0 {exit(1)}
    }
}
