type WritingToken = { text: string; pending: boolean };

const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
const graphemes = (text: string) => Array.from(segmenter.segment(text.normalize('NFC')), part => part.segment);

/** Tracks newly written text without re-emitting the restored or already received manuscript. */
export class LiveWriting {
  private tokens: WritingToken[] = [];

  constructor(initial = '') { this.load(initial); }

  load(text: string) {
    this.tokens = graphemes(text).map(text => ({ text, pending: false }));
  }

  update(next: string) {
    const chars = graphemes(next);
    let prefix = 0;
    while (prefix < this.tokens.length && prefix < chars.length && this.tokens[prefix].text === chars[prefix]) prefix++;
    let suffix = 0;
    while (suffix < this.tokens.length - prefix && suffix < chars.length - prefix &&
      this.tokens[this.tokens.length - 1 - suffix].text === chars[chars.length - 1 - suffix]) suffix++;
    const inserted = chars.slice(prefix, chars.length - suffix).map(text => ({ text, pending: true }));
    // Avoid a spread argument to splice: a large paste can exceed the call argument limit.
    this.tokens = this.tokens.slice(0, prefix).concat(inserted, this.tokens.slice(this.tokens.length - suffix));
  }

  take(): string {
    const added: string[] = [];
    for (const token of this.tokens) {
      if (token.pending) { added.push(token.text); token.pending = false; }
    }
    return added.join('');
  }
}
