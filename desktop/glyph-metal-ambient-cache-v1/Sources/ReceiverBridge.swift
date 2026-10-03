import Foundation
import JavaScriptCore

final class AmbientReceiverBridge {
    static let maximumResponseBytes = 524288
    static let maximumMetadataBytes = 4096
    let receiverSession: String
    private let context: JSContext
    private let session: JSValue
    private var exception: String?
    private var knownBodyCount = 0
    private var lastPresentedCount = 0
    private(set) var lastMetadata: AmbientCacheMetadata?
    private(set) var metadataCalls = 0, metadataBytes = 0, bodyCalls = 0, bodyBytes = 0, decodedUnits = 0
    init(bundleURL: URL, receiverSession: String = UUID().uuidString) throws {
        self.receiverSession = receiverSession
        guard let context = JSContext() else { throw AmbientLabError.bridgeFailure }
        self.context = context
        context.evaluateScript(try String(contentsOf: bundleURL, encoding: .utf8))
        guard context.exception == nil, let namespace = context.objectForKeyedSubscript("AmbientCacheReceiver"),
              let create = namespace.objectForKeyedSubscript("createSession"), let value = create.call(withArguments: [receiverSession]), !value.isUndefined else { throw AmbientLabError.bridgeFailure }
        session = value
        context.exceptionHandler = { [weak self] _, value in self?.exception = value?.toString() ?? "unknown exception" }
    }
    private func call(_ name: String, arguments: [Any] = []) throws -> String {
        exception = nil; context.exception = nil
        guard let fn = session.objectForKeyedSubscript(name), !fn.isUndefined, let value = fn.call(withArguments: arguments)?.toString(), exception == nil, context.exception == nil else { throw AmbientLabError.bridgeFailure }
        return value
    }
    @discardableResult func send(_ command: [String: Any]) throws -> AmbientCacheUpdate {
        let data = try JSONSerialization.data(withJSONObject: command, options: [.sortedKeys])
        guard data.count <= 8192, let json = String(data: data, encoding: .utf8) else { throw AmbientLabError.invalidArgument }
        return try decodeUpdate(call("executeMetaJSON", arguments: [json]))
    }
    func current() throws -> AmbientCacheUpdate { try decodeUpdate(call("snapshotMetaJSON")) }
    private func decodeUpdate(_ json: String) throws -> AmbientCacheUpdate {
        let data = Data(json.utf8)
        metadataCalls += 1; metadataBytes += data.count
        guard data.count <= Self.maximumMetadataBytes else { throw AmbientLabError.bridgeFailure }
        let m = try JSONDecoder().decode(AmbientCacheMetadata.self, from: data)
        guard m.cacheVersion == AmbientProjection.cacheVersion, m.receiverSession == receiverSession,
              m.bodyCount >= knownBodyCount, m.bodyCount <= 256, m.materialGeneration == m.bodyCount, m.nextId == m.bodyCount + 1,
              m.presentedCount >= lastPresentedCount, m.presentedCount <= m.bodyCount,
              m.aggregate.savingOff, m.aggregate.bodyCount == m.bodyCount, m.aggregate.presentedCount == m.presentedCount,
              m.aggregate.shape == m.shape, AmbientProjection.mappedShape(m.shape) != nil else { throw AmbientLabError.bridgeFailure }
        var delta: AmbientCacheDelta?
        if m.bodyCount > knownBodyCount {
            let request: [String: Any] = ["cacheVersion":m.cacheVersion,"receiverSession":receiverSession,"materialGeneration":m.materialGeneration,"afterId":knownBodyCount]
            let requestData = try JSONSerialization.data(withJSONObject: request, options: [.sortedKeys])
            let result = try call("readBodyDeltaJSON", arguments: [String(decoding: requestData, as: UTF8.self)])
            let bytes = Data(result.utf8)
            bodyCalls += 1; bodyBytes += bytes.count
            guard bytes.count <= Self.maximumResponseBytes else { throw AmbientLabError.bridgeFailure }
            let d = try JSONDecoder().decode(AmbientCacheDelta.self, from: bytes)
            guard d.cacheVersion == m.cacheVersion, d.receiverSession == receiverSession,
                  d.materialGeneration == m.materialGeneration, d.nextId == m.nextId,
                  d.bodyCount == m.bodyCount, d.afterId == knownBodyCount, d.units.count == m.bodyCount-knownBodyCount else { throw AmbientLabError.bridgeFailure }
            for (i, unit) in d.units.enumerated() {
                guard unit.id == knownBodyCount+i+1, !unit.text.isEmpty, unit.text.utf16.count <= 256,
                      [.blue,.white,.green,.purple].contains(unit.ink) else { throw AmbientLabError.bridgeFailure }
            }
            delta = d; decodedUnits += d.units.count
        }
        knownBodyCount = m.bodyCount; lastPresentedCount = m.presentedCount; lastMetadata = m
        return AmbientCacheUpdate(metadata:m,delta:delta)
    }
    func exportOff() throws -> Data { Data(try call("offExportJSON").utf8) }
    func destroy() { _ = try? call("destroy") }
    func diagnostics() -> [String: Any] {
        ["metadataCalls":metadataCalls,"metadataBytes":metadataBytes,"bodyCalls":bodyCalls,"bodyBytes":bodyBytes,"decodedUnits":decodedUnits]
    }
}
