import AppKit
import Foundation
import simd

// Artificial ownfield callback methods only. No window, input context, IME, event monitor or pasteboard.
final class ProbeSession {
    let bridge: AmbientReceiverBridge
    let editor: AmbientTextView
    var clock = 0, held = 0
    var callbackErrors = 0
    var operationCounts = [String: Int]()
    init(bundle: URL, initial: String = "") throws {
        bridge = try AmbientReceiverBridge(bundleURL: bundle)
        editor = AmbientTextView(frame: NSRect(x: 0, y: 0, width: 350, height: 62))
        editor.isRichText = false; editor.isEditable = true; editor.allowsUndo = true
        editor.string = initial
        editor.onHeld = { [weak self] in self?.held += 1 }
        editor.onCommand = { [weak self] original in
            guard let self else { return }
            self.clock += 1
            var c = original; c["at"] = self.clock
            self.operationCounts[c["op"] as? String ?? "unknown", default: 0] += 1
            do { _ = try self.bridge.send(c) } catch { self.callbackErrors += 1 }
        }
        _ = try bridge.send(["op": "init", "at": 0, "value": initial])
    }
    @discardableResult func control(_ op: String, value: Any? = nil, ink: String? = nil) throws -> AmbientReceiverView {
        clock += 1; var c: [String:Any] = ["op": op, "at": clock]
        if let value { c["value"] = value }; if let ink { c["ink"] = ink }
        return try bridge.send(c)
    }
    func insert(_ text: Any, range: NSRange = NSRange(location: NSNotFound, length: 0), select: NSRange? = nil) {
        editor.setSelectedRange(select ?? NSRange(location: editor.string.utf16.count, length: 0))
        editor.insertText(text, replacementRange: range)
    }
    func mark(_ text: String) { editor.setMarkedText(text, selectedRange: NSRange(location: text.utf16.count, length: 0), replacementRange: NSRange(location: NSNotFound, length: 0)) }
    func current() throws -> AmbientReceiverView { try bridge.current() }
    func settle() throws -> AmbientReceiverView {
        clock = max(clock + 1, 7000)
        return try bridge.send(["op": "advance", "at": clock])
    }
}

@main struct IndependentCallbacks {
    static func main() throws {
        guard CommandLine.arguments.count == 4 else { throw AmbientLabError.invalidArgument }
        let bundle = URL(fileURLWithPath: CommandLine.arguments[1]), output = URL(fileURLWithPath: CommandLine.arguments[2]), sourceLabel = CommandLine.arguments[3]
        var rows = [[String: Any]]()
        func run(_ id: String, group: String, initial: String = "", _ body: (ProbeSession, (Bool,String)->Void) throws -> Void) throws {
            let session = try ProbeSession(bundle: bundle, initial: initial)
            var failures = [String]()
            let check: (Bool,String)->Void = { value,label in if !value { failures.append(label) } }
            do { try body(session,check) } catch { failures.append("probe-exception") }
            check(session.callbackErrors == 0, "callback-bridge-errors")
            let view = try session.current()
            check(view.units.count == view.aggregate.bodyCount, "view-body-count")
            check(Set(view.units.map(\.id)).count == view.units.count, "unique-ids")
            let inkCounts = Dictionary(grouping:view.units,by:{$0.ink.rawValue}).mapValues(\.count)
            rows.append(["id":id,"group":group,"passed":failures.isEmpty,"failures":failures,"bodyCount":view.aggregate.bodyCount,"presentedCount":view.presentedCount,"uniqueIDs":Set(view.units.map(\.id)).count,"inkCounts":inkCounts,"callbackErrors":session.callbackErrors,"heldCallbacks":session.held,"operationCounts":session.operationCounts,"status":view.aggregate.status,"reason":view.aggregate.reason,"paused":view.aggregate.paused,"visible":view.aggregate.visible,"editorUTF16":session.editor.string.utf16.count])
            session.bridge.destroy()
        }
        func samePrefix(_ before: [AmbientUnit], _ after: [AmbientUnit]) -> Bool {
            after.count >= before.count && zip(before,after).allSatisfy { a,b in a.id == b.id && a.ink == b.ink && a.text.utf16.elementsEqual(b.text.utf16) }
        }
        try run("C01",group:"independent_callback") { s,c in
            let view=try s.current(),p=AmbientProjection();_=try p.apply(view)
            let instances=ambientInstances(p.glyphs,seed:1,distance:4,scale:1,height:440,atlasRect:{_ in .zero})
            c(view.units.count==0,"baseline0");c(instances.count==0,"instances0");c(p.placeholder,"placeholder-separate")
        }
        try run("C02",group:"independent_callback") {s,c in s.insert("a");let v=try s.current();c(v.units.count==1,"plain1");c(v.units.map(\.text).joined()=="a","plain-preserved")}
        try run("C03",group:"independent_callback") {s,c in s.insert("x");let old=try s.current().units;s.insert("x");let v=try s.current();c(v.units.count==2,"same-input-twice2");c(samePrefix(old,v.units),"old-prefix");c(v.units.map(\.text).joined()=="xx","no-text-dedup")}
        try run("C04",group:"independent_callback") {s,c in s.mark("に");c(try s.current().units.isEmpty,"first-preedit0");s.mark("にほ");c(try s.current().units.isEmpty,"second-preedit0");s.editor.insertText("日本",replacementRange:NSRange(location:NSNotFound,length:0));let v=try s.current();c(v.units.count==2,"IME-final2");c(v.units.map(\.text).joined()=="日本","IME-final-preserved")}
        try run("C05",group:"independent_callback") {s,c in s.mark("仮");s.editor.unmarkText();c(try s.current().units.isEmpty,"conservative-unmark0")}
        try run("C06",group:"independent_callback") {s,c in s.insert("a");let old=try s.current().units;s.editor.string="改";s.editor.didChangeText();let v=try s.current();c(v.units.count==1,"unknown0");c(samePrefix(old,v.units),"old-prefix")}
        try run("C07",group:"independent_callback") {s,c in s.insert("abc");let old=try s.current().units;s.insert("X",range:NSRange(location:1,length:1),select:NSRange(location:1,length:1));let v=try s.current();c(v.units.count==4,"replace-add1");c(samePrefix(old,v.units),"retained-deleted-material");c(v.units.map(\.text).joined()=="abcX","replacement-only")}
        try run("C08",group:"independent_callback") {s,c in s.insert(NSAttributedString(string:"文🙂"));let v=try s.current();c(v.units.count==2,"attributed-grapheme2");c(v.units.map(\.text).joined()=="文🙂","attributed-preserved")}
        try run("C09",group:"independent_callback") {s,c in _=try s.control("ink",ink:"white");s.insert("a");let old=try s.current().units;_=try s.control("ink",ink:"green");s.insert("b");let v=try s.current();c(v.units.count==2,"two-batches2");c(v.units.map(\.ink)==[.white,.green],"ink-new-only");c(samePrefix(old,v.units),"old-prefix")}
        try run("C10",group:"independent_callback") {s,c in s.insert("ab");let old=try s.current().units;s.editor.string="a";s.editor.didChangeText();let v=try s.current();c(v.units.count==2,"delete-not-material-delete");c(samePrefix(old,v.units),"old-prefix")}
        try run("C11",group:"independent_callback") {s,c in s.insert("a");s.editor.didChangeText();s.editor.didChangeText();c(try s.current().units.count==1,"echo-no-duplicate")}
        try run("C12",group:"independent_callback") {s,c in s.insert("a");let old=try s.current().units;s.mark("未");s.editor.cancelLocalComposition();_=try s.control("visible",value:false);_=try s.control("pause",value:true);c(try s.current().units.count==1,"cancel-before-hide0");_=try s.control("visible",value:true);_=try s.control("pause",value:false);s.insert("b");let v=try s.current();c(v.units.count==2,"ownfield-resume2");c(samePrefix(old,v.units),"old-prefix");c(v.units.map(\.text).joined()=="ab","cancelled-not-material")}
        try run("B01",group:"independent_boundary") {s,c in s.insert("ab");let old=try s.settle().units,p=AmbientProjection();_=try p.apply(s.current());_=try s.control("pause",value:true);_=try s.control("visible",value:false);_=try s.control("advance");let hidden=try s.current();c(hidden.units.count==2,"hidden-retain2");c(samePrefix(old,hidden.units),"hidden-prefix");_=try p.apply(hidden);_=try s.control("visible",value:true);_=try s.control("pause",value:false);let active=try s.current();_=try p.apply(active);let packets=ambientInstances(p.glyphs,seed:1,distance:4,scale:1,height:440,atlasRect:{_ in .zero});c(active.units.count==2,"resume-retain2");c(packets.count==active.presentedCount,"projection-prefix-count");c(packets.map{Int($0.identity.x)}==Array(active.units.prefix(active.presentedCount)).map(\.id),"packet-sole-ids");c(MemoryLayout<AmbientGlyphInstance>.stride==80,"actual80B")}
        try run("B02",group:"independent_boundary") {s,c in s.insert(String(repeating:"a",count:255));let old=try s.current().units;s.insert("YZ");let v=try s.current();c(v.units.count==255,"body-capacity-whole0");c(samePrefix(old,v.units),"old255-prefix");c(v.aggregate.status=="held","capacity-held")}
        try run("B03",group:"independent_boundary") {s,c in s.insert(String(repeating:"a",count:257));let v=try s.current();c(v.units.isEmpty,"single-event-whole0");c(v.aggregate.status=="held","event-held")}
        try run("B04",group:"independent_boundary",initial:String(repeating:"a",count:511)) {s,c in c(try s.current().units.isEmpty,"baseline-not-material");s.insert("YZ");c(try s.current().units.isEmpty,"document-cap0");c(s.editor.string.utf16.count==511,"no-truncation-or-partial-editor");c(s.held>0,"document-held")}
        try run("B05",group:"independent_boundary") {s,c in s.insert("ab");let old=try s.current().units;s.bridge.destroy();s.insert("c");let v=try s.current();c(v.units.count==2,"retired-no-add");c(samePrefix(old,v.units),"retired-prefix")}
        try run("B06",group:"independent_boundary") {s,c in s.insert("本文情報");let data=try s.bridge.exportOff();let value=try JSONSerialization.jsonObject(with:data);let forbidden=Set(["body","text","document","batches","glyphs","atlas","unitTexts","units"]);func hasForbidden(_ x:Any)->Bool {if let d=x as? [String:Any] {return d.keys.contains{forbidden.contains($0)}||d.values.contains{hasForbidden($0)}};if let a=x as? [Any] {return a.contains{hasForbidden($0)}};return false};c(!hasForbidden(value),"off-no-sensitive-keys");c(!String(decoding:data,as:UTF8.self).contains("本文情報"),"off-no-text-marker")}
        try run("K01",group:"known_cancel_regression") {s,c in s.mark("仮");s.editor.cancelLocalComposition();c(try s.current().units.isEmpty,"known-cancel-reentrant0")}
        let groups=Dictionary(grouping:rows,by:{$0["group"] as! String}).mapValues { rr in ["total":rr.count,"passed":rr.filter{$0["passed"] as? Bool==true}.count] }
        let result:[String:Any]=["version":"independent-native-ambient-callback-r1","sourceLabel":sourceLabel,"groups":groups,"rows":rows,"actualWindow":false,"actualNativeIME":false,"globalOSInputCapture":false,"GPUOperations":0,"logsContainSyntheticText":false]
        try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output,options:.withoutOverwriting)
        print("Independent native callback groups: \(groups); text-free logs")
        if rows.contains(where:{$0["passed"] as? Bool==false}) {exit(1)}
    }
}
