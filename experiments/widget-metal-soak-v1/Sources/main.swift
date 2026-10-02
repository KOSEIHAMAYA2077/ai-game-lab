import Foundation
import AppKit
import MetalKit
import CryptoKit
import simd

struct WeakMetalTexture { weak var object: AnyObject? }
struct FiniteInput {var materialTime:SIMD4<Float>;var identity:SIMD4<UInt32>}
struct FiniteOutput {var p:SIMD4<Float>;var u:SIMD4<Float>;var v:SIMD4<Float>}
struct SoakError:Error {var message:String}
final class Soak {
    let renderer:GlyphMetalRenderer
    let directory:URL
    let duration:Double
    let started:Double
    let startedUTC:Date
    let targetFPS=15.0
    let boundaryInterval:Double
    let pixelInterval:Double
    let inFlight=DispatchSemaphore(value:3)
    let errorLock=NSLock()
    let target:MTLTexture
    let finitePipeline:MTLComputePipelineState
    var metalErrors=0
    var resourceFailure=0
    var frames=0
    var skippedDeadlines=0
    var timedOutFrames=0
    var boundary=0
    var textureCreated=1
    var oldTextures:[WeakMetalTexture]=[]
    var submitHistogram=[Int](repeating:0,count:2001)
    var maximumSubmitMS=0.0
    var latestSampleElapsed=0.0
    var lastProgress=0.0
    var pixelChecks=0
    var finiteChecks=0
    var finishedReason="running"
    var nextPixelCheck=0.0
    var lastPNGShape = -1
    var samples:[[String:Any]]=[]
    var boundaries:[[String:Any]]=[]
    var lastUniform:MetalUniforms!
    let sourceSHA:String
    init(directory:URL,duration:Double,shaderURL:URL,accelerated:Bool = false) throws {
        self.directory=directory;self.duration=duration
        boundaryInterval=accelerated ? 10:600;pixelInterval=accelerated ? 5:180
        started=ProcessInfo.processInfo.systemUptime;startedUTC=Date()
        let data=try Data(contentsOf:shaderURL)
        sourceSHA=SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined()
        guard sourceSHA=="e3416ddc373018f7dfb7359efe4f55779949ce4f5185b7862a000ef0cdebde9a" else {throw SoakError(message:"Frozen R5 shader SHA mismatch")}
        let view=MTKView(frame:NSRect(x:0,y:0,width:400,height:440))
        renderer=try GlyphMetalRenderer(view:view,matter:MetalMatter.fixture(count:1536),shaderURL:shaderURL)
        renderer.setPaused(true);renderer.setHidden(true)
        renderer.onFrame=nil
        guard let function=renderer.library.makeFunction(name:"validateSurface") else {throw MetalLabError.missingShader}
        finitePipeline=try renderer.device.makeComputePipelineState(function:function)
        let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:400,height:440,mipmapped:false)
        descriptor.storageMode = .shared;descriptor.usage = [.renderTarget,.shaderRead]
        guard let texture=renderer.device.makeTexture(descriptor:descriptor) else {throw MetalLabError.bufferFailure}
        target=texture
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
        writeJSON(["pid":ProcessInfo.processInfo.processIdentifier,"status":"running","scope":"offscreen-engine-soak-not-window-app","startedUTC":ISO8601DateFormatter().string(from:startedUTC),"deadlineUTC":ISO8601DateFormatter().string(from:startedUTC.addingTimeInterval(duration)),"durationSeconds":duration,"boundaryIntervalSeconds":boundaryInterval,"pixelIntervalSeconds":pixelInterval,"targetFPS":targetFPS,"sourceSHA256":sourceSHA,"initialLibraryAndRenderPipelineMS":renderer.compilationMS,"samplingBeginsAfterCompilation":true,"drawnGlyphs":1536,"width":400,"height":440,"restoreUserHistory":false,"writeUserHistory":false],name:"run.json")
        try String(ProcessInfo.processInfo.processIdentifier).write(to:directory.appendingPathComponent("pid.txt"),atomically:true,encoding:.utf8)
    }
    func writeJSON(_ object:[String:Any],name:String) {
        do {let data=try JSONSerialization.data(withJSONObject:object,options:[.prettyPrinted,.sortedKeys]);try data.write(to:directory.appendingPathComponent(name),options:.atomic)} catch {fputs("soak diagnostic write failed\n",stderr)}
    }
    func p95() -> Double {
        let goal=Int(ceil(Double(frames)*0.95));var n=0
        for i in submitHistogram.indices {n+=submitHistogram[i];if n>=goal {return Double(i)*0.01}}
        return 20
    }
    func uniform(time t:Float) -> MetalUniforms {
        let n=renderer.displayed.count
        let scale:Float=1+0.22*log2(1+Float(max(0,n-1))/64)
        let formation:Float=1-exp(-sqrt(Float(max(0,n-1))/30))
        let distance:Float=(3.8+(scale-1)*4.1+0.7*formation)*(renderer.matter.state.shape == .mobius ? 1+0.2*formation:1)
        let ax:Float=0.12+0.09*sin(t*0.038),ay:Float = -0.25+t*0.03
        let rx=simd_float4x4(columns:([1,0,0,0],[0,cos(ax),sin(ax),0],[0,-sin(ax),cos(ax),0],[0,0,0,1]))
        let ry=simd_float4x4(columns:([cos(ay),0,-sin(ay),0],[0,1,0,0],[sin(ay),0,cos(ay),0],[0,0,0,1]))
        let f:Float=1/tan(Float.pi*43/360),near:Float=0.1,far:Float=100
        let projection=simd_float4x4(columns:([f/(400/440.0),0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
        var translation=matrix_identity_float4x4;translation.columns.3.z = -distance
        let density=min(1,max(0,(log2(Float(max(1,n)))-4)/5)),alignment:Float=0.98*density*density*(3-2*density)
        let base=max(0.065,0.145/pow(max(1,Float(n)/80),0.10)),seedFocus=exp(-Float(max(0,n-1))/18)
        let projectionScale:Float=440/(2*tan(Float.pi*43/360))
        let size=base+(104*distance/projectionScale/scale-base)*seedFocus
        return MetalUniforms(viewProjection:projection*translation,rotation:rx*ry,body:[t,scale,formation,size],params:[distance,alignment,Float(renderer.switchedAt),20*64/42*distance/projectionScale],mode:[UInt32(renderer.matter.state.shape.rawValue),UInt32(renderer.previousShape.rawValue),UInt32(n),renderer.matter.state.seed])
    }
    func mutate(at elapsed:Double) throws {
        let phase=Int(elapsed/boundaryInterval)
        guard phase>boundary else{return}
        boundary=phase
        let oldIDs=renderer.atlas.ids
        let oldOriginal=renderer.matter.glyphs.map{($0.id,$0.text,$0.ink,$0.intakeSeed)}
        oldTextures.append(WeakMetalTexture(object:renderer.atlas.texture))
        let first=0x4E00+(boundary-1)*48
        let text=(first..<(first+48)).compactMap{UnicodeScalar($0)}.map(String.init).joined()+" あ 👨‍👩‍👧‍👦"
        renderer.matter.state.time=24+elapsed
        let ink:MetalInk=boundary%2==0 ? .blue:.yellow
        let addition=renderer.matter.add(text,repeatCount:8,ink:ink,intakeSeed:UInt32(boundary*101))
        let shape=MetalShape(rawValue:boundary%3)!
        renderer.changeShape(shape)
        try renderer.rebuild();textureCreated+=1
        guard renderer.displayed.count==1536,oldIDs.allSatisfy({renderer.atlas.ids[$0.key]==$0.value}),zip(oldOriginal,renderer.matter.glyphs).allSatisfy({$0.0.0==$0.1.id && $0.0.1==$0.1.text && $0.0.2==$0.1.ink && $0.0.3==$0.1.intakeSeed}) else {throw SoakError(message:"original ID/text/ink or atlas tile changed")}
        let event:[String:Any]=["elapsedSeconds":elapsed,"boundary":boundary,"shape":shape.rawValue,"addedGlyphs":addition.added,"storedGlyphs":renderer.matter.glyphs.count,"drawnGlyphs":1536,"atlasKinds":renderer.atlas.ids.count,"atlasRows":renderer.atlas.rows,"atlasRGBABytes":renderer.atlas.bitmap.count,"texturesCreated":textureCreated,"oldIDsAndInksPreserved":true]
        boundaries.append(event);writeJSON(["boundaries":boundaries],name:"boundaries.json")
    }
    func draw(at elapsed:Double) throws -> MTLCommandBuffer? {
        guard inFlight.wait(timeout:.now()+0.25) == .success else {timedOutFrames+=1;return nil}
        let started=ProcessInfo.processInfo.systemUptime
        var u=uniform(time:Float(24+elapsed));lastUniform=u
        guard let command=renderer.queue.makeCommandBuffer() else {inFlight.signal();throw MetalLabError.bufferFailure}
        let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=target;pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store;pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,1)
        guard let encoder=command.makeRenderCommandEncoder(descriptor:pass) else {inFlight.signal();throw MetalLabError.bufferFailure}
        encoder.setRenderPipelineState(renderer.pipeline);encoder.setCullMode(.none)
        encoder.setVertexBytes(&u,length:MemoryLayout<MetalUniforms>.stride,index:0);encoder.setVertexBuffer(renderer.instanceBuffer,offset:0,index:1);encoder.setFragmentTexture(renderer.atlas.texture,index:0)
        encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:6,instanceCount:1536);encoder.endEncoding()
        command.addCompletedHandler {[weak self] command in guard let self else{return};if command.status == .error {self.errorLock.lock();self.metalErrors+=1;self.errorLock.unlock()};self.inFlight.signal()}
        command.commit();frames+=1
        let elapsedMS=(ProcessInfo.processInfo.systemUptime-started)*1000
        maximumSubmitMS=max(maximumSubmitMS,elapsedMS)
        submitHistogram[min(2000,max(0,Int(ceil(elapsedMS*100))))]+=1
        return command
    }
    func inspectPixels(_ command:MTLCommandBuffer,at elapsed:Double) throws {
        command.waitUntilCompleted()
        guard command.status == .completed else {throw SoakError(message:"render did not complete")}
        var pixels=[UInt8](repeating:0,count:400*440*4)
        pixels.withUnsafeMutableBytes{target.getBytes($0.baseAddress!,bytesPerRow:1600,from:MTLRegionMake2D(0,0,400,440),mipmapLevel:0)}
        var lit=0,channels=[UInt64](repeating:0,count:3)
        for i in stride(from:0,to:pixels.count,by:4) {if max(pixels[i],pixels[i+1],pixels[i+2])>8 {lit+=1};for c in 0..<3 {channels[c]+=UInt64(pixels[i+c])}}
        guard lit>400 else {throw SoakError(message:"blank pixel frame")}
        let sha=SHA256.hash(data:Data(pixels)).map{String(format:"%02x",$0)}.joined()
        pixelChecks+=1
        var inputs:[FiniteInput]=[]
        let ids=[0,1,385,1535,renderer.matter.glyphs.count-1]
        for shape in MetalShape.allCases {for id in ids {let ab=metalMaterial(id,1);inputs.append(FiniteInput(materialTime:[ab.x,ab.y,Float(24+elapsed),0],identity:[UInt32(shape.rawValue),1,UInt32(id),0]))}}
        guard let input=inputs.withUnsafeBytes({renderer.device.makeBuffer(bytes:$0.baseAddress!,length:$0.count,options:.storageModeShared)}),let output=renderer.device.makeBuffer(length:inputs.count*MemoryLayout<FiniteOutput>.stride,options:.storageModeShared),let checkCommand=renderer.queue.makeCommandBuffer(),let encoder=checkCommand.makeComputeCommandEncoder() else {throw MetalLabError.bufferFailure}
        encoder.setComputePipelineState(finitePipeline);encoder.setBuffer(input,offset:0,index:0);encoder.setBuffer(output,offset:0,index:1);encoder.dispatchThreads(MTLSize(width:inputs.count,height:1,depth:1),threadsPerThreadgroup:MTLSize(width:inputs.count,height:1,depth:1));encoder.endEncoding();checkCommand.commit();checkCommand.waitUntilCompleted()
        guard checkCommand.status == .completed else {throw SoakError(message:"finite kernel failed")}
        let values=output.contents().bindMemory(to:FiniteOutput.self,capacity:inputs.count)
        for i in inputs.indices {guard (0..<3).allSatisfy({values[i].p[$0].isFinite && values[i].u[$0].isFinite && values[i].v[$0].isFinite}) else {throw SoakError(message:"nonfinite shader map")}}
        finiteChecks+=inputs.count
        let retained=oldTextures.filter{$0.object != nil}.count
        let sample:[String:Any]=["elapsedSeconds":elapsed,"frames":frames,"shape":renderer.matter.state.shape.rawValue,"litPixels":lit,"BGRPixelSum":channels,"pixelSHA256":sha,"finiteMapPoints":inputs.count,"storedGlyphs":renderer.matter.glyphs.count,"drawnGlyphs":1536,"atlasKinds":renderer.atlas.ids.count,"atlasRows":renderer.atlas.rows,"atlasRGBABytes":renderer.atlas.bitmap.count,"texturesCreated":textureCreated,"priorSwiftTextureObjectsStillAlive":retained]
        samples.append(sample);writeJSON(["samples":samples],name:"pixel-finite-checks.json")
        if pixelChecks==1 || renderer.matter.state.shape.rawValue != lastPNGShape {
            lastPNGShape = renderer.matter.state.shape.rawValue
            let image=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:400,pixelsHigh:440,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bitmapFormat:[],bytesPerRow:1600,bitsPerPixel:32)!
            for i in stride(from:0,to:pixels.count,by:4) {image.bitmapData![i]=pixels[i+2];image.bitmapData![i+1]=pixels[i+1];image.bitmapData![i+2]=pixels[i];image.bitmapData![i+3]=pixels[i+3]}
            try image.representation(using:.png,properties:[:])!.write(to:directory.appendingPathComponent(String(format:"frame-%05d-shape%d.png",Int(elapsed),renderer.matter.state.shape.rawValue)))
        }
    }
    func progress(elapsed:Double,final:Bool=false) {
        errorLock.lock();let errors=metalErrors;errorLock.unlock()
        let object:[String:Any]=["pid":ProcessInfo.processInfo.processIdentifier,"scope":"offscreen-engine-soak-not-window-app","status":finishedReason,"elapsedSeconds":elapsed,"requestedSeconds":duration,"frames":frames,"actualFPS":Double(frames)/max(0.001,elapsed),"targetFPS":15,"drawCalls":frames,"drawsPerFrame":1,"storedGlyphs":renderer.matter.glyphs.count,"drawnGlyphs":1536,"shape":renderer.matter.state.shape.rawValue,"atlasKinds":renderer.atlas.ids.count,"atlasRows":renderer.atlas.rows,"atlasRGBABytes":renderer.atlas.bitmap.count,"texturesCreated":textureCreated,"priorSwiftTextureObjectsStillAlive":oldTextures.filter{$0.object != nil}.count,"submitWallP95MSUpperBin":p95(),"submitHistogramBinWidthMS":0.01,"submitHistogramOverflowAt20MS":submitHistogram[2000],"submitTimingIncludesInFlightWait":false,"submitWallMaximumMS":maximumSubmitMS,"skippedDeadlines":skippedDeadlines,"inFlightTimeouts":timedOutFrames,"metalErrors":errors,"pixelChecks":pixelChecks,"finiteMapPointsChecked":finiteChecks,"uniformBytes":MemoryLayout<MetalUniforms>.stride,"instanceBytes":renderer.instanceBuffer.length,"renderTargetBytes":400*440*4,"historyRead":false,"historyWrite":false,"surfaceSourceSHA256":sourceSHA,"windowCPUorRAMClaim":false]
        writeJSON(object,name:final ? "result.json":"progress.json")
        if final {writeJSON(["binWidthMS":0.01,"overflowMS":20,"counts":submitHistogram],name:"submit-histogram.json")}
    }
    func run() throws {
        // Compilation and initial atlas setup are deliberately outside the timed soak.
        let runStart=ProcessInfo.processInfo.systemUptime
        let actualStartUTC=Date()
        writeJSON(["pid":ProcessInfo.processInfo.processIdentifier,"status":"running","scope":"offscreen-engine-soak-not-window-app","initializationStartedUTC":ISO8601DateFormatter().string(from:startedUTC),"startedUTC":ISO8601DateFormatter().string(from:actualStartUTC),"deadlineUTC":ISO8601DateFormatter().string(from:actualStartUTC.addingTimeInterval(duration)),"durationSeconds":duration,"boundaryIntervalSeconds":boundaryInterval,"pixelIntervalSeconds":pixelInterval,"targetFPS":targetFPS,"sourceSHA256":sourceSHA,"initialLibraryAndRenderPipelineMS":renderer.compilationMS,"samplingBeginsAfterCompilation":true,"drawnGlyphs":1536,"width":400,"height":440,"restoreUserHistory":false,"writeUserHistory":false],name:"run.json")
        var next=runStart
        while true {
            let now=ProcessInfo.processInfo.systemUptime,elapsed=now-runStart
            if elapsed>=duration {finishedReason="completed";progress(elapsed:elapsed,final:true);break}
            if now<next {usleep(useconds_t(min(0.1,next-now)*1_000_000));continue}
            if now-next>1/targetFPS {let missed=Int(floor((now-next)*targetFPS));skippedDeadlines+=missed;next+=Double(missed)/targetFPS}
            try autoreleasepool {
                try mutate(at:elapsed)
                guard let command=try draw(at:elapsed) else{return}
                if elapsed>=nextPixelCheck {try inspectPixels(command,at:elapsed);nextPixelCheck=elapsed+pixelInterval}
            }
            if elapsed-lastProgress>=5 || frames==1 {progress(elapsed:elapsed);lastProgress=elapsed}
            next+=1/targetFPS
        }
        // Drain only this command queue; no system services or other apps are touched.
        renderer.queue.makeCommandBuffer().map{$0.commit();$0.waitUntilCompleted()}
        progress(elapsed:ProcessInfo.processInfo.systemUptime-runStart,final:true)
    }
}
guard (CommandLine.arguments.count==4 || CommandLine.arguments.count==5),let seconds=Double(CommandLine.arguments[3]),seconds>=30,seconds<=7200 else {throw MetalLabError.invalidArgument}
let directory=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
guard !FileManager.default.fileExists(atPath:directory.path) else {throw SoakError(message:"Output exists; choose a new directory")}
let soak=try Soak(directory:directory,duration:seconds,shaderURL:URL(fileURLWithPath:CommandLine.arguments[2]),accelerated:CommandLine.arguments.count==5 && CommandLine.arguments[4]=="--accelerated-preflight")
do {try soak.run()} catch {
    soak.finishedReason="failed";soak.progress(elapsed:ProcessInfo.processInfo.systemUptime-soak.started,final:true)
    fputs("Soak failed; results preserved\n",stderr);exit(1)
}
