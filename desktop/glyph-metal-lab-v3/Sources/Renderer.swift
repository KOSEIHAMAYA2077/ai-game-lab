import AppKit
import MetalKit
import CoreText
import simd

struct MetalGlyphInstance {
    var atlasRect: SIMD4<Float>
    var ink: SIMD4<Float>
    var material: SIMD4<Float>
    var source: SIMD4<Float>
    var identity: SIMD4<UInt32>
}
struct MetalUniforms {
    var viewProjection: simd_float4x4
    var rotation: simd_float4x4
    var body: SIMD4<Float>
    var params: SIMD4<Float>
    var mode: SIMD4<UInt32>
    var wordSeeds: SIMD4<Float> = .zero
    var wordTime1: SIMD4<Float> = .zero
    var wordTime2: SIMD4<Float> = .zero
    var wordTime3: SIMD4<Float> = .zero
    var wordTime4: SIMD4<Float> = .zero
    var previousWordSeeds: SIMD4<Float> = .zero
    var previousWordTime1: SIMD4<Float> = .zero
    var previousWordTime2: SIMD4<Float> = .zero
    var previousWordTime3: SIMD4<Float> = .zero
    var previousWordTime4: SIMD4<Float> = .zero
}
final class MetalAtlas {
    static let cell = 64, columns = 32
    let device: MTLDevice
    var ids: [String: Int] = [:]
    var rows = 1
    var texture: MTLTexture!
    var bitmap: [UInt8] = []
    init(device: MTLDevice) { self.device = device }
    func update(_ glyphs: [MetalGlyph]) throws {
        for glyph in glyphs where ids[glyph.text] == nil {
            guard ids.count < MetalMatter.maximumKinds else { throw MetalLabError.atlasFull }
            ids[glyph.text] = ids.count
        }
        rows = 1
        while rows * Self.columns < max(1, ids.count) { rows *= 2 }
        let width = Self.columns * Self.cell, height = rows * Self.cell
        bitmap = [UInt8](repeating: 0, count: width * height * 4)
        try bitmap.withUnsafeMutableBytes { bytes in
            guard let context = CGContext(data: bytes.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { throw MetalLabError.bufferFailure }
            context.setAllowsAntialiasing(true); context.setShouldAntialias(true)
            let font = CTFontCreateWithName("HiraginoSans-W3" as CFString, 42, nil)
            for (text, index) in ids {
                let string = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: NSColor.white])
                let line = CTLineCreateWithAttributedString(string)
                let bounds = CTLineGetBoundsWithOptions(line, [.useGlyphPathBounds])
                let fit = min(1, 54 / max(1, max(bounds.width, bounds.height)))
                context.saveGState()
                context.translateBy(x: CGFloat(index % Self.columns * Self.cell) + 32, y: CGFloat(height - (index / Self.columns * Self.cell)) - 32)
                context.scaleBy(x: fit, y: fit)
                context.textMatrix = .identity
                context.textPosition = CGPoint(x: -bounds.midX, y: -bounds.midY)
                CTLineDraw(line, context)
                context.restoreGState()
            }
        }
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: width, height: height, mipmapped: false)
        descriptor.storageMode = .shared; descriptor.usage = [.shaderRead]
        guard let nextTexture = device.makeTexture(descriptor: descriptor) else { throw MetalLabError.bufferFailure }
        bitmap.withUnsafeBytes { bytes in nextTexture.replace(region: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0, withBytes: bytes.baseAddress!, bytesPerRow: width * 4) }
        texture = nextTexture
    }
    func rectangle(_ text: String) -> SIMD4<Float> {
        let id = ids[text]!
        return [Float(id % Self.columns) / Float(Self.columns), Float(id / Self.columns) / Float(rows), 1 / Float(Self.columns), 1 / Float(rows)]
    }
}
final class GlyphMetalRenderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    let queue: MTLCommandQueue
    let library: MTLLibrary
    let pipeline: MTLRenderPipelineState
    let atlas: MetalAtlas
    let view: MTKView
    var matter: MetalMatter
    var instanceBuffer: MTLBuffer!
    var displayed: [MetalGlyph] = []
    var previousShape: MetalShape
    var switchedAt = -100.0
    var paused = false
    var hidden = false
    var frames = 0
    var drawCalls = 0
    var lastTick: Double?
    var lastMetricsWrite = -100.0
    var metricsURL: URL?
    var elapsedSamples: [Double] = []
    var maximumElapsed = 0.0
    var turnX: Float = 0.12, turnY: Float = -0.25, zoom: Float = 1
    var renderedScale: Float = 1
    var renderedFormation: Float = 0
    var renderedDistance: Float = 3.8
    var renderedSeedFocus: Float = 1
    var errorCount = 0
    var onFrame: (() -> Void)?
    let compilationMS: Double
    private var frameFar: Float = 100

    init(view: MTKView, matter: MetalMatter, shaderURL: URL, metricsURL: URL? = nil) throws {
        guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else { throw MetalLabError.unavailableDevice }
        let started = ProcessInfo.processInfo.systemUptime
        let options = MTLCompileOptions(); options.fastMathEnabled = false
        let library = try device.makeLibrary(source: String(contentsOf: shaderURL, encoding: .utf8), options: options)
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = library.makeFunction(name: "glyphVertex")
        descriptor.fragmentFunction = library.makeFunction(name: "glyphFragment")
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        descriptor.colorAttachments[0].isBlendingEnabled = true
        descriptor.colorAttachments[0].rgbBlendOperation = .add
        descriptor.colorAttachments[0].alphaBlendOperation = .add
        descriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        descriptor.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        descriptor.colorAttachments[0].sourceAlphaBlendFactor = .one
        descriptor.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
        self.pipeline = try device.makeRenderPipelineState(descriptor: descriptor)
        self.device = device; self.queue = queue; self.library = library; self.view = view
        self.matter = matter; self.previousShape = matter.state.shape; self.atlas = MetalAtlas(device: device); self.metricsURL = metricsURL
        compilationMS = (ProcessInfo.processInfo.systemUptime - started) * 1000
        super.init()
        view.device = device; view.colorPixelFormat = .bgra8Unorm; view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        view.depthStencilPixelFormat = .invalid; view.sampleCount = 1
        view.preferredFramesPerSecond = 15; view.autoResizeDrawable = false
        view.enableSetNeedsDisplay = false; view.isPaused = true; view.delegate = self
        try rebuild()
        renderedScale = currentGrowth(); renderedFormation = formation()
        renderedSeedFocus = exp(-Float(max(0,displayed.count-1))/18); renderedDistance = currentDistance()
        resize()
    }
    func resize() {
        view.drawableSize = CGSize(width: max(1, view.bounds.width.rounded()), height: max(1, view.bounds.height.rounded()))
        if paused && !hidden { view.draw() }
    }
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}
    func rebuild() throws {
        displayed = matter.displayed()
        try atlas.update(displayed)
        let projectionScale = Float(max(1, view.bounds.height)) / (2 * tan(Float.pi * 43 / 360))
        let distance = renderedDistance
        let scale = renderedScale
        let birthSize = 20 * 64 / 42 * distance / projectionScale
        let instances = displayed.map { glyph -> MetalGlyphInstance in
            let material = metalMaterial(glyph.id, matter.state.seed)
            let rgb = (glyph.ink ?? .red).rgb
            let phase = glyph.id == 0 ? 0 : metalUnit(UInt32(truncatingIfNeeded: glyph.id) &* 2_654_435_761 &+ matter.state.seed) * 2 * .pi
            return MetalGlyphInstance(atlasRect: atlas.rectangle(glyph.text), ink: [rgb.x,rgb.y,rgb.z,glyph.ink == nil ? 0 : 1], material: [material.x,material.y,Float(glyph.born),phase], source: [0,-1.9/scale,0,birthSize], identity: [UInt32(glyph.id),glyph.intakeSeed,UInt32(glyph.inputIndex),0])
        }
        let next = instances.withUnsafeBytes { bytes in device.makeBuffer(bytes: bytes.baseAddress!, length: bytes.count, options: .storageModeShared) }
        guard let next else { throw MetalLabError.bufferFailure }
        instanceBuffer = next
        writeMetrics(force: true)
    }
    func changeShape(_ shape: MetalShape) {
        guard shape != matter.state.shape else { return }
        previousShape = matter.state.shape; switchedAt = matter.state.time; matter.state.shape = shape
        writeMetrics(force: true)
        if paused && !hidden { view.draw() }
    }
    func setPaused(_ pause: Bool) {
        paused = pause; updateScheduling()
    }
    func setHidden(_ hide: Bool) {
        hidden = hide; updateScheduling()
        if hide { view.releaseDrawables() }
    }
    func updateScheduling() {
        lastTick = nil
        view.isPaused = paused || hidden
        writeMetrics(force: true)
    }
    private func currentGrowth() -> Float { 1 + 0.22 * log2(1 + Float(max(0, displayed.count - 1)) / 64) }
    private func formation() -> Float { 1 - exp(-sqrt(Float(max(0, displayed.count - 1)) / 30)) }
    private func currentDistance() -> Float {
        let scale = currentGrowth(), fit = max(1, 0.93 / Float(max(1,view.bounds.width) / max(1,view.bounds.height)))
        let mobiusFit: Float = matter.state.shape == .mobius ? 1 + 0.2 * renderedFormation : 1
        let original = (3.8 + (scale - 1) * 4.1 + 0.7 * renderedFormation) * fit * mobiusFit
        return max(original, minimumFramingDistance(scale: scale, formation: renderedFormation)) * zoom
    }
    private func minimumFramingDistance(scale: Float, formation: Float) -> Float {
        MetalCameraFraming.minimumDistance(count: displayed.count, scale: scale,
            formation: formation, seedFocus: renderedSeedFocus,
            width: Float(view.bounds.width), height: Float(view.bounds.height),
            shape: matter.state.shape, previous: previousShape,
            sinceSwitch: Float(matter.state.time - switchedAt))
    }
    func draw(in view: MTKView) {
        guard !hidden else { return }
        let start = ProcessInfo.processInfo.systemUptime
        var dt = 0.0
        if !paused {
            if let previous = lastTick { dt = min(0.5,max(0,start-previous));matter.state.time += dt }
            lastTick = start
        }
        let easing = Float(1-exp(-dt*3.5))
        renderedScale += (currentGrowth()-renderedScale)*easing
        renderedFormation += (formation()-renderedFormation)*easing
        renderedSeedFocus += (exp(-Float(max(0,displayed.count-1))/18)-renderedSeedFocus)*easing
        if paused {renderedDistance=currentDistance()} else {renderedDistance += (currentDistance()-renderedDistance)*easing}
        // A smooth distance can lag behind a growing surface or a narrower
        // window. Clamp to the bound of the actual interpolated body this frame.
        renderedDistance = max(renderedDistance,
            minimumFramingDistance(scale: renderedScale, formation: renderedFormation) * zoom)
        let t = Float(matter.state.time), n = displayed.count, scale = renderedScale, distance = renderedDistance
        let age = matter.state.time - (matter.state.batches.last?.at ?? -100)
        let preferred = age < 3.8 ? 30 : 15
        if view.preferredFramesPerSecond != preferred { view.preferredFramesPerSecond = preferred }
        let angleX = turnX + 0.09 * sin(t * 0.038), angleY = turnY + t * 0.03
        let rx = simd_float4x4(columns: ([1,0,0,0],[0,cos(angleX),sin(angleX),0],[0,-sin(angleX),cos(angleX),0],[0,0,0,1]))
        let ry = simd_float4x4(columns: ([cos(angleY),0,-sin(angleY),0],[0,1,0,0],[sin(angleY),0,cos(angleY),0],[0,0,0,1]))
        let rotation = rx * ry
        let aspect = Float(max(1,view.bounds.width) / max(1,view.bounds.height)), f = 1 / tan(Float.pi * 43 / 360), near: Float = 0.1
        let far = MetalCameraFraming.farDistance(distance: distance, count: n,
            scale: scale, formation: renderedFormation, seedFocus: renderedSeedFocus,
            height: Float(view.bounds.height), shape: matter.state.shape,
            previous: previousShape, sinceSwitch: Float(matter.state.time - switchedAt))
        frameFar = far
        let projection = simd_float4x4(columns: ([f/aspect,0,0,0],[0,f,0,0],[0,0,far/(near-far),-1],[0,0,near*far/(near-far),0]))
        var translation = matrix_identity_float4x4; translation.columns.3.z = -distance
        let density = min(1,max(0,(log2(Float(max(1,n)))-4)/5)); let alignment = 0.98 * density * density * (3-2*density)
        let baseSize = max(0.065,0.145 / pow(max(1,Float(n)/80),0.10)), seedFocus = renderedSeedFocus
        let projectionScale = Float(max(1,view.bounds.height)) / (2*tan(Float.pi*43/360))
        let size = baseSize + (104*distance/projectionScale/scale-baseSize)*seedFocus
        let word = metalWordPhases(time: matter.state.time, seed: matter.state.seed)
        let previousWord = metalWordPhases(time: switchedAt, seed: matter.state.seed)
        var uniforms = MetalUniforms(viewProjection: projection * translation, rotation: rotation, body: [t,scale,renderedFormation,size], params: [distance,alignment,Float(switchedAt),20*64/42*distance/projectionScale], mode: [UInt32(matter.state.shape.rawValue),UInt32(previousShape.rawValue),UInt32(n),matter.state.seed], wordSeeds: word.a, wordTime1: word.b, wordTime2: word.c, wordTime3: word.d, wordTime4: word.e, previousWordSeeds: previousWord.a, previousWordTime1: previousWord.b, previousWordTime2: previousWord.c, previousWordTime3: previousWord.d, previousWordTime4: previousWord.e)
        guard let command = queue.makeCommandBuffer(), let pass = view.currentRenderPassDescriptor, let drawable = view.currentDrawable, let encoder = command.makeRenderCommandEncoder(descriptor: pass) else { return }
        command.label = "Glyph surfaces, one instanced draw"
        encoder.setRenderPipelineState(pipeline); encoder.setCullMode(.none)
        encoder.setVertexBytes(&uniforms, length: MemoryLayout<MetalUniforms>.stride, index: 0)
        encoder.setVertexBuffer(instanceBuffer, offset: 0, index: 1); encoder.setFragmentTexture(atlas.texture, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6, instanceCount: n)
        encoder.endEncoding(); command.present(drawable)
        command.addCompletedHandler { [weak self] completed in
            if completed.status == .error { DispatchQueue.main.async { self?.errorCount += 1 } }
        }
        command.commit(); frames += 1; drawCalls += 1
        let elapsed = (ProcessInfo.processInfo.systemUptime-start)*1000
        maximumElapsed = max(maximumElapsed,elapsed)
        if elapsedSamples.count < 1800 { elapsedSamples.append(elapsed) } else { elapsedSamples[frames % 1800] = elapsed }
        onFrame?(); writeMetrics()
    }
    func writeMetrics(force: Bool = false) {
        guard let metricsURL else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard force || now-lastMetricsWrite >= 1 else { return }
        lastMetricsWrite = now
        let sorted = elapsedSamples.sorted(), index = max(0,min(sorted.count-1,Int(Double(sorted.count)*0.95)))
        let object: [String: Any] = ["schema":1,"renderer":"metal-lab-v3","pid":ProcessInfo.processInfo.processIdentifier,"frames":frames,"drawCalls":drawCalls,"time":matter.state.time,"storedGlyphs":matter.glyphs.count,"drawnGlyphs":displayed.count,"kinds":matter.kinds.count,"atlasKinds":atlas.ids.count,"atlasRows":atlas.rows,"atlasRGBABytes":atlas.bitmap.count,"instanceBytes":instanceBuffer?.length ?? 0,"uniformBytes":MemoryLayout<MetalUniforms>.stride,"paused":paused,"hidden":hidden,"scheduled":!view.isPaused,"preferredFPS":view.preferredFramesPerSecond,"shape":matter.state.shape.rawValue,"shaderCompileMS":compilationMS,"submitElapsedP95MS":sorted.isEmpty ? 0 : sorted[index],"submitElapsedMaximumMS":maximumElapsed,"metalErrorCount":errorCount,"width":view.drawableSize.width,"height":view.drawableSize.height,"cameraDistance":renderedDistance,"framingMinimum":minimumFramingDistance(scale:renderedScale,formation:renderedFormation),"manualZoom":zoom,"frustumFar":frameFar]
        if let data = try? JSONSerialization.data(withJSONObject: object,options:[.sortedKeys]) { try? data.write(to: metricsURL,options:.atomic) }
    }
}
