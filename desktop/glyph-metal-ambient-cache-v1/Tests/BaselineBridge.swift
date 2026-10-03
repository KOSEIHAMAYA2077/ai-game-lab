// Test-only namespace and aggregate counters; original R5 guard/policy byte provenance pinned.
// R2 fixed finite response bound, originalbridge/source/app retained.
import Foundation
import JavaScriptCore

final class BaselineReceiverBridge {
    static let maximumResponseBytes = 524288
    private let context: JSContext
    private let session: JSValue
    private var exception: String?
    private(set) var lastView: AmbientReceiverView?
    private(set) var fullCalls = 0
    private(set) var fullBytes = 0
    init(bundleURL: URL) throws {
        guard let context = JSContext() else { throw AmbientLabError.bridgeFailure }
        self.context = context
        let source = try String(contentsOf: bundleURL, encoding: .utf8)
        context.evaluateScript(source)
        guard context.exception == nil, let namespace = context.objectForKeyedSubscript("AmbientNativeReceiver"),
              let create = namespace.objectForKeyedSubscript("createSession"), let value = create.call(withArguments: []), !value.isUndefined else { throw AmbientLabError.bridgeFailure }
        session = value
        context.exceptionHandler = { [weak self] _, value in self?.exception = value?.toString() ?? "unknown exception" }
    }
    private func call(_ name: String, arguments: [Any] = []) throws -> String {
        exception = nil; context.exception = nil
        guard let fn = session.objectForKeyedSubscript(name), !fn.isUndefined, let value = fn.call(withArguments: arguments)?.toString(), exception == nil, context.exception == nil else { throw AmbientLabError.bridgeFailure }
        return value
    }
    @discardableResult func send(_ command: [String: Any]) throws -> AmbientReceiverView {
        let data = try JSONSerialization.data(withJSONObject: command, options: [.sortedKeys])
        guard data.count <= 8192, let json = String(data: data, encoding: .utf8) else { throw AmbientLabError.invalidArgument }
        let result = try call("executeJSON", arguments: [json])
        fullCalls += 1; fullBytes += result.utf8.count
        let value = try decodeView(result); lastView = value; return value
    }
    func current() throws -> AmbientReceiverView {
        try decodeView(call("snapshotJSON"))
    }
    private func decodeView(_ json: String) throws -> AmbientReceiverView {
        let data = Data(json.utf8)
        guard data.count <= Self.maximumResponseBytes else { throw AmbientLabError.bridgeFailure }
        return try JSONDecoder().decode(AmbientReceiverView.self, from: data)
    }
    func exportOff() throws -> Data { Data(try call("offExportJSON").utf8) }
    func destroy() { _ = try? call("destroy") }
}
