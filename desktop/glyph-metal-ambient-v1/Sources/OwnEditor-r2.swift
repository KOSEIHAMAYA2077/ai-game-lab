// R2 known cancellation correction; R1 source/app/results are preserved.
import AppKit

// This field's callbacks only. No event taps, global monitors or pasteboard queries.
final class AmbientTextView: NSTextView {
    var onCommand: (([String: Any]) -> Void)?
    var onHeld: (() -> Void)?
    private var performingInsert = false
    private var cancellingComposition = false
    private var compositionBase: String?
    private var compositionRange: NSRange?
    private func plain(_ value: Any) -> String? {
        if let value = value as? String { return value }
        return (value as? NSAttributedString)?.string
    }
    override func shouldChangeText(in affectedCharRange: NSRange, replacementString: String?) -> Bool {
        let count = string.utf16.count
        guard affectedCharRange.location <= count, affectedCharRange.length <= count - affectedCharRange.location,
              count - affectedCharRange.length + (replacementString?.utf16.count ?? 0) <= 512 else { onHeld?(); return false }
        return super.shouldChangeText(in: affectedCharRange, replacementString: replacementString)
    }
    override func setMarkedText(_ string: Any, selectedRange: NSRange, replacementRange: NSRange) {
        guard let text = plain(string), text.utf16.count <= 512 else { onHeld?(); return }
        if cancellingComposition { super.setMarkedText(string, selectedRange: selectedRange, replacementRange: replacementRange); return }
        if compositionBase == nil {
            let range = replacementRange.location == NSNotFound ? self.selectedRange() : replacementRange
            compositionBase = self.string; compositionRange = range
            onCommand?(["op": "mark-start", "base": self.string, "range": [range.location, range.length]])
        }
        super.setMarkedText(string, selectedRange: selectedRange, replacementRange: replacementRange)
        onCommand?(["op": "mark-update", "text": text])
    }
    override func insertText(_ insertString: Any, replacementRange: NSRange) {
        guard let text = plain(insertString) else { onHeld?(); return }
        let wasComposition = compositionBase != nil || hasMarkedText()
        let base = compositionBase ?? self.string
        let range = compositionRange ?? (replacementRange.location == NSNotFound ? selectedRange() : replacementRange)
        let source = base as NSString
        guard range.location != NSNotFound, range.location <= source.length, range.length <= source.length - range.location,
              source.length - range.length + text.utf16.count <= 512 else { onHeld?(); return }
        performingInsert = true
        super.insertText(insertString, replacementRange: replacementRange)
        performingInsert = false
        // AppKit unmark can re-enter insertText; explicit cancellation is document-only.
        if cancellingComposition { return }
        let markedAfter = hasMarkedText()
        if markedAfter {
            onCommand?(["op": "mark-update", "text": text]); return
        }
        // JavaScript additionally checks exact UTF16/range/stable canonical base.
        onCommand?(["op": "commit", "base": base, "value": self.string, "text": text,
                    "range": [range.location, range.length], "postMarked": markedAfter, "fromComposition": wasComposition])
        compositionBase = nil; compositionRange = nil
    }
    override func unmarkText() {
        if performingInsert || cancellingComposition { super.unmarkText(); return }
        cancellingComposition = true
        compositionBase = nil; compositionRange = nil
        super.unmarkText()
        cancellingComposition = false
        onCommand?(["op": "mark-cancel", "value": string])
    }
    override func didChangeText() {
        super.didChangeText()
        guard !performingInsert && !cancellingComposition && !hasMarkedText() && compositionBase == nil else { return }
        // Deletion/history/paste routes without a confirmed insert callback are document-only.
        onCommand?(["op": "observe", "value": string])
    }
    func cancelLocalComposition() {
        guard compositionBase != nil || hasMarkedText() else { return }
        unmarkText()
    }
}
