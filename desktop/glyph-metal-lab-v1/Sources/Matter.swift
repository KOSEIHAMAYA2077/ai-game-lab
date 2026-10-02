import Foundation
import simd
import Darwin

enum MetalShape: Int, Codable, CaseIterable { case sphere, cube, mobius
    var label: String { ["球", "箱", "メビウス"][rawValue] }
    static func inText(_ text: String) -> MetalShape? {
        let s = text.lowercased()
        // Author-authored vocabulary, no learned model or arbitrary object generation.
        if ["メビウス", "mobius", "möbius", "輪っか", "輪", "ring"].contains(where: s.contains) { return .mobius }
        if ["立方体", "四角", "箱", "cube", "box"].contains(where: s.contains) { return .cube }
        if ["球", "丸い", "sphere", "ball"].contains(where: s.contains) { return .sphere }
        return nil
    }
}
enum MetalInk: String, Codable { case white, red, blue, yellow, green, pink, cyan, purple
    var rgb: SIMD3<Float> {
        switch self {
        case .white: return [0.94, 0.95, 0.94]
        case .red: return [1, 0.19, 0.16]
        case .blue: return [0.25, 0.48, 1]
        case .yellow: return [1, 0.85, 0.12]
        case .green: return [0.25, 1, 0.48]
        case .pink: return [1, 0.4, 0.7]
        case .cyan: return [0.15, 0.9, 1]
        case .purple: return [0.8, 0.4, 1]
        }
    }
    static func inText(_ text: String) -> MetalInk? {
        let s = text.lowercased()
        let words: [(MetalInk, [String])] = [(.red,["赤","red"]),(.blue,["青","blue"]),(.yellow,["黄","yellow"]),(.green,["緑","green"]),(.pink,["桃","pink"]),(.cyan,["水色","cyan"]),(.purple,["紫","purple"]),(.white,["白","white"])]
        return words.first { $0.1.contains(where: s.contains) }?.0
    }
}
struct MetalBatch: Codable, Equatable {
    var text: String
    var repeatCount: Int
    var added: Int
    var at: Double
    var ink: MetalInk?
    var seed: UInt32
}
struct MetalState: Codable {
    var schema = 1
    var version = "metal-lab-v1"
    var seed: UInt32 = 1
    var time: Double = 0
    var shape: MetalShape = .sphere
    var batches: [MetalBatch] = []
}
struct MetalGlyph {
    var text: String
    var id: Int
    var born: Double
    var ink: MetalInk?
    var intakeSeed: UInt32
    var inputIndex: Int
}
struct MetalAddResult { var added = 0; var limited = false; var reason: String? }
struct MetalMatter {
    static let maximumGlyphs = 32_000, maximumKinds = 1_024, maximumInputUTF16 = 16_384, maximumDrawn = 1_536
    var state = MetalState()
    var glyphs = [MetalGlyph(text: "@", id: 0, born: -20, ink: .white, intakeSeed: 0, inputIndex: 0)]
    var kinds: Set<String> = ["@"]
    var rawUTF8Bytes = 0
    static func split(_ text: String) -> [String] {
        text.precomposedStringWithCanonicalMapping.map(String.init).filter { cluster in
            let scalars = cluster.unicodeScalars
            if scalars.allSatisfy({ CharacterSet.whitespacesAndNewlines.contains($0) }) { return false }
            if scalars.allSatisfy({ $0.properties.generalCategory == .control || $0.properties.generalCategory == .format }) { return false }
            return true
        }
    }
    mutating func add(_ text: String, repeatCount: Int = 1, ink: MetalInk? = nil, intakeSeed: UInt32 = UInt32.random(in: 0...UInt32.max)) -> MetalAddResult {
        guard text.utf16.count <= Self.maximumInputUTF16 else { return MetalAddResult(limited: true, reason: "入力の長さが上限です") }
        let rawBytes = text.utf8.count
        guard rawUTF8Bytes + rawBytes <= 1_048_576 else { return MetalAddResult(limited: true, reason: "原文の保存容量が上限です") }
        let characters = Self.split(text)
        guard !characters.isEmpty else { return MetalAddResult() }
        let repeats = max(1, min(256, repeatCount))
        var result = MetalAddResult()
        outer: for _ in 0..<repeats { for (inputIndex, character) in characters.enumerated() {
            guard glyphs.count < Self.maximumGlyphs else { result.limited = true; result.reason = "文字数の上限です"; break outer }
            guard kinds.contains(character) || kinds.count < Self.maximumKinds else { result.limited = true; result.reason = "文字種類の上限です"; break outer }
            kinds.insert(character)
            glyphs.append(MetalGlyph(text: character, id: glyphs.count, born: state.time, ink: ink, intakeSeed: intakeSeed &+ UInt32(result.added * 17), inputIndex: inputIndex))
            result.added += 1
        } }
        if result.added > 0 { rawUTF8Bytes += rawBytes; state.batches.append(MetalBatch(text: text, repeatCount: repeats, added: result.added, at: state.time, ink: ink, seed: intakeSeed)) }
        return result
    }
    func displayed(limit: Int = maximumDrawn) -> [MetalGlyph] {
        let n = min(Self.maximumDrawn, max(1, limit))
        guard glyphs.count > n else { return glyphs }
        // Same policy as widget-display: seed, newest quarter, evenly spread older body.
        let recentCount = min(glyphs.count - 1, Int(floor(Double(n) / 4)))
        let oldSlots = n - recentCount - 1
        let recentStart = glyphs.count - recentCount
        var selected = [glyphs[0]]
        if oldSlots > 0 { for i in 0..<oldSlots {
            let index = 1 + Int(floor((Double(i) + 0.5) * Double(recentStart - 1) / Double(oldSlots)))
            selected.append(glyphs[index])
        } }
        selected.append(contentsOf: glyphs[recentStart...])
        return selected
    }
    static func restored(_ state: MetalState) throws -> MetalMatter {
        guard state.schema == 1, state.version == "metal-lab-v1", state.time.isFinite, state.time >= 0, state.time < 1e8, state.batches.count <= maximumGlyphs else { throw MetalLabError.invalidState }
        var result = MetalMatter()
        result.state.seed = state.seed
        var lastAt = 0.0
        for batch in state.batches {
            guard batch.at.isFinite, batch.at >= lastAt, batch.at <= state.time, batch.added > 0, batch.repeatCount >= 1, batch.repeatCount <= 256, batch.text.utf16.count <= maximumInputUTF16 else { throw MetalLabError.invalidState }
            result.state.time = batch.at
            let actual = result.add(batch.text, repeatCount: batch.repeatCount, ink: batch.ink, intakeSeed: batch.seed)
            guard actual.added == batch.added else { throw MetalLabError.invalidState }
            lastAt = batch.at
        }
        result.state.time = state.time
        result.state.shape = state.shape
        return result
    }
    static func fixture(count: Int, shape: MetalShape = .sphere) -> MetalMatter {
        var matter = MetalMatter()
        let artificial = "文字のかたちABCDあいうえお12345@?"
        let target = max(1, min(maximumGlyphs, count))
        var remaining = target - 1
        let glyphCount = split(artificial).count
        while remaining > 0 {
            let use = min(remaining, glyphCount * 64)
            let text = String(split(artificial).joined().prefix(use))
            if use <= glyphCount {
                _ = matter.add(text, ink: .white, intakeSeed: UInt32(matter.glyphs.count))
            } else {
                let repetitions = min(64, remaining / glyphCount)
                _ = matter.add(artificial, repeatCount: max(1, repetitions), ink: .white, intakeSeed: UInt32(matter.glyphs.count))
            }
            remaining = max(0, target - matter.glyphs.count)
        }
        matter.state.time = 24
        matter.state.shape = shape
        return matter
    }
}
enum MetalLabError: Error { case invalidState, invalidArgument, unavailableDevice, missingShader, atlasFull, bufferFailure }

final class MetalStateStore {
    let directory: URL
    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("org.glyphmatter.metallab.v1/snapshots-v1", isDirectory: true)
    }
    func save(_ state: MetalState) throws -> URL {
        _ = try MetalMatter.restored(state)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(state)
        guard data.count <= 2 * 1_024 * 1_024 else { throw MetalLabError.invalidState }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let stamp = String(format: "%020.0f", Date().timeIntervalSince1970 * 1_000_000)
        let url = directory.appendingPathComponent("\(stamp)-\(UUID().uuidString).json")
        guard !FileManager.default.fileExists(atPath: url.path) else { throw MetalLabError.invalidState }
        // Atomic new snapshots. Previous files are never removed or overwritten.
        let pending = directory.appendingPathComponent(".pending-\(UUID().uuidString)")
        try data.write(to: pending, options: .atomic)
        // Atomic publication with an exclusive rename: an existing destination
        // cannot be replaced. On failure the pending snapshot is kept, not deleted.
        guard renamex_np(pending.path, url.path, UInt32(RENAME_EXCL)) == 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        return url
    }
    func load() -> MetalMatter? {
        guard let entries = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey], options: [.skipsHiddenFiles]) else { return nil }
        for url in entries.filter({ $0.pathExtension == "json" }).sorted(by: { $0.lastPathComponent > $1.lastPathComponent }) {
            guard let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 2 * 1_024 * 1_024,
                  let data = try? Data(contentsOf: url), let state = try? JSONDecoder().decode(MetalState.self, from: data), let matter = try? MetalMatter.restored(state) else { continue }
            return matter
        }
        return nil
    }
}
func metalHash(_ x: UInt32) -> UInt32 {
    var value = x
    value = (value ^ (value >> 16)) &* 0x21f0aaad
    value = (value ^ (value >> 15)) &* 0x735a2d97
    return value ^ (value >> 15)
}
func metalUnit(_ x: UInt32) -> Float { Float(Double(metalHash(x)) / 4_294_967_296) }
func metalPhase(_ seed: UInt32, _ salt: UInt32) -> Float { metalUnit(seed &+ salt) * 2 * .pi }
func metalMaterial(_ id: Int, _ seed: UInt32) -> SIMD2<Float> {
    let a = (Double(id) + Double(seed) * 0.13) * 0.618033988749895
    let b = (Double(id) + Double(seed) * 0.27) * 0.754877666246693
    return [Float(a - floor(a)), Float(b - floor(b))]
}
