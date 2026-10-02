import Foundation
import AppKit
import MetalKit
import simd

struct MetalValidationInput {var materialTime:SIMD4<Float>;var identity:SIMD4<UInt32>;var wordSeeds:SIMD4<Float> = .zero;var wordTime1:SIMD4<Float> = .zero;var wordTime2:SIMD4<Float> = .zero;var wordTime3:SIMD4<Float> = .zero;var wordTime4:SIMD4<Float> = .zero}
struct MetalValidationOutput {var p:SIMD4<Float>;var u:SIMD4<Float>;var v:SIMD4<Float>}
func metalGPUValidation(shaderURL:URL,outputDirectory:URL) throws -> [String:Any] {
    guard let device=MTLCreateSystemDefaultDevice(),let queue=device.makeCommandQueue() else {throw MetalLabError.unavailableDevice}
    let options=MTLCompileOptions();options.fastMathEnabled=false
    let started=ProcessInfo.processInfo.systemUptime
    let library=try device.makeLibrary(source:String(contentsOf:shaderURL,encoding:.utf8),options:options)
    let compileMS=(ProcessInfo.processInfo.systemUptime-started)*1000
    guard let function=library.makeFunction(name:"validateSurface") else {throw MetalLabError.missingShader}
    let pipeline=try device.makeComputePipelineState(function:function)
    var inputs:[MetalValidationInput]=[],expected:[MetalSurfaceFrame]=[]
    for seed:UInt32 in [1,42,123456,UInt32.max] {for time in [0.0,0.1,24,100,3600,28800] {for id in [0,1,2,385,1535,1664,31999] {for shape in [MetalShape.sphere, .cube, .mobius] {
        let material=metalMaterial(id,seed)
        inputs.append(MetalValidationInput(materialTime:[material.x,material.y,Float(time),0],identity:[UInt32(shape.rawValue),seed,UInt32(id),0]))
        expected.append(metalReferenceFrame(shape:shape,id:id,time:time,seed:seed))
    }}}}
    guard let input=inputs.withUnsafeBytes({device.makeBuffer(bytes:$0.baseAddress!,length:$0.count,options:.storageModeShared)}),let output=device.makeBuffer(length:inputs.count*MemoryLayout<MetalValidationOutput>.stride,options:.storageModeShared),let command=queue.makeCommandBuffer(),let encoder=command.makeComputeCommandEncoder() else {throw MetalLabError.bufferFailure}
    encoder.setComputePipelineState(pipeline);encoder.setBuffer(input,offset:0,index:0);encoder.setBuffer(output,offset:0,index:1)
    encoder.dispatchThreads(MTLSize(width:inputs.count,height:1,depth:1),threadsPerThreadgroup:MTLSize(width:min(64,pipeline.maxTotalThreadsPerThreadgroup),height:1,depth:1));encoder.endEncoding();command.commit();command.waitUntilCompleted()
    check(command.status == .completed,"GPU validation kernel completes")
    let results=output.contents().bindMemory(to:MetalValidationOutput.self,capacity:inputs.count)
    var maxP=0.0,maxU=0.0,maxV=0.0
    for i in inputs.indices {
        let raw=results[i]
        let p=SIMD3<Double>(Double(raw.p.x),Double(raw.p.y),Double(raw.p.z)),u=SIMD3<Double>(Double(raw.u.x),Double(raw.u.y),Double(raw.u.z)),v=SIMD3<Double>(Double(raw.v.x),Double(raw.v.y),Double(raw.v.z))
        check((0..<3).allSatisfy{p[$0].isFinite && u[$0].isFinite && v[$0].isFinite},"GPU finite surface and analytic tangents")
        maxP=max(maxP,simd_length(p-expected[i].p));maxU=max(maxU,simd_length(u-expected[i].u));maxV=max(maxV,simd_length(v-expected[i].v))
    }
    // Float GPU material coordinates / trigonometry are distinct from the original
    // Double map. This bound is geometry parity, not a pixel-exact WebGL claim.
    check(maxP<0.002 && maxU<0.01 && maxV<0.01,"GPU surface map stays within Float differential tolerance")
    let view=MTKView(frame:NSRect(x:0,y:0,width:400,height:440),device:device)
    let renderer=try GlyphMetalRenderer(view:view,matter:MetalMatter.fixture(count:1536),shaderURL:shaderURL)
    var renders:[[String:Any]]=[]
    for shape in MetalShape.allCases {
        renderer.matter.state.shape=shape;renderer.previousShape=shape
        try renderer.rebuild()
        let scale:Float=1+0.22*log2(1+1535/64.0),formation:Float=1-exp(-sqrt(1535/30.0)),t:Float=24
        let originalDistance=(3.8+(scale-1)*4.1+0.7*formation)*(shape == .mobius ? 1+0.2*formation:1)
        let distance=max(originalDistance,MetalCameraFraming.minimumDistance(count:1536,scale:scale,formation:formation,seedFocus:0,width:400,height:440,shape:shape,previous:shape,sinceSwitch:100))
        let ax:Float=0.12+0.09*sin(t*0.038),ay:Float = -0.25+t*0.03
        let rx=simd_float4x4(columns:([1,0,0,0],[0,cos(ax),sin(ax),0],[0,-sin(ax),cos(ax),0],[0,0,0,1]))
        let ry=simd_float4x4(columns:([cos(ay),0,-sin(ay),0],[0,1,0,0],[sin(ay),0,cos(ay),0],[0,0,0,1]))
        let f:Float=1/tan(Float.pi*43/360),near:Float=0.1,far:Float=100
        let projection=simd_float4x4(columns:([f/(400/440.0),0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
        var translation=matrix_identity_float4x4;translation.columns.3.z = -distance
        let word = metalWordPhases(time:Double(t),seed:1)
        var uniform=MetalUniforms(viewProjection:projection*translation,rotation:rx*ry,body:[t,scale,formation,max(0.065,0.145/pow(1536/80.0,0.1))],params:[distance,0.98,-100,0.09],mode:[UInt32(shape.rawValue),UInt32(shape.rawValue),1536,1],wordSeeds:word.a,wordTime1:word.b,wordTime2:word.c,wordTime3:word.d,wordTime4:word.e)
        let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:400,height:440,mipmapped:false);descriptor.storageMode = .shared;descriptor.usage = [.renderTarget,.shaderRead]
        guard let texture=device.makeTexture(descriptor:descriptor),let command=queue.makeCommandBuffer() else {throw MetalLabError.bufferFailure}
        let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=texture;pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store;pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,1)
        guard let encoder=command.makeRenderCommandEncoder(descriptor:pass) else {throw MetalLabError.bufferFailure}
        encoder.setRenderPipelineState(renderer.pipeline);encoder.setCullMode(.none);encoder.setVertexBytes(&uniform,length:MemoryLayout<MetalUniforms>.stride,index:0);encoder.setVertexBuffer(renderer.instanceBuffer,offset:0,index:1);encoder.setFragmentTexture(renderer.atlas.texture,index:0);encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:6,instanceCount:1536);encoder.endEncoding();command.commit();command.waitUntilCompleted()
        check(command.status == .completed,"3D offscreen instanced renderer completes")
        var bytes=[UInt8](repeating:0,count:400*440*4)
        bytes.withUnsafeMutableBytes{texture.getBytes($0.baseAddress!,bytesPerRow:400*4,from:MTLRegionMake2D(0,0,400,440),mipmapLevel:0)}
        var lit=0,bounds=[400,440,0,0]
        for y in 0..<440 {for x in 0..<400 {let i=(y*400+x)*4;if bytes[i]>8 || bytes[i+1]>8 || bytes[i+2]>8 {lit+=1;bounds=[min(bounds[0],x),min(bounds[1],y),max(bounds[2],x),max(bounds[3],y)]}}}
        check(lit>1000 && bounds[0]>2 && bounds[1]>2 && bounds[2]<398 && bounds[3]<438,"3D body visible with black space and no clipping")
        let image = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:400,pixelsHigh:440,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bitmapFormat:[],bytesPerRow:400*4,bitsPerPixel:32)!
        for i in stride(from:0,to:bytes.count,by:4) {image.bitmapData![i]=bytes[i+2];image.bitmapData![i+1]=bytes[i+1];image.bitmapData![i+2]=bytes[i];image.bitmapData![i+3]=bytes[i+3]}
        try image.representation(using:.png,properties:[:])!.write(to:outputDirectory.appendingPathComponent("\(shape.rawValue)-1536-t24.png"))
        renders.append(["shape":shape.rawValue,"glyphs":1536,"litPixels":lit,"bounds":bounds,"drawCalls":1,"metalStatus":"completed"])
    }
    let glyphClusters=["@","あ","é","e\u{301}","👨‍👩‍👧‍👦","🇯🇵","\u{0301}","[]","?", "漢"]
    let beforeIDs=renderer.atlas.ids
    let extra=glyphClusters.enumerated().map{MetalGlyph(text:$0.element,id:$0.offset,born:0,ink:.white,intakeSeed:0,inputIndex:0)}
    try renderer.atlas.update(extra)
    for (key,id) in beforeIDs {check(renderer.atlas.ids[key]==id,"atlas growth preserves tile identity")}
    var clusterCoverage:[String:Int]=[:]
    for cluster in glyphClusters {
        let index=renderer.atlas.ids[cluster]!,width=MetalAtlas.columns*MetalAtlas.cell,x=index%32*64,y=index/32*64
        var alphaPixels=0
        for cy in 0..<64 {for cx in 0..<64 {if renderer.atlas.bitmap[((y+cy)*width+x+cx)*4+3]>10 {alphaPixels+=1}}}
        check(alphaPixels>0,"CoreText fallback produces ink for glyph cluster")
        clusterCoverage[cluster]=alphaPixels
    }
    // Add enough kinds to trigger row growth twice; prior original glyph IDs remain.
    let grown=(0..<80).map{MetalGlyph(text:String(UnicodeScalar(0x3041+$0)!),id:$0,born:0,ink:.white,intakeSeed:0,inputIndex:0)}
    try renderer.atlas.update(grown)
    for (key,id) in beforeIDs {check(renderer.atlas.ids[key]==id,"atlas row changes retain IDs")}
    // Exercise incoming text at age zero with a deliberately different uniform
    // size. Its instance-local birth size must win and explicit old inks persist.
    var inkChecks:[[String:Any]]=[]
    let glyphUV=renderer.atlas.rectangle("@")
    for (name,ink,explicit,born) in [("blue",MetalInk.blue,true,0.0),("old-blue",MetalInk.blue,true,-20.0),("red",MetalInk.red,true,0.0),("yellow",MetalInk.yellow,true,0.0),("aged-auto",MetalInk.red,false,-20.0)] {
        let rgb=ink.rgb
        var instance=MetalGlyphInstance(atlasRect:glyphUV,ink:[rgb.x,rgb.y,rgb.z,explicit ? 1:0],material:[0.1,0.1,Float(born),0],source:[0,0,0,0.5],identity:[0,123,0,0])
        let buffer=device.makeBuffer(bytes:&instance,length:MemoryLayout<MetalGlyphInstance>.stride,options:.storageModeShared)!
        let f:Float=1/tan(Float.pi*43/360),near:Float=0.1,far:Float=100,distance:Float=3.8
        let projection=simd_float4x4(columns:([f/(400/440.0),0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
        var translation=matrix_identity_float4x4;translation.columns.3.z = -distance
        var uniform=MetalUniforms(viewProjection:projection*translation,rotation:matrix_identity_float4x4,body:[0,1,1,0.5],params:[distance,0,-100,40],mode:[0,0,1,1])
        let desc=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:400,height:440,mipmapped:false);desc.storageMode = .shared;desc.usage = .renderTarget
        let texture=device.makeTexture(descriptor:desc)!,command=queue.makeCommandBuffer()!,pass=MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture=texture;pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store;pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,1)
        let encoder=command.makeRenderCommandEncoder(descriptor:pass)!
        encoder.setRenderPipelineState(renderer.pipeline);encoder.setCullMode(.none);encoder.setVertexBytes(&uniform,length:MemoryLayout<MetalUniforms>.stride,index:0);encoder.setVertexBuffer(buffer,offset:0,index:1);encoder.setFragmentTexture(renderer.atlas.texture,index:0);encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:6,instanceCount:1);encoder.endEncoding();command.commit();command.waitUntilCompleted()
        check(command.status == .completed,"ink and birth-size shader path completes")
        var bytes=[UInt8](repeating:0,count:400*440*4)
        bytes.withUnsafeMutableBytes{texture.getBytes($0.baseAddress!,bytesPerRow:1600,from:MTLRegionMake2D(0,0,400,440),mipmapLevel:0)}
        var maxima=[0,0,0],x0=400,x1=0,count=0
        for y in 0..<440 {for x in 0..<400 {let i=(y*400+x)*4;if max(bytes[i],bytes[i+1],bytes[i+2])>10 {count+=1;x0=min(x0,x);x1=max(x1,x);for c in 0..<3 {maxima[c]=max(maxima[c],Int(bytes[i+c]))}}}}
        check(count>20 && x1-x0<80,"glyph birth size remains instance-local")
        if name.contains("blue") {check(maxima[0]>2*maxima[2] && maxima[0]>maxima[1],"explicit blue survives independent glyph age")}
        if name=="red" {check(maxima[2]>2*maxima[1] && maxima[2]>2*maxima[0],"explicit new red is preserved")}
        if name=="yellow" {check(maxima[2]>3*maxima[0] && maxima[1]>3*maxima[0],"explicit yellow is preserved")}
        if name=="aged-auto" {check(abs(maxima[2]-maxima[1])<5 && abs(maxima[1]-maxima[0])<5,"unspecified old ink fades to white")}
        inkChecks.append(["case":name,"litPixels":count,"maximumBGR":maxima,"pixelWidth":x1-x0])
    }
    return ["status":"passed","device":device.name,"framesCompared":inputs.count,"maximumPositionError":maxP,"maximumDuError":maxU,"maximumDvError":maxV,"shaderCompileMS":compileMS,"renders":renders,"coreTextCoverage":clusterCoverage,"atlasRowsAfterGrowth":renderer.atlas.rows,"atlasBytesAfterGrowth":renderer.atlas.bitmap.count,"instanceStride":MemoryLayout<MetalGlyphInstance>.stride,"uniformStride":MemoryLayout<MetalUniforms>.stride,"inkChecks":inkChecks,"webGLPixelExact":false,"cpuRAMMeasured":false]
}
