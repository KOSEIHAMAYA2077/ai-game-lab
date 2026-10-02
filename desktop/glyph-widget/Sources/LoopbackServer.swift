import Foundation
import Network

struct AssetResponse {
    let status: Int
    let reason: String
    let type: String
    let body: Data
}

// This server only reads bundled files. It never receives or records the user's text.
struct AssetRouter {
    let root: URL

    func response(method: String, target: String, host: String, port: UInt16) -> AssetResponse {
        guard method == "GET" || method == "HEAD" else {
            return failure(405, "Method Not Allowed")
        }
        guard host == "127.0.0.1:\(port)" else {
            return failure(403, "Forbidden")
        }
        let rawPath = target.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)[0]
        guard rawPath.hasPrefix("/"),
              let path = String(rawPath).removingPercentEncoding,
              !path.contains("\\"), !path.contains("\0"), !path.contains("%") else {
            return failure(400, "Bad Request")
        }
        let components = path.split(separator: "/", omittingEmptySubsequences: true)
        guard !components.contains(".."), !components.contains(".") else {
            return failure(403, "Forbidden")
        }
        if path == "/health" {
            return AssetResponse(status: 200, reason: "OK", type: "application/json",
                                 body: Data("{\"status\":\"ok\",\"app\":\"glyph-widget\"}".utf8))
        }
        let relative = path == "/" ? "widget.html" : components.joined(separator: "/")
        let base = root.resolvingSymlinksInPath().standardizedFileURL
        let file = base.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(base.path + "/") else {
            return failure(403, "Forbidden")
        }
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &directory),
              !directory.boolValue,
              let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            return failure(404, "Not Found")
        }
        return AssetResponse(status: 200, reason: "OK", type: mime(file.pathExtension), body: data)
    }

    private func failure(_ code: Int, _ reason: String) -> AssetResponse {
        AssetResponse(status: code, reason: reason, type: "text/plain; charset=utf-8", body: Data(reason.utf8))
    }

    private func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "map": return "application/json"
        case "wasm": return "application/wasm"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}

final class LoopbackAssetServer {
    private let queue = DispatchQueue(label: "GlyphMatter.loopback-assets", qos: .utility)
    private let router: AssetRouter
    private var listener: NWListener?
    private var connections: [ObjectIdentifier: NWConnection] = [:]
    private var readyDelivered = false
    private var attemptedFallback = false
    private var stopped = false
    private let preferredPort: UInt16
    private let ready: (UInt16) -> Void
    private let failed: (String) -> Void

    init(root: URL, preferredPort: UInt16, ready: @escaping (UInt16) -> Void,
         failed: @escaping (String) -> Void) {
        router = AssetRouter(root: root)
        self.preferredPort = preferredPort
        self.ready = ready
        self.failed = failed
    }

    func start() {
        queue.async { self.startListener(port: self.preferredPort) }
    }

    func stop() {
        queue.async {
            self.stopped = true
            self.listener?.cancel()
            self.connections.values.forEach { $0.cancel() }
            self.connections.removeAll()
        }
    }

    private func startListener(port: UInt16) {
        guard !stopped else { return }
        do {
            let parameters = NWParameters.tcp
            parameters.requiredInterfaceType = .loopback
            parameters.acceptLocalOnly = true
            parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback),
                                                         port: NWEndpoint.Port(rawValue: port)!)
            let listener = try NWListener(using: parameters)
            self.listener = listener
            listener.stateUpdateHandler = { [weak self, weak listener] state in
                guard let self, let listener, self.listener === listener, !self.stopped else { return }
                switch state {
                case .ready:
                    guard !self.readyDelivered, let boundPort = listener.port?.rawValue else { return }
                    self.readyDelivered = true
                    DispatchQueue.main.async { self.ready(boundPort) }
                case .failed:
                    listener.cancel()
                    if port != 0 && !self.attemptedFallback && !self.readyDelivered {
                        self.attemptedFallback = true
                        self.startListener(port: 0)
                    } else {
                        DispatchQueue.main.async { self.failed("ローカルの画面を開始できませんでした。") }
                    }
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                self?.accept(connection, port: listener.port?.rawValue ?? 0)
            }
            listener.start(queue: queue)
        } catch {
            DispatchQueue.main.async { self.failed("ローカルの画面を開始できませんでした。") }
        }
    }

    private func accept(_ connection: NWConnection, port: UInt16) {
        guard connections.count < 64, port != 0,
              case let .hostPort(host, _) = connection.endpoint,
              host == .ipv4(.loopback) || host == .ipv6(.loopback) else {
            connection.cancel()
            return
        }
        let identifier = ObjectIdentifier(connection)
        connections[identifier] = connection
        let timeout = DispatchWorkItem { [weak self, weak connection] in
            connection?.cancel()
            self?.connections.removeValue(forKey: identifier)
        }
        queue.asyncAfter(deadline: .now() + 10, execute: timeout)
        connection.stateUpdateHandler = { [weak self] state in
            if case .cancelled = state {
                timeout.cancel()
                self?.connections.removeValue(forKey: identifier)
            }
        }
        connection.start(queue: queue)
        receive(connection, data: Data(), port: port)
    }

    private func receive(_ connection: NWConnection, data accumulated: Data, port: UInt16) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, done, error in
            guard let self else { connection.cancel(); return }
            var request = accumulated
            if let data { request.append(data) }
            guard request.count <= 16_384, error == nil else { connection.cancel(); return }
            if let end = request.range(of: Data("\r\n\r\n".utf8)) {
                self.respond(connection, header: request.subdata(in: 0..<end.upperBound), port: port)
            } else if done {
                connection.cancel()
            } else {
                self.receive(connection, data: request, port: port)
            }
        }
    }

    private func respond(_ connection: NWConnection, header: Data, port: UInt16) {
        guard let text = String(data: header, encoding: .utf8) else { connection.cancel(); return }
        let lines = text.components(separatedBy: "\r\n")
        let first = lines.first?.split(separator: " ", omittingEmptySubsequences: true) ?? []
        guard first.count == 3, first[2] == "HTTP/1.1" || first[2] == "HTTP/1.0" else {
            connection.cancel()
            return
        }
        let hosts = lines.dropFirst().compactMap { line -> String? in
            let fields = line.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            guard fields.count == 2, fields[0].lowercased() == "host" else { return nil }
            return fields[1].trimmingCharacters(in: .whitespaces)
        }
        let response = router.response(method: String(first[0]), target: String(first[1]),
                                       host: hosts.count == 1 ? hosts[0] : "", port: port)
        let head = "HTTP/1.1 \(response.status) \(response.reason)\r\n" +
            "Content-Type: \(response.type)\r\nContent-Length: \(response.body.count)\r\n" +
            "Cache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\n" +
            "Referrer-Policy: no-referrer\r\nConnection: close\r\n\r\n"
        var output = Data(head.utf8)
        if first[0] != "HEAD" { output.append(response.body) }
        connection.send(content: output, completion: .contentProcessed { _ in connection.cancel() })
    }
}
