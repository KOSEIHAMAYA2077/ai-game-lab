import AppKit
import MetalKit

final class MetalCanvas: MTKView {
    var enter: (() -> Void)?
    var orbit: ((Float, Float) -> Void)?
    var zoom: ((Float) -> Void)?
    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 36 || event.keyCode == 76 { enter?() } else { super.keyDown(with:event) }
    }
    override func mouseDown(with event: NSEvent) { window?.makeFirstResponder(self) }
    override func mouseDragged(with event: NSEvent) { orbit?(Float(event.deltaX)*0.006,Float(event.deltaY)*0.006) }
    override func scrollWheel(with event: NSEvent) { zoom?(Float(event.scrollingDeltaY)*0.001) }
    override func layout() { super.layout(); (delegate as? GlyphMetalRenderer)?.resize() }
}
final class MetalApp: NSObject, NSApplicationDelegate, NSWindowDelegate, NSTextFieldDelegate {
    var window: NSWindow!
    var canvas: MetalCanvas!
    var renderer: GlyphMetalRenderer!
    var terminal: NSTextField!
    var hint: NSTextField!
    var pauseButton: NSButton!
    let store: MetalStateStore
    let arguments: [String]
    var fixtureMode = false
    var stateReadFailure = false
    init(arguments: [String]) {
        self.arguments = arguments
        if let index = arguments.firstIndex(of: "--state-directory"), index+1 < arguments.count {
            store = MetalStateStore(directory: URL(fileURLWithPath: arguments[index+1],isDirectory:true))
        } else { store = MetalStateStore() }
        super.init()
    }
    func argument(_ name: String) -> String? { guard let i=arguments.firstIndex(of:name),i+1<arguments.count else {return nil};return arguments[i+1] }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        makeMenu()
        window = NSWindow(contentRect: NSRect(x:0,y:0,width:400,height:440),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = "Glyph Matter · Metal 3形"
        window.minSize = NSSize(width:300,height:340);window.backgroundColor = .black;window.level = .floating
        window.delegate = self;window.center()
        let content = NSView();content.wantsLayer = true;content.layer?.backgroundColor = NSColor.black.cgColor
        window.contentView = content
        canvas = MetalCanvas(frame:.zero);canvas.translatesAutoresizingMaskIntoConstraints=false;canvas.setAccessibilityLabel("入力文字による3D表面。Metalの3形比較版")
        content.addSubview(canvas)
        let controls = NSStackView();controls.orientation = .horizontal;controls.distribution = .fillEqually;controls.spacing = 6;controls.translatesAutoresizingMaskIntoConstraints=false
        for shape in MetalShape.allCases { let button = NSButton(title:shape.label,target:self,action:#selector(selectShape(_:)));button.tag=shape.rawValue;button.bezelStyle = .inline;button.contentTintColor = .white;controls.addArrangedSubview(button) }
        let inputButton=NSButton(title:"入力",target:self,action:#selector(openTerminal));inputButton.bezelStyle = .inline;inputButton.contentTintColor = .white;controls.addArrangedSubview(inputButton)
        pauseButton=NSButton(title:"止める",target:self,action:#selector(togglePause));pauseButton.bezelStyle = .inline;pauseButton.contentTintColor = .white;controls.addArrangedSubview(pauseButton)
        content.addSubview(controls)
        terminal = NSTextField();terminal.translatesAutoresizingMaskIntoConstraints=false;terminal.font = .monospacedSystemFont(ofSize:17,weight:.regular)
        terminal.textColor = .white;terminal.backgroundColor = .black;terminal.isBordered = true;terminal.isBezeled = false;terminal.focusRingType = .none;terminal.delegate = self
        terminal.placeholderString = "enter word [enter]";terminal.target=self;terminal.action=#selector(submit);terminal.isHidden=true;terminal.setAccessibilityLabel("文字を入力")
        content.addSubview(terminal)
        hint = NSTextField(labelWithString:"press enter");hint.translatesAutoresizingMaskIntoConstraints=false;hint.textColor = .white;hint.font = .monospacedSystemFont(ofSize:13,weight:.regular);hint.alignment = .center
        content.addSubview(hint)
        NSLayoutConstraint.activate([
            canvas.leadingAnchor.constraint(equalTo:content.leadingAnchor),canvas.trailingAnchor.constraint(equalTo:content.trailingAnchor),canvas.topAnchor.constraint(equalTo:content.topAnchor),canvas.bottomAnchor.constraint(equalTo:content.bottomAnchor),
            controls.leadingAnchor.constraint(equalTo:content.leadingAnchor,constant:12),controls.trailingAnchor.constraint(equalTo:content.trailingAnchor,constant:-12),controls.bottomAnchor.constraint(equalTo:content.bottomAnchor,constant:-12),controls.heightAnchor.constraint(equalToConstant:24),
            terminal.leadingAnchor.constraint(equalTo:content.leadingAnchor,constant:16),terminal.trailingAnchor.constraint(equalTo:content.trailingAnchor,constant:-16),terminal.bottomAnchor.constraint(equalTo:controls.topAnchor,constant:-12),terminal.heightAnchor.constraint(equalToConstant:32),
            hint.centerXAnchor.constraint(equalTo:content.centerXAnchor),hint.topAnchor.constraint(equalTo:content.topAnchor,constant:24),hint.leadingAnchor.constraint(greaterThanOrEqualTo:content.leadingAnchor,constant:8),hint.trailingAnchor.constraint(lessThanOrEqualTo:content.trailingAnchor,constant:-8)
        ])
        content.layoutSubtreeIfNeeded()
        do {
            var matter: MetalMatter
            if let fixture = argument("--fixture"),let count=Int(fixture),count>=1,count<=MetalMatter.maximumGlyphs {
                fixtureMode = true
                let shape = MetalShape(rawValue:Int(argument("--shape") ?? "0") ?? 0) ?? .sphere
                matter = MetalMatter.fixture(count:count,shape:shape)
            } else if let file = argument("--state-file") {
                let data=try Data(contentsOf:URL(fileURLWithPath:file));guard data.count<=2*1024*1024 else {throw MetalLabError.invalidState}
                matter=try MetalMatter.restored(JSONDecoder().decode(MetalState.self,from:data));fixtureMode=true
            } else { matter=store.load() ?? MetalMatter() }
            guard let shaderURL = Bundle.main.url(forResource:"Glyphs",withExtension:"metal") else {throw MetalLabError.missingShader}
            let metricsURL = argument("--metrics-file").map{URL(fileURLWithPath:$0)}
            renderer = try GlyphMetalRenderer(view:canvas,matter:matter,shaderURL:shaderURL,metricsURL:metricsURL)
            canvas.enter = { [weak self] in self?.openTerminal() }
            canvas.orbit = { [weak self] dy,dx in
                guard let renderer=self?.renderer else{return};renderer.turnY += dy;renderer.turnX = max(-1.4,min(1.4,renderer.turnX+dx))
                if renderer.paused && !renderer.hidden {renderer.view.draw()}
            }
            canvas.zoom = { [weak self] delta in
                guard let renderer=self?.renderer else{return};renderer.zoom = max(0.65,min(2.2,renderer.zoom*exp(delta)))
                if renderer.paused && !renderer.hidden {renderer.view.draw()}
            }
            renderer.onFrame = { [weak self] in
                guard let self else{return}
                if self.renderer.matter.glyphs.count==1 {self.hint.alphaValue = 0.3+0.7*(0.5+0.5*sin(self.renderer.matter.state.time*0.8))}
            }
            if matter.glyphs.count>1 {hint.isHidden = true}
            window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true);window.makeFirstResponder(canvas)
            renderer.setHidden(false)
        } catch {
            fputs("Metal comparison could not start: \(error)\n",stderr)
            let alert=NSAlert();alert.messageText="Metal比較版を開始できません";alert.informativeText="起動時の描画準備に失敗しました。既存の版と保存は変更していません。";alert.runModal();NSApp.terminate(nil)
        }
    }
    func makeMenu() {
        let menu=NSMenu();NSApp.mainMenu=menu
        let appItem=NSMenuItem();menu.addItem(appItem);let appMenu=NSMenu();appItem.submenu=appMenu
        for (title,action,key) in [("表示",#selector(showWindow),"o"),("隠す",#selector(hideWindow),"h"),("常に手前",#selector(toggleFloating),""),("終了",#selector(quit),"q")] {let item=NSMenuItem(title:title,action:action,keyEquivalent:key);item.target=self;appMenu.addItem(item)}
        let editItem=NSMenuItem();editItem.title="編集";menu.addItem(editItem);let editMenu=NSMenu(title:"編集");editItem.submenu=editMenu
        for (title,action,key) in [("取り消す",Selector(("undo:")),"z"),("やり直す",Selector(("redo:")),"Z"),("切り取り",#selector(NSText.cut(_:)),"x"),("コピー",#selector(NSText.copy(_:)),"c"),("貼り付け",#selector(NSText.paste(_:)),"v"),("すべて選択",#selector(NSText.selectAll(_:)),"a")] {editMenu.addItem(NSMenuItem(title:title,action:action,keyEquivalent:key))}
        let shapeItem=NSMenuItem();shapeItem.title="形";menu.addItem(shapeItem);let shapeMenu=NSMenu(title:"形");shapeItem.submenu=shapeMenu
        for shape in MetalShape.allCases {let item=NSMenuItem(title:shape.label,action:#selector(selectShapeMenu(_:)),keyEquivalent:String(shape.rawValue+1));item.tag=shape.rawValue;item.target=self;shapeMenu.addItem(item)}
    }
    @objc func showWindow() {window.makeKeyAndOrderFront(nil);NSApp.unhide(nil);NSApp.activate(ignoringOtherApps:true);renderer?.setHidden(false)}
    @objc func hideWindow() {save();renderer?.setHidden(true);window.orderOut(nil)}
    @objc func toggleFloating() {window.level = window.level == .floating ? .normal:.floating}
    @objc func quit() {NSApp.terminate(nil)}
    @objc func openTerminal() {terminal.isHidden=false;hint.isHidden=true;window.makeFirstResponder(terminal)}
    @objc func selectShape(_ sender:NSButton) {if let shape=MetalShape(rawValue:sender.tag){renderer.changeShape(shape);save()}}
    @objc func selectShapeMenu(_ sender:NSMenuItem) {if let shape=MetalShape(rawValue:sender.tag){renderer.changeShape(shape);save()}}
    @objc func togglePause() {renderer.setPaused(!renderer.paused);pauseButton.title=renderer.paused ? "動かす":"止める"}
    @objc func submit() {
        let text=terminal.stringValue
        let count=MetalMatter.split(text).count
        let repeats=max(1,min(64,Int(ceil(256/Double(max(1,count))))))
        let result=renderer.matter.add(text,repeatCount:repeats,ink:MetalInk.inText(text))
        guard result.added>0 else {
            hint.stringValue=result.reason ?? "文字を入力";hint.alphaValue=1;hint.isHidden=false;return
        }
        if let shape=MetalShape.inText(text){renderer.changeShape(shape)}
        do {
            try renderer.rebuild();let saved=save();terminal.stringValue="";terminal.isHidden=true;window.makeFirstResponder(canvas)
            hint.isHidden = saved && !result.limited
            if saved && result.limited {hint.stringValue=result.reason ?? "文字数の上限です";hint.alphaValue=1}
            if renderer.paused && !renderer.hidden {canvas.draw()}
        } catch {hint.stringValue="描画準備に失敗";hint.alphaValue=1;hint.isHidden=false}
    }
    func control(_ control:NSControl,textView:NSTextView,doCommandBy command:Selector)->Bool {
        if command == #selector(NSResponder.cancelOperation(_:)) {terminal.isHidden=true;window.makeFirstResponder(canvas);return true}
        return false
    }
    @discardableResult func save() -> Bool {
        guard let renderer,!fixtureMode else{return true}
        do {_ = try store.save(renderer.matter.state);return true} catch {hint.stringValue="保存に失敗";hint.alphaValue=1;hint.isHidden=false;return false}
    }
    func windowShouldClose(_ sender:NSWindow)->Bool {hideWindow();return false}
    func windowDidMiniaturize(_ notification:Notification){renderer?.setHidden(true)}
    func windowDidDeminiaturize(_ notification:Notification){renderer?.setHidden(false)}
    func windowDidChangeOcclusionState(_ notification:Notification){renderer?.setHidden(!window.occlusionState.contains(.visible))}
    func applicationDidHide(_ notification:Notification){renderer?.setHidden(true)}
    func applicationDidUnhide(_ notification:Notification){renderer?.setHidden(!window.isVisible)}
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply {save();renderer?.setHidden(true);return .terminateNow}
}
let application=NSApplication.shared
let delegate=MetalApp(arguments:CommandLine.arguments)
application.delegate=delegate
application.run()
