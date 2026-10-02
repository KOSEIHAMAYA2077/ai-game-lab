import AppKit
import WebKit

final class WidgetMetrics: NSObject, WKScriptMessageHandler {
    private let output: URL?
    private var lastWrite: TimeInterval = 0
    private(set) var counters: [String: Any] = [:]
    var nativeSnapshot: (() -> [String: Any])?

    private let numberKeys: Set<String> = [
        "frames", "renderCount", "frameCount", "updates", "renderedGlyphs", "storedGlyphs",
        "glyphCount", "fps", "uptimeSeconds", "workerCount", "renderMs", "renderP95Ms",
        "lastRenderMs", "modelBytes", "targetFPS", "totalFrames", "totalRenders"
    ]
    private let booleanKeys: Set<String> = [
        "modelLoaded", "visible", "paused", "busy", "workerActive", "animating"
    ]

    init(output: URL?) { self.output = output }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "widgetMetrics", message.frameInfo.isMainFrame,
              let dictionary = message.body as? [String: Any] else { return }
        var clean: [String: Any] = [:]
        for (key, value) in dictionary {
            if numberKeys.contains(key), let number = value as? NSNumber,
               CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue.isFinite,
               abs(number.doubleValue) <= 1e15 {
                clean[key] = number
            } else if booleanKeys.contains(key), let number = value as? NSNumber,
                      CFGetTypeID(number) == CFBooleanGetTypeID() {
                clean[key] = number
            }
        }
        counters = clean
        save(force: false)
    }

    func save(force: Bool) {
        guard let output else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard force || now - lastWrite >= 1 else { return }
        lastWrite = now
        var snapshot = nativeSnapshot?() ?? [:]
        snapshot["web"] = counters
        snapshot["recordedAt"] = ISO8601DateFormatter().string(from: Date())
        guard let data = try? JSONSerialization.data(withJSONObject: snapshot, options: [.prettyPrinted, .sortedKeys]) else { return }
        do {
            try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: output, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.path)
        } catch { /* Diagnostics are optional and never affect the window. */ }
    }
}

final class GlyphWidgetDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: LoopbackAssetServer?
    private var localPort: UInt16 = 0
    private var lastVisible: Bool?
    private var navigationReady = false
    private var topItem: NSMenuItem!
    private let metrics: WidgetMetrics

    init(metrics: WidgetMetrics) { self.metrics = metrics }

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenu()
        let controller = WKUserContentController()
        controller.add(metrics, name: "widgetMetrics")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = controller
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.underPageBackgroundColor = .black
        webView.autoresizingMask = [.width, .height]

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 440),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Glyph Matter"
        window.backgroundColor = .black
        window.appearance = NSAppearance(named: .darkAqua)
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.contentMinSize = NSSize(width: 280, height: 320)
        window.contentMaxSize = NSSize(width: 800, height: 900)
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.level = .floating
        window.delegate = self
        window.contentView = webView
        window.center()
        window.setFrameAutosaveName("GlyphMatterCompanionWindow")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        metrics.nativeSnapshot = { [weak self] in self?.nativeMetrics() ?? [:] }
        metrics.save(force: true)
        guard let resources = Bundle.main.resourceURL else { fail(); return }
        let web = resources.appendingPathComponent("web", isDirectory: true)
        guard FileManager.default.fileExists(atPath: web.appendingPathComponent("widget.html").path) else { fail(); return }
        let savedPort = UserDefaults.standard.integer(forKey: "GlyphWidgetLoopbackPort")
        let preferred = savedPort >= 1024 && savedPort <= 65_535 ? UInt16(savedPort) : 0
        server = LoopbackAssetServer(root: web, preferredPort: preferred, ready: { [weak self] port in
            guard let self else { return }
            self.localPort = port
            UserDefaults.standard.set(Int(port), forKey: "GlyphWidgetLoopbackPort")
            let url = URL(string: "http://127.0.0.1:\(port)/widget.html?native=1")!
            self.webView.load(URLRequest(url: url))
            self.metrics.save(force: true)
        }, failed: { [weak self] _ in self?.fail() })
        server?.start()
    }

    private func installMenu() {
        let menu = NSMenu()
        let application = NSMenuItem()
        let appMenu = NSMenu(title: "Glyph Matter")
        appMenu.addItem(withTitle: "Glyph Matterを表示", action: #selector(showWindow), keyEquivalent: "o").target = self
        appMenu.addItem(withTitle: "Glyph Matterを隠す", action: #selector(hideWindow), keyEquivalent: "h").target = self
        appMenu.addItem(.separator())
        topItem = appMenu.addItem(withTitle: "手前に表示", action: #selector(toggleOnTop), keyEquivalent: "t")
        topItem.target = self
        topItem.state = .on
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Glyph Matterを終了", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        application.submenu = appMenu
        menu.addItem(application)

        let edit = NSMenuItem()
        let editMenu = NSMenu(title: "編集")
        editMenu.addItem(withTitle: "取り消す", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "切り取り", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "コピー", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "貼り付け", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "すべて選択", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        edit.submenu = editMenu
        menu.addItem(edit)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "ウインドウ")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "閉じる", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        menu.addItem(windowItem)
        NSApp.windowsMenu = windowMenu
        NSApp.mainMenu = menu
    }

    @objc private func showWindow() {
        NSApp.unhide(nil)
        if window.isMiniaturized { window.deminiaturize(nil) }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        publishVisibility()
    }

    @objc private func hideWindow() {
        NSApp.hide(nil)
        publishVisibility()
    }

    @objc private func toggleOnTop() {
        let floating = window.level == .floating
        window.level = floating ? .normal : .floating
        topItem.state = floating ? .off : .on
        publishVisibility()
    }

    private var visible: Bool {
        window != nil && window.isVisible && !window.isMiniaturized && !NSApp.isHidden &&
            window.occlusionState.contains(.visible)
    }

    private func publishVisibility(force: Bool = false) {
        guard window != nil else { return }
        let now = visible
        if navigationReady && (force || lastVisible != now) {
            lastVisible = now
            let code = "window.dispatchEvent(new CustomEvent('glyph-widget-lifecycle',{detail:{visible:\(now ? "true" : "false")}}));"
            webView.evaluateJavaScript(code, completionHandler: nil)
        }
        metrics.save(force: true)
    }

    private func nativeMetrics() -> [String: Any] {
        ["pid": ProcessInfo.processInfo.processIdentifier,
         "nativeVisible": visible,
         "nativeHidden": NSApp.isHidden,
         "nativeMiniaturized": window?.isMiniaturized ?? false,
         "nativeOccluded": !(window?.occlusionState.contains(.visible) ?? false),
         "nativeAlwaysOnTop": window?.level == .floating,
         "port": Int(localPort),
         "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"]
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        navigationReady = true
        lastVisible = nil
        publishVisibility(force: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url,
              url.scheme == "http", url.host == "127.0.0.1", url.port == Int(localPort),
              navigationAction.targetFrame?.isMainFrame == true else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        navigationReady = false
        webView.reload()
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        publishVisibility()
        return false
    }
    func windowDidMiniaturize(_ notification: Notification) { publishVisibility() }
    func windowDidDeminiaturize(_ notification: Notification) { publishVisibility() }
    func windowDidChangeOcclusionState(_ notification: Notification) { publishVisibility() }
    func applicationDidHide(_ notification: Notification) { publishVisibility() }
    func applicationDidUnhide(_ notification: Notification) { publishVisibility() }
    func applicationDidBecomeActive(_ notification: Notification) { publishVisibility() }
    func applicationDidResignActive(_ notification: Notification) { publishVisibility() }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow()
        return true
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationWillTerminate(_ notification: Notification) {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "widgetMetrics")
        server?.stop()
    }

    private func fail() {
        let alert = NSAlert()
        alert.messageText = "文字の画面を開けませんでした"
        alert.informativeText = "widget.htmlを含むWebビルドから、アプリを作り直してください。"
        alert.runModal()
        NSApp.terminate(nil)
    }
}

let arguments = CommandLine.arguments
var metricsOutput: URL?
if let position = arguments.firstIndex(of: "--metrics-file"), arguments.indices.contains(position + 1) {
    let path = arguments[position + 1]
    if path.hasPrefix("/") { metricsOutput = URL(fileURLWithPath: path) }
}
let application = NSApplication.shared
application.setActivationPolicy(.regular)
let delegate = GlyphWidgetDelegate(metrics: WidgetMetrics(output: metricsOutput))
application.delegate = delegate
application.run()
