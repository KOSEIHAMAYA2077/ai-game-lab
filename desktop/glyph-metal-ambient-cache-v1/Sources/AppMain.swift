// Cache transport integration only; original editor callback/renderer behavior unchanged.
import AppKit
import MetalKit

final class AmbientCanvas: MTKView {
    var orbit: ((Float, Float) -> Void)?
    var zoom: ((Float) -> Void)?
    override func mouseDragged(with event: NSEvent) { orbit?(Float(event.deltaX) * 0.006, Float(event.deltaY) * 0.006) }
    override func scrollWheel(with event: NSEvent) { zoom?(Float(event.scrollingDeltaY) * 0.001) }
    override func layout() { super.layout(); (delegate as? AmbientRenderer)?.resize() }
}
final class AmbientApp: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private var canvas: AmbientCanvas!
    private var renderer: AmbientRenderer!
    private let projection = AmbientProjection()
    private var bridge: AmbientReceiverBridge!
    private var editor: AmbientTextView!
    private var scroll: NSScrollView!
    private var placeholder: NSTextField!
    private var status: NSTextField!
    private var inputButton: NSButton!
    private var pauseButton: NSButton!
    private var helpPopover: NSPopover!
    private var inkPopup: NSPopUpButton!
    private var paused = false, hidden = false, pendingRebuild = false
    private var lastDiagnostic = -100.0
    private var diagnosisURL: URL?
    private func now() -> Int { Int(ProcessInfo.processInfo.systemUptime * 1000) }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        if let i = CommandLine.arguments.firstIndex(of: "--diagnostics-file"), i + 1 < CommandLine.arguments.count { diagnosisURL = URL(fileURLWithPath: CommandLine.arguments[i + 1]) }
        makeMenu()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 440), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "入力と面の比較"; window.minSize = NSSize(width: 300, height: 340); window.backgroundColor = .black; window.level = .floating
        window.isRestorable = false; window.delegate = self; window.center()
        let content = NSView(); content.wantsLayer = true; content.layer?.backgroundColor = NSColor.black.cgColor; window.contentView = content
        canvas = AmbientCanvas(frame: .zero); canvas.translatesAutoresizingMaskIntoConstraints = false; canvas.setAccessibilityLabel("文字の面の比較"); content.addSubview(canvas)
        placeholder = NSTextField(labelWithString: "@"); placeholder.font = .monospacedSystemFont(ofSize: 90, weight: .regular); placeholder.textColor = NSColor(calibratedRed: 0.25, green: 0.48, blue: 1, alpha: 1); placeholder.translatesAutoresizingMaskIntoConstraints = false
        placeholder.setAccessibilityLabel("材料ではない仮表示"); content.addSubview(placeholder)
        let controls = NSStackView(); controls.orientation = .horizontal; controls.spacing = 8; controls.translatesAutoresizingMaskIntoConstraints = false
        inputButton = NSButton(title: "INPUT", target: self, action: #selector(toggleInput)); controls.addArrangedSubview(inputButton)
        inkPopup = NSPopUpButton(frame: .zero, pullsDown: false)
        for (title, ink) in [("青", "blue"), ("白", "white"), ("緑", "green"), ("紫", "purple")] { inkPopup.addItem(withTitle: title); inkPopup.lastItem?.representedObject = ink }
        inkPopup.target = self; inkPopup.action = #selector(selectInk); inkPopup.setAccessibilityLabel("追加する文字の色"); controls.addArrangedSubview(inkPopup)
        pauseButton = NSButton(title: "PAUSE", target: self, action: #selector(togglePause)); controls.addArrangedSubview(pauseButton)
        controls.addArrangedSubview(NSButton(title: "HELP", target: self, action: #selector(showHelp)))
        for view in controls.arrangedSubviews { if let b = view as? NSButton { b.bezelStyle = .inline; b.contentTintColor = .white } }
        content.addSubview(controls)
        scroll = NSScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false; scroll.hasVerticalScroller = true; scroll.drawsBackground = true; scroll.backgroundColor = .black; scroll.borderType = .lineBorder
        editor = AmbientTextView(frame: NSRect(x: 0, y: 0, width: 350, height: 62)); editor.isRichText = false; editor.isEditable = true; editor.isSelectable = true; editor.allowsUndo = true
        editor.font = .monospacedSystemFont(ofSize: 16, weight: .regular); editor.textColor = NSColor(calibratedRed: 0.65, green: 0.76, blue: 1, alpha: 1); editor.backgroundColor = .black
        editor.isAutomaticSpellingCorrectionEnabled = false; editor.isAutomaticQuoteSubstitutionEnabled = false; editor.isAutomaticDashSubstitutionEnabled = false
        editor.isVerticallyResizable = true; editor.isHorizontallyResizable = false; editor.textContainer?.widthTracksTextView = true; editor.setAccessibilityLabel("この比較版専用の入力欄")
        scroll.documentView = editor; content.addSubview(scroll)
        status = NSTextField(labelWithString: ""); status.font = .monospacedSystemFont(ofSize: 11, weight: .regular); status.textColor = .gray; status.translatesAutoresizingMaskIntoConstraints = false; content.addSubview(status)
        NSLayoutConstraint.activate([
            canvas.leadingAnchor.constraint(equalTo: content.leadingAnchor), canvas.trailingAnchor.constraint(equalTo: content.trailingAnchor), canvas.topAnchor.constraint(equalTo: content.topAnchor), canvas.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            placeholder.centerXAnchor.constraint(equalTo: content.centerXAnchor), placeholder.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            controls.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 12), controls.trailingAnchor.constraint(lessThanOrEqualTo: content.trailingAnchor, constant: -12), controls.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -10), controls.heightAnchor.constraint(equalToConstant: 24),
            scroll.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 12), scroll.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -12), scroll.bottomAnchor.constraint(equalTo: controls.topAnchor, constant: -10), scroll.heightAnchor.constraint(equalToConstant: 62),
            status.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 12), status.bottomAnchor.constraint(equalTo: scroll.topAnchor, constant: -6)
        ])
        content.layoutSubtreeIfNeeded()
        do {
            guard let bundle = Bundle.main.url(forResource: "Receiver", withExtension: "js"), let shader = Bundle.main.url(forResource: "Glyphs", withExtension: "metal") else { throw AmbientLabError.missingShader }
            bridge = try AmbientReceiverBridge(bundleURL: bundle)
            try projection.bindSession(bridge.receiverSession)
            _ = try projection.apply(bridge.send(["op": "init", "at": now()]))
            renderer = try AmbientRenderer(view: canvas, projection: projection, shaderURL: shader)
            renderer.onFrame = { [weak self] in self?.tick() }
            editor.onCommand = { [weak self] command in self?.send(command) }
            editor.onHeld = { [weak self] in self?.status.stringValue = "保留" }
            canvas.orbit = { [weak self] dy, dx in guard let r = self?.renderer else { return }; r.turnY += dy; r.turnX = max(-1.4, min(1.4, r.turnX + dx)) }
            canvas.zoom = { [weak self] delta in guard let r = self?.renderer else { return }; r.zoom = max(0.65, min(2.2, r.zoom * exp(delta))) }
            window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); window.makeFirstResponder(editor)
            renderer.setHidden(false); updateStatus()
        } catch { status.stringValue = "準備を確認できません"; canvas.isPaused = true }
    }
    private func consume(_ view: AmbientCacheUpdate) throws {
        let old = projection.shape
        let added = try projection.apply(view), next = projection.shape
        if old != next { projection.shape = old; renderer.changeShape(next) }
        if added { pendingRebuild = true }
        if pendingRebuild && !paused && !hidden { try renderer.rebuild(); pendingRebuild = false }
        placeholder.isHidden = !projection.placeholder; updateStatus(); writeDiagnostics()
    }
    private func send(_ original: [String: Any]) {
        guard bridge != nil else { return }
        var command = original; command["at"] = now()
        do { try consume(bridge.send(command)) } catch { status.stringValue = "保留" }
    }
    private func tick() { guard !paused && !hidden else { return }; send(["op": "advance"]) }
    private func updateStatus() {
        guard let a = bridge?.lastMetadata?.aggregate else { return }
        let label = paused ? "停止中" : a.composing ? "変換中" : a.status == "held" || a.status == "unsupported" ? "保留" : a.status == "unknown" ? "未確認" : ""
        status.stringValue = label
        status.setAccessibilityLabel("素材\(a.bodyCount)、表示\(a.presentedCount)、\(label)")
    }
    private func writeDiagnostics(force: Bool = false) {
        guard let url = diagnosisURL, let r = renderer, let a = bridge?.lastMetadata?.aggregate else { return }
        let uptime = ProcessInfo.processInfo.systemUptime
        guard force || uptime - lastDiagnostic >= 1 else { return }; lastDiagnostic = uptime
        var object = r.diagnostics(); for (key, value) in bridge.diagnostics() { object[key] = value }; object["version"] = "metal-ambient-cache-v1-r1"; object["pid"] = ProcessInfo.processInfo.processIdentifier
        object["bodyCount"] = a.bodyCount; object["presentedCount"] = a.presentedCount; object["status"] = a.status; object["reason"] = a.reason; object["savingOff"] = true
        if let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) { try? data.write(to: url, options: .atomic) }
    }
    private func exposure(_ hide: Bool) {
        hidden = hide; renderer?.setHidden(hide); send(["op": "visible", "value": !hide]); writeDiagnostics(force: true)
    }
    @objc private func togglePause() {
        paused.toggle(); renderer?.setPaused(paused); send(["op": "pause", "value": paused]); pauseButton.title = paused ? "RESUME" : "PAUSE"; writeDiagnostics(force: true)
    }
    @objc private func toggleInput() { scroll.isHidden.toggle(); if !scroll.isHidden { window.makeFirstResponder(editor) } else { editor.cancelLocalComposition(); window.makeFirstResponder(canvas) } }
    @objc private func selectInk() { if let ink = inkPopup.selectedItem?.representedObject as? String { send(["op": "ink", "ink": ink]) } }
    @objc private func showHelp(_ sender: NSButton) {
        if helpPopover == nil {
            helpPopover = NSPopover(); helpPopover.behavior = .transient
            let controller = NSViewController(); controller.view = NSView(frame: NSRect(x: 0, y: 0, width: 330, height: 230))
            let label = NSTextField(wrappingLabelWithString: "この欄だけの入力を使う比較です。OSや他アプリから取得しません。Enter不要で確認した追加文字だけを素材にします。変換中・未知入力は0追加。削除/undo後も素材を残す扱いは暫定です。\n\n球/箱/輪の字句3候補。輪→メビウスは表示比較用で、普通の輪と同じ意味・形ではありません。16面/60形の意味モデルではありません。\n\n素材256、本文512 UTF-16、一回の追加256 UTF-16。保存off、終了時に消えます。初期@は材料0の仮表示。15fps上限、停止/非表示中は描画停止。実IME・常駐資源は未検証。")
            label.frame = NSRect(x: 12, y: 12, width: 306, height: 206); label.font = .systemFont(ofSize: 11); controller.view.addSubview(label); helpPopover.contentViewController = controller
        }
        helpPopover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
    }
    private func makeMenu() {
        let menu = NSMenu(); NSApp.mainMenu = menu
        let item = NSMenuItem(); menu.addItem(item); let app = NSMenu(); item.submenu = app
        for (title, action, key) in [("表示", #selector(showWindow), "o"), ("隠す", #selector(hideWindow), "h"), ("終了", #selector(quit), "q")] { let entry = NSMenuItem(title: title, action: action, keyEquivalent: key); entry.target = self; app.addItem(entry) }
        let editItem = NSMenuItem(title: "編集", action: nil, keyEquivalent: ""); menu.addItem(editItem); let edit = NSMenu(title: "編集"); editItem.submenu = edit
        for (title, action, key) in [("取り消す", Selector(("undo:")), "z"), ("やり直す", Selector(("redo:")), "Z"), ("切り取り", #selector(NSText.cut(_:)), "x"), ("コピー", #selector(NSText.copy(_:)), "c"), ("貼り付け", #selector(NSText.paste(_:)), "v"), ("すべて選択", #selector(NSText.selectAll(_:)), "a")] { edit.addItem(NSMenuItem(title: title, action: action, keyEquivalent: key)) }
    }
    @objc private func hideWindow() { editor?.cancelLocalComposition(); exposure(true); window.orderOut(nil) }
    @objc private func showWindow() { window.makeKeyAndOrderFront(nil); NSApp.unhide(nil); NSApp.activate(ignoringOtherApps: true); exposure(false) }
    @objc private func quit() { NSApp.terminate(nil) }
    func windowShouldClose(_ sender: NSWindow) -> Bool { hideWindow(); return false }
    func windowDidMiniaturize(_ notification: Notification) { exposure(true) }
    func windowDidDeminiaturize(_ notification: Notification) { exposure(false) }
    func windowDidChangeOcclusionState(_ notification: Notification) { exposure(!window.occlusionState.contains(.visible)) }
    func windowDidResignKey(_ notification: Notification) { editor?.cancelLocalComposition() }
    func applicationDidHide(_ notification: Notification) { exposure(true) }
    func applicationDidUnhide(_ notification: Notification) { exposure(!window.isVisible) }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { showWindow(); return false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { exposure(true); bridge?.destroy(); return .terminateNow }
}
@main struct AmbientEntryPoint {
    static func main() {
        let application = NSApplication.shared
        let delegate = AmbientApp()
        application.delegate = delegate
        application.run()
    }
}
