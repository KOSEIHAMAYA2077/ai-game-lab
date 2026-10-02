import AppKit
import Foundation

// Artificial callback-method tests. No window, native input event, or IME engine.
@main struct OwnEditorCallbacks {
    static func main() throws {
        guard CommandLine.arguments.count == 3 else { throw AmbientLabError.invalidArgument }
        let bundle = URL(fileURLWithPath: CommandLine.arguments[1])
        let output = URL(fileURLWithPath: CommandLine.arguments[2])
        var rows = [[String: Any]](), failures = [[String: Any]]()
        for index in 1...6 {
            let id = String(format:"N%02d",index), bridge = try AmbientReceiverBridge(bundleURL:bundle)
            let editor=AmbientTextView(frame:NSRect(x:0,y:0,width:350,height:62))
            editor.isRichText=false; editor.allowsUndo=true
            var time=0, held=false, traces=[[String: Any]](), errors=[String]()
            var expected="", expectedCount=0
            editor.onHeld={ held=true }
            editor.onCommand={ original in
                var command=original;time+=1;command["at"]=time
                do {
                    let view=try bridge.send(command)
                    traces.append(["command":command,"view":try JSONSerialization.jsonObject(with:JSONEncoder().encode(view))])
                } catch { errors.append("callback-bridge") }
            }
            if index==6 {editor.string=String(repeating:"A",count:511)}
            _=try bridge.send(["op":"init","at":0,"value":editor.string])
            func insert(_ text:String) {
                editor.setSelectedRange(NSRange(location:editor.string.utf16.count,length:0))
                editor.insertText(text,replacementRange:NSRange(location:NSNotFound,length:0))
            }
            switch index {
            case 1:
                insert("A");time+=1;_=try bridge.send(["op":"ink","ink":"green","at":time]);insert("B")
                expected="AB";expectedCount=2
            case 2:
                editor.setMarkedText("仮",selectedRange:NSRange(location:1,length:0),replacementRange:NSRange(location:NSNotFound,length:0))
                if try bridge.current().units.count != 0 {errors.append("preedit-material")}
                editor.insertText("輪",replacementRange:NSRange(location:NSNotFound,length:0))
                expected="輪";expectedCount=1
            case 3:
                editor.setMarkedText("仮",selectedRange:NSRange(location:1,length:0),replacementRange:NSRange(location:NSNotFound,length:0));editor.unmarkText()
            case 4:
                insert("AB")
                for value in ["A","AB","A"] {editor.string=value;editor.didChangeText()}
                expected="AB";expectedCount=2
            case 5:
                insert("👩🏽‍💻");insert("X");expected="👩🏽‍💻X";expectedCount=2
            case 6: insert("BB")
            default:break
            }
            time=max(time+1,7000)
            let view=try bridge.send(["op":"advance","at":time])
            let actual=view.units.map(\.text).joined()
            if !actual.utf16.elementsEqual(expected.utf16) || view.units.count != expectedCount {errors.append("material")}
            if index==1 && view.units.map(\.ink) != [.blue,.green] {errors.append("ink-prefix")}
            if index==6 && (!held || editor.string.utf16.count != 511) {errors.append("field-cap")}
            rows.append(["id":id,"passed":errors.isEmpty,"errors":errors,"body":actual,"units":view.units.count,"document":editor.string,"held":held,"traces":traces])
            if !errors.isEmpty {failures.append(["id":id,"errors":errors])}
            bridge.destroy()
        }
        let result:[String: Any]=["version":"own-editor-callback-r1","passed":rows.filter{$0["passed"] as? Bool==true}.count,"runs":rows,"failures":failures,"artificialMethodCallsOnly":true,"actualNativeWindow":false,"actualNativeIME":false]
        try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]).write(to:output,options:.withoutOverwriting)
        print("6 artificial own-editor callback probes; failures=\(failures.count)")
        if !failures.isEmpty {exit(1)}
    }
}
