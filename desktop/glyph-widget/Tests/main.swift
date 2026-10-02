import Foundation
import Network

let fixture = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: fixture, withIntermediateDirectories: true)
try Data("<html>fixture</html>".utf8).write(to: fixture.appendingPathComponent("widget.html"))
try Data("export const ok = true;".utf8).write(to: fixture.appendingPathComponent("worker.js"))
try Data([0, 97, 115, 109]).write(to: fixture.appendingPathComponent("module.wasm"))
try FileManager.default.createSymbolicLink(at: fixture.appendingPathComponent("outside"),
                                         withDestinationURL: URL(fileURLWithPath: "/etc"))
let router = AssetRouter(root: fixture)
var checks = 0
func expect(_ condition: @autoclosure () -> Bool, _ label: String) {
    guard condition() else { fatalError("FAIL: \(label)") }
    checks += 1
}
func reply(_ target: String, method: String = "GET", host: String = "127.0.0.1:49152") -> AssetResponse {
    router.response(method: method, target: target, host: host, port: 49_152)
}
expect(reply("/").status == 200, "default widget route")
expect(reply("/widget.html?native=1").status == 200, "query does not enter file path")
expect(reply("/worker.js").type == "text/javascript; charset=utf-8", "ES module MIME")
expect(reply("/module.wasm").type == "application/wasm", "WASM MIME")
expect(reply("/widget.html", method: "POST").status == 405, "no input submission route")
expect(reply("/widget.html", host: "evil.example:49152").status == 403, "DNS rebinding Host rejected")
expect(reply("/widget.html", host: "127.0.0.1:49153").status == 403, "different port rejected")
expect(reply("/../etc/passwd").status == 403, "plain traversal rejected")
expect(reply("/%2e%2e/etc/passwd").status == 403, "encoded traversal rejected")
expect(reply("/%252e%252e/etc/passwd").status == 400, "double encoded traversal rejected")
expect(reply("/outside/passwd").status == 403, "symlink escape rejected")
expect(reply("/widget.html%00").status == 400, "null byte rejected")
expect(reply("/widget.html%5c").status == 400, "backslash rejected")
expect(reply("http://evil.example/widget.html").status == 400, "absolute-form target rejected")
expect(reply("/missing.js").status == 404, "missing asset")

var complete = false
let server = LoopbackAssetServer(root: fixture, preferredPort: 0, ready: { port in
    let url = URL(string: "http://127.0.0.1:\(port)/health")!
    URLSession.shared.dataTask(with: url) { data, response, error in
        expect(error == nil && (response as? HTTPURLResponse)?.statusCode == 200, "actual loopback GET")
        expect(data == Data("{\"status\":\"ok\",\"app\":\"glyph-widget\"}".utf8), "health has no user data")
        var request = URLRequest(url: URL(string: "http://127.0.0.1:\(port)/worker.js")!)
        request.httpMethod = "HEAD"
        URLSession.shared.dataTask(with: request) { data, response, error in
            expect(error == nil && (response as? HTTPURLResponse)?.statusCode == 200, "actual loopback HEAD")
            expect(data?.isEmpty == true, "HEAD contains no body")
            complete = true
        }.resume()
    }.resume()
}, failed: { _ in fatalError("FAIL: loopback listener") })
server.start()
let deadline = Date().addingTimeInterval(15)
while !complete && Date() < deadline {
    _ = RunLoop.main.run(mode: .default, before: Date().addingTimeInterval(0.1))
}
expect(complete, "server requests finish")
server.stop()
print("PASS: \(checks) native asset/server checks")
