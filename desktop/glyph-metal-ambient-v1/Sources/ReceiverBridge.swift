import Foundation
import JavaScriptCore

final class AmbientReceiverBridge {
    private let context: JSContext
    private let session: JSValue
    private var exception: String?
    private(set) var lastView: AmbientReceiverView?
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
        guard let bytes = result.data(using: .utf8), bytes.count <= 131072 else { throw AmbientLabError.bridgeFailure }
        let value = try JSONDecoder().decode(AmbientReceiverView.self, from: bytes); lastView = value; return value
    }
    func current() throws -> AmbientReceiverView {
        let data = Data(try call("snapshotJSON").utf8)
        return try JSONDecoder().decode(AmbientReceiverView.self, from: data)
    }
    func exportOff() throws -> Data { Data(try call("offExportJSON").utf8) }
    func destroy() { _ = try? call("destroy") }
}
