import Foundation
import AppKit
import MetalKit
import simd
import CryptoKit

@main struct LightingComparison {
    static func main() throws {
        guard CommandLine.arguments.count==3 else {throw MetalLabError.invalidArgument}
        let shaderURL=URL(fileURLWithPath:CommandLine.arguments[1]),output=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
        let baseline=try String(contentsOf:shaderURL,encoding:.utf8),token="out.light=.30+.70*clamp"
        guard baseline.components(separatedBy:token).count==2 else {throw MetalLabError.invalidArgument}
        guard let device=MTLCreateSystemDefaultDevice(),let queue=device.makeCommandQueue() else {throw MetalLabError.unavailableDevice}
        var records:[[String:Any]]=[],images:[String:[UInt8]]=[:]
        for floor in [0.30,0.45] {
            let tag=floor==0.30 ? "legacy30":"candidate45"
            let source=floor==0.30 ? baseline:baseline.replacingOccurrences(of:token,with:"out.light=.45+.55*clamp")
            let variantURL=output.appendingPathComponent("\(tag).metal");try source.write(to:variantURL,atomically:false,encoding:.utf8)
            for mode in ["all-blue","old-white-new-blue"] {
                var matter=MetalMatter.fixture(count:1536)
                for i in matter.glyphs.indices {matter.glyphs[i].ink = mode=="all-blue" || i>=768 ? .blue:.white}
                let view=MTKView(frame:NSRect(x:0,y:0,width:400,height:440),device:device)
                let renderer=try GlyphMetalRenderer(view:view,matter:matter,shaderURL:variantURL)
                for shape in [MetalShape.sphere,.mobius,.vase,.jellyfish,.butterfly,.saturn] {
                    renderer.matter.state.shape=shape;renderer.previousShape=shape;try renderer.rebuild()
                    let scale:Float=1+0.22*log2(1+1535/64.0),formation:Float=1-exp(-sqrt(1535/30.0)),t:Float=24
                    let originalDistance=(3.8+(scale-1)*4.1+0.7*formation)*(shape == .mobius ? 1+0.2*formation:1)
                    let distance=max(originalDistance,MetalCameraFraming.minimumDistance(count:1536,scale:scale,formation:formation,seedFocus:0,width:400,height:440,shape:shape,previous:shape,sinceSwitch:100))
                    let ax:Float=0.12+0.09*sin(t*0.038),ay:Float = -0.25+t*0.03
                    let rx=simd_float4x4(columns:([1,0,0,0],[0,cos(ax),sin(ax),0],[0,-sin(ax),cos(ax),0],[0,0,0,1]))
                    let ry=simd_float4x4(columns:([cos(ay),0,-sin(ay),0],[0,1,0,0],[sin(ay),0,cos(ay),0],[0,0,0,1]))
                    let f:Float=1/tan(Float.pi*43/360),near:Float=0.1,far:Float=100
                    let projection=simd_float4x4(columns:([f/(400/440.0),0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
                    var translation=matrix_identity_float4x4;translation.columns.3.z = -distance
                    let word=metalWordPhases(time:Double(t),seed:1)
                    var uniform=MetalUniforms(viewProjection:projection*translation,rotation:rx*ry,body:[t,scale,formation,max(0.065,0.145/pow(1536/80.0,0.1))],params:[distance,0.98,-100,0.09],mode:[UInt32(shape.rawValue),UInt32(shape.rawValue),1536,1],wordSeeds:word.a,wordTime1:word.b,wordTime2:word.c,wordTime3:word.d,wordTime4:word.e)
                    let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:400,height:440,mipmapped:false);descriptor.storageMode = .shared;descriptor.usage = [.renderTarget,.shaderRead]
                    guard let texture=device.makeTexture(descriptor:descriptor),let command=queue.makeCommandBuffer() else {throw MetalLabError.bufferFailure}
                    let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=texture;pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store;pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,1)
                    guard let encoder=command.makeRenderCommandEncoder(descriptor:pass) else {throw MetalLabError.bufferFailure}
                    encoder.setRenderPipelineState(renderer.pipeline);encoder.setCullMode(.none);encoder.setVertexBytes(&uniform,length:MemoryLayout<MetalUniforms>.stride,index:0);encoder.setVertexBuffer(renderer.instanceBuffer,offset:0,index:1);encoder.setFragmentTexture(renderer.atlas.texture,index:0);encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:6,instanceCount:1536);encoder.endEncoding();command.commit();command.waitUntilCompleted()
                    guard command.status == .completed else {throw MetalLabError.bufferFailure}
                    var bytes=[UInt8](repeating:0,count:400*440*4)
                    bytes.withUnsafeMutableBytes{texture.getBytes($0.baseAddress!,bytesPerRow:400*4,from:MTLRegionMake2D(0,0,400,440),mipmapLevel:0)}
                    let key="\(shape.rawValue)-\(mode)",filename="\(key)-\(tag).png";images["\(key)-\(tag)"]=bytes
                    var sumLuma=0.0,area8=0,area2=0
                    for i in stride(from:0,to:bytes.count,by:4) {
                        sumLuma += 0.2126*Double(bytes[i+2])+0.7152*Double(bytes[i+1])+0.0722*Double(bytes[i])
                        if max(bytes[i],bytes[i+1],bytes[i+2])>8 {area8+=1};if max(bytes[i],bytes[i+1],bytes[i+2])>2 {area2+=1}
                    }
                    let image=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:400,pixelsHigh:440,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bitmapFormat:[],bytesPerRow:400*4,bitsPerPixel:32)!
                    for i in stride(from:0,to:bytes.count,by:4) {image.bitmapData![i]=bytes[i+2];image.bitmapData![i+1]=bytes[i+1];image.bitmapData![i+2]=bytes[i];image.bitmapData![i+3]=bytes[i+3]}
                    try image.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent(filename),options:.withoutOverwriting)
                    records.append(["shape":shape.rawValue,"colorScenario":mode,"floor":floor,"file":filename,"cameraDistance":distance,"sumCodeValueLuma":sumLuma,"areaMaxChannelAbove8":area8,"areaMaxChannelAbove2":area2,"drawCalls":1,"glyphCount":1536,"time":24,"sourceSHA256":SHA256.hash(data:Data(source.utf8)).map{String(format:"%02x",$0)}.joined()])
                }
            }
        }
        var pairs:[[String:Any]]=[]
        for mode in ["all-blue","old-white-new-blue"] {for shape in [0,2,4,5,7,12] {
            let key="\(shape)-\(mode)",old=images[key+"-legacy30"]!,new=images[key+"-candidate45"]!
            var changed=0,union=0,oldL=0.0,newL=0.0
            for i in stride(from:0,to:old.count,by:4) {
                if old[i] != new[i] || old[i+1] != new[i+1] || old[i+2] != new[i+2] {changed+=1}
                if max(old[i],old[i+1],old[i+2],new[i],new[i+1],new[i+2])>2 {
                    union+=1;oldL += 0.2126*Double(old[i+2])+0.7152*Double(old[i+1])+0.0722*Double(old[i]);newL += 0.2126*Double(new[i+2])+0.7152*Double(new[i+1])+0.0722*Double(new[i])
                }
            }
            pairs.append(["shape":shape,"colorScenario":mode,"changedPixels":changed,"unionSignalPixels":union,"legacyMeanCodeValueLumaOnUnion":oldL/Double(union),"candidateMeanCodeValueLumaOnUnion":newL/Double(union),"lumaRatio":newL/oldL])
        }}
        let result:[String:Any]=["status":"completed","device":device.name,"baselineShaderSHA256":SHA256.hash(data:Data(baseline.utf8)).map{String(format:"%02x",$0)}.joined(),"blueRGB":[0.25,0.48,1.0],"paletteChanged":false,"onlyShaderChange":"depth .30+.70*d versus .45+.55*d; original closed-face coating unchanged","fixedScene":"same synthetic text/IDs/material/atlas/t24/camera/1536/count in each pair; old-white/new-blue denotes retained glyph ink, not real user input","records":records,"pairs":pairs,"pixelMetric":"8-bit bgraUnorm code-value luma, not display photometry/contrast/readability/HCI outcome","actualWindowMeasured":false,"resourceMeasured":false,"defaultAdoption":false]
        try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output.appendingPathComponent("lighting-report.json"),options:.withoutOverwriting)
        print("Completed 24 immutable paired offscreen lighting images; no window or resource claim.")
    }
}
