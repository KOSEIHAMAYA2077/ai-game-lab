import Foundation
import AppKit
import MetalKit
import simd

// Offscreen connection harness, not a native editor/window/IME test.
private struct AmbientValidationInput {
    var materialTime: SIMD4<Float>; var identity: SIMD4<UInt32>
    var wordSeeds: SIMD4<Float> = .zero; var wordTime1: SIMD4<Float> = .zero
    var wordTime2: SIMD4<Float> = .zero; var wordTime3: SIMD4<Float> = .zero
    var wordTime4: SIMD4<Float> = .zero
}
private struct AmbientValidationOutput { var p: SIMD4<Float>; var u: SIMD4<Float>; var v: SIMD4<Float> }

@main struct AmbientGPUConnection {
    static func main() throws {
        guard CommandLine.arguments.count == 6 else { throw AmbientLabError.invalidArgument }
        let bundle = URL(fileURLWithPath: CommandLine.arguments[1])
        let shader = URL(fileURLWithPath: CommandLine.arguments[2])
        let manualURL = URL(fileURLWithPath: CommandLine.arguments[3])
        let fixtureURL = URL(fileURLWithPath: CommandLine.arguments[4])
        let output = URL(fileURLWithPath: CommandLine.arguments[5], isDirectory: true)
        let manual = try JSONSerialization.jsonObject(with: Data(contentsOf: manualURL)) as! [String: Any]
        let fixture = try JSONSerialization.jsonObject(with: Data(contentsOf: fixtureURL)) as! [String: Any]
        let selected = Set(fixture["manualCaseIDs"] as! [String])
        let cases = (manual["cases"] as! [[String: Any]]).filter { selected.contains($0["id"] as! String) } + (fixture["cases"] as! [[String: Any]])
        guard cases.count == 10, let device = MTLCreateSystemDefaultDevice() else { throw AmbientLabError.unavailableDevice }
        var records = [[String: Any]](), traces = [[String: Any]](), failures = [[String: Any]]()
        var allGPUFrames = [[String: Any]]()
        let started = ProcessInfo.processInfo.systemUptime
        for item in cases {
            let id = item["id"] as! String
            let bridge = try AmbientReceiverBridge(bundleURL: bundle)
            let projection = AmbientProjection()
            var perCaseFailures = [String](), trace = [[String: Any]]()
            for command in item["commands"] as! [[String: Any]] {
                let view = try bridge.send(command)
                _ = try projection.apply(view)
                trace.append(["command": command, "view": try JSONSerialization.jsonObject(with: JSONEncoder().encode(view))])
            }
            let receiverView = try bridge.current()
            let expected = item["expected"] as! [String: Any]
            let n = projection.glyphs.count
            if receiverView.shape != expected["shape"] as? String { perCaseFailures.append("receiver-shape") }
            if let expectedBody = expected["body"] as? String,
               !receiverView.units.map(\.text).joined().utf16.elementsEqual(expectedBody.utf16) { perCaseFailures.append("literal-body") }
            if let expectedCount = expected["bodyCount"] as? Int, receiverView.units.count != expectedCount { perCaseFailures.append("body-count") }
            if let expectedCount = expected["presented"] as? Int, n != expectedCount { perCaseFailures.append("presented-count") }
            if receiverView.units.map(\.id) != Array(1...max(1, receiverView.units.count)).prefix(receiverView.units.count).map({$0}) { perCaseFailures.append("id-authority") }
            if let oldCount = expected["oldCount"] as? Int, let oldInk = expected["oldInk"] as? String,
               let newInk = expected["newInk"] as? String {
                if !receiverView.units.prefix(oldCount).allSatisfy({ $0.ink.rawValue == oldInk }) { perCaseFailures.append("old-ink") }
                if !receiverView.units.dropFirst(oldCount).allSatisfy({ $0.ink.rawValue == newInk }) { perCaseFailures.append("new-ink") }
            }
            if projection.bodyCount > 256 || n > 256 || n != receiverView.presentedCount { perCaseFailures.append("projection-cap") }
            let view = MTKView(frame: NSRect(x: 0, y: 0, width: 400, height: 440), device: device)
            let renderer = try AmbientRenderer(view: view, projection: projection, shaderURL: shader)
            renderer.setPaused(true)
            projection.time = 24 // Birth metadata stays the actual first read observation, zero.
            let shape = projection.shape
            renderer.previousShape = shape; renderer.switchedAt = -100
            let scale: Float = 1 + 0.22 * log2(1 + Float(max(0,n-1))/64)
            let formation: Float = 1 - exp(-sqrt(Float(max(0,n-1))/30))
            let focus: Float = exp(-Float(max(0,n-1))/18)
            let fit: Float = max(1, 0.93/(400/440.0))
            let original = (3.8 + (scale-1)*4.1 + 0.7*formation)*fit*(shape == .mobius ? 1+0.2*formation : 1)
            let distance = max(original, AmbientCameraFraming.minimumDistance(count:n, scale:scale, formation:formation, seedFocus:focus, width:400, height:440, shape:shape, previous:shape, sinceSwitch:124))
            renderer.renderedScale=scale; renderer.renderedFormation=formation; renderer.renderedSeedFocus=focus; renderer.renderedDistance=distance
            try renderer.rebuild() // Actual app instance builder/atlas; no test glyph allocator.
            guard MemoryLayout<AmbientGlyphInstance>.stride == 80 else { throw AmbientLabError.bufferFailure }
            let buffer = renderer.instanceBuffer.contents().bindMemory(to: AmbientGlyphInstance.self, capacity: max(1,n))
            var payloadFinite = true
            for i in 0..<n {
                let a = buffer[i], unit = receiverView.units[i]
                if a.identity.x != UInt32(unit.id) || a.identity.z != UInt32(unit.id-1) || a.ink.w != 1 { perCaseFailures.append("instance-identity") }
                if (0..<4).contains(where: { !a.atlasRect[$0].isFinite || !a.ink[$0].isFinite || !a.material[$0].isFinite || !a.source[$0].isFinite }) { payloadFinite = false }
                let rgb = unit.ink.rgb
                if a.ink.x != rgb.x || a.ink.y != rgb.y || a.ink.z != rgb.z { perCaseFailures.append("instance-ink") }
            }
            let far = AmbientCameraFraming.farDistance(distance:distance, count:n, scale:scale, formation:formation, seedFocus:focus, height:440, shape:shape, previous:shape, sinceSwitch:124)
            let f: Float = 1/tan(Float.pi*43/360), near: Float = 0.1
            let matrix = simd_float4x4(columns:([f/(400/440.0),0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
            var translation = matrix_identity_float4x4; translation.columns.3.z = -distance
            let density = min(1,max(0,(log2(Float(max(1,n)))-4)/5)), alignment = 0.98*density*density*(3-2*density)
            let base: Float = max(0.065,0.145/pow(max(1,Float(n)/80),0.10)), projectionScale: Float = 440/(2*tan(Float.pi*43/360))
            let size = base + (104*distance/projectionScale/scale-base)*focus
            let word = ambientWordPhases(time:24,seed:projection.seed), previousWord = ambientWordPhases(time:-100,seed:projection.seed)
            var uniforms = AmbientUniforms(viewProjection:matrix*translation, rotation:matrix_identity_float4x4, body:[24,scale,formation,size], params:[distance,alignment,-100,20*64/42*distance/projectionScale], mode:[UInt32(shape.rawValue),UInt32(shape.rawValue),UInt32(n),projection.seed], wordSeeds:word.a, wordTime1:word.b, wordTime2:word.c, wordTime3:word.d, wordTime4:word.e, previousWordSeeds:previousWord.a, previousWordTime1:previousWord.b, previousWordTime2:previousWord.c, previousWordTime3:previousWord.d, previousWordTime4:previousWord.e)
            var rig = ambientCreatureUniforms(shape:shape,previous:shape,time:24,switchedAt:-100,seed:projection.seed)
            var uniformFinite = distance.isFinite && far.isFinite && size.isFinite
            for c in 0..<4 { for r in 0..<4 { uniformFinite = uniformFinite && uniforms.viewProjection[c][r].isFinite && uniforms.rotation[c][r].isFinite } }
            uniformFinite = uniformFinite && (0..<4).allSatisfy { uniforms.body[$0].isFinite && uniforms.params[$0].isFinite }
            var gpuFinite = true, gpuFrames = [[String: Any]]()
            if n > 0 {
                // This original validation kernel consumes the same material and ID payload.
                guard let function=renderer.library.makeFunction(name:"validateSurface") else { throw AmbientLabError.missingShader }
                let pipeline = try device.makeComputePipelineState(function:function)
                let inputs = (0..<n).map { i in AmbientValidationInput(materialTime:[buffer[i].material.x,buffer[i].material.y,24,0],identity:[UInt32(shape.rawValue),projection.seed,buffer[i].identity.x,0]) }
                guard let input = inputs.withUnsafeBytes({device.makeBuffer(bytes:$0.baseAddress!,length:$0.count,options:.storageModeShared)}),
                      let result=device.makeBuffer(length:n*MemoryLayout<AmbientValidationOutput>.stride,options:.storageModeShared),let command=renderer.queue.makeCommandBuffer(),let encoder=command.makeComputeCommandEncoder() else { throw AmbientLabError.bufferFailure }
                encoder.setComputePipelineState(pipeline);encoder.setBuffer(input,offset:0,index:0);encoder.setBuffer(result,offset:0,index:1)
                encoder.dispatchThreads(MTLSize(width:n,height:1,depth:1),threadsPerThreadgroup:MTLSize(width:min(64,pipeline.maxTotalThreadsPerThreadgroup),height:1,depth:1));encoder.endEncoding();command.commit();command.waitUntilCompleted()
                if command.status != .completed { gpuFinite=false }
                let values=result.contents().bindMemory(to:AmbientValidationOutput.self,capacity:n)
                for i in 0..<n {
                    let arrays=[values[i].p,values[i].u,values[i].v].map { v in (0..<4).map { Double(v[$0]) } }
                    if !arrays.flatMap({$0}).allSatisfy(\.isFinite) { gpuFinite=false }
                    gpuFrames.append(["id":receiverView.units[i].id,"p_u_v":arrays])
                }
            }
            let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:400,height:440,mipmapped:false)
            descriptor.storageMode = .shared; descriptor.usage = [.renderTarget,.shaderRead]
            guard let texture=device.makeTexture(descriptor:descriptor),let command=renderer.queue.makeCommandBuffer() else { throw AmbientLabError.bufferFailure }
            let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=texture;pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store;pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,1)
            guard let encoder=command.makeRenderCommandEncoder(descriptor:pass) else { throw AmbientLabError.bufferFailure }
            encoder.setRenderPipelineState(renderer.pipeline);encoder.setCullMode(.none);encoder.setVertexBytes(&uniforms,length:MemoryLayout<AmbientUniforms>.stride,index:0);encoder.setVertexBytes(&rig,length:MemoryLayout<AmbientCreatureUniforms>.stride,index:2)
            encoder.setVertexBuffer(renderer.instanceBuffer,offset:0,index:1);encoder.setFragmentTexture(renderer.atlas.texture,index:0)
            encoder.drawPrimitives(type:.triangle,vertexStart:0,vertexCount:6,instanceCount:n);encoder.endEncoding();command.commit();command.waitUntilCompleted()
            var bytes=[UInt8](repeating:0,count:400*440*4)
            bytes.withUnsafeMutableBytes { texture.getBytes($0.baseAddress!,bytesPerRow:1600,from:MTLRegionMake2D(0,0,400,440),mipmapLevel:0) }
            var lit=0,blue=0,bounds=[400,440,-1,-1]
            for y in 0..<440 { for x in 0..<400 { let i=(y*400+x)*4,b=Double(bytes[i]),g=Double(bytes[i+1]),r=Double(bytes[i+2]);if max(b,g,r)>8 {lit+=1;bounds=[min(bounds[0],x),min(bounds[1],y),max(bounds[2],x),max(bounds[3],y)]};if b>1.5*g && b>2*r && b>8 {blue+=1} } }
            if !payloadFinite || !uniformFinite || !gpuFinite { perCaseFailures.append("finite") }
            if command.status != .completed { perCaseFailures.append("metal-command") }
            if n == 0 { if lit != 0 || renderer.atlas.ids.count != 0 { perCaseFailures.append("empty-gpu-material") } }
            else if lit <= 10 || bounds[0]<0 || bounds[1]<0 || bounds[2]>=400 || bounds[3]>=440 { perCaseFailures.append("visible-pixels") }
            if let mixed = item["mixed"] as? Bool { if mixed && blue <= 0 { perCaseFailures.append("new-blue-pixels") }; if !mixed && blue != 0 { perCaseFailures.append("white-only") } }
            let image=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:400,pixelsHigh:440,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bitmapFormat:[],bytesPerRow:1600,bitsPerPixel:32)!
            for i in stride(from:0,to:bytes.count,by:4) {image.bitmapData![i]=bytes[i+2];image.bitmapData![i+1]=bytes[i+1];image.bitmapData![i+2]=bytes[i];image.bitmapData![i+3]=bytes[i+3]}
            try image.representation(using:.png,properties:[:])!.write(to:output.appendingPathComponent("\(id).png"),options:.withoutOverwriting)
            records.append(["id":id,"shape":receiverView.shape,"mappedNativeShape":shape.rawValue,"bodyCount":receiverView.units.count,"drawnInstances":n,"instanceBytes":renderer.instanceBuffer.length,"atlasKinds":renderer.atlas.ids.count,"litPixels":lit,"bluePixels":blue,"bounds":bounds,"payloadFinite":payloadFinite,"uniformFinite":uniformFinite,"gpuBaseFramesFinite":gpuFinite,"gpuFrames":gpuFrames.count,"metalCompleted":command.status == .completed,"drawCalls":1,"passed":perCaseFailures.isEmpty,"failures":perCaseFailures])
            traces.append(["id":id,"traces":trace,"offExport":try JSONSerialization.jsonObject(with:bridge.exportOff())])
            allGPUFrames.append(["id":id,"frames":gpuFrames])
            if !perCaseFailures.isEmpty { failures.append(["id":id,"failures":perCaseFailures]) }
            bridge.destroy()
        }
        let report: [String:Any] = ["version":"ambient-offscreen-connection-r1","runs":records.count,"passed":records.filter { $0["passed"] as? Bool == true }.count,"records":records,"failures":failures,"device":device.name,"elapsedWallSeconds":ProcessInfo.processInfo.systemUptime-started,"actualNativeWindow":false,"actualNativeIME":false,"resourceMeasured":false,"sameOriginalShader":true,"instanceStride":MemoryLayout<AmbientGlyphInstance>.stride,"uniformStride":MemoryLayout<AmbientUniforms>.stride]
        for (name,value) in [("gpu-report-r1.json",report),("receiver-traces-r1.json",["runs":traces]),("gpu-frame-raw-r1.json",["runs":allGPUFrames])] {
            try JSONSerialization.data(withJSONObject:value,options:[.prettyPrinted,.sortedKeys]).write(to:output.appendingPathComponent(name),options:.withoutOverwriting)
        }
        print("\(records.count) artificial native/JSC/offscreen connections; failures=\(failures.count)")
        if !failures.isEmpty { exit(1) }
    }
}
