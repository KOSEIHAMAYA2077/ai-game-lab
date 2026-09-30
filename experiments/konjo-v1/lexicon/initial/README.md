# Initial lexical data — rejected mapping retained

The first compilation mapped `bolt` to the hardware fastener synset
`02865665-n`. The actual authored `bolt` geometry is lightning. This was
a schema/meaning error, not a renderer or WordNet error. Parent review
identified it before publication. The corresponding artificial example
`positive-27` also encoded the incorrect expectation.

These four JSON files preserve that state for comparison; the app imports
only `prototypes/glyph-creature/src/data/konjo-wordnet.json`. The current
seed manifest selects lightning senses `11475279-n` and `11519121-n`, and
current `positive-27` asks for lightning. Excluded ambiguous synonyms and
the complete current counts are in the current build report.
