# Prospective synthetic sentence evaluation v1

This is an AI-authored synthetic fixture, not human annotation and not a sample of real players. Expected intent and allowed geometric equivalences are subjective author judgments. Sentence clarity does not imply that the implemented renderer matches the object. The fixture author must freeze this file and the fixture before reading the candidate corpus, calibration rows, implementation, thresholds, or outputs.

## Frozen task definition

- 140 full sentences: 80 clear single-shape requests, 40 clear hold cases, and 20 ambiguous descriptions or poetry. Each stratum is balanced between Japanese and English.
- Every positive row has an exact expected authored shape label. `permitted_labels` explicitly lists only accepted alternatives for the limited family score; no alternative is inferred during scoring. Exact and family scores are reported separately. A row with a single permitted label gets no family relaxation.
- A nullable `primitive` maps a row to one of `sphere`, `box`, `tube`, `ring`, `blade`, or `vase` only where this author judges the intended geometry unambiguous. Other authored shapes have no forced primitive equivalence. In particular, a ring is not a Möbius strip, and a torus-like object is not a tube.
- A clear hold expects a hold/reject decision: cancellation or prohibition; mention or quotation without generation intent; unsupported physical object; or conflicting intent that does not specify one shape. The candidate is evaluated as supplied; no new negation guard is silently inserted by this evaluator.
- Ambiguous rows have no correctness target. Their accepted fraction and raw outputs are descriptive. They never enter accuracy or precision denominators.
- Each row includes an author reason. These reasons are explanations of the synthetic labeling decision, not evidence of human agreement.

## Metrics

Let a decision be accepted only when the frozen candidate interface declares acceptance and returns a non-null label. A returned unknown label is accepted but incorrect. Report counts and percentages overall and separately for Japanese and English.

1. Positive exact-label accuracy: correct exact accepted outputs / all 80 positive requests.
2. Positive permitted-family accuracy: accepted output in the row's explicit `permitted_labels` / all 80 positive requests.
3. Positive coverage: all accepted positive outputs / all 80 positive requests.
4. Positive accepted exact precision and permitted-family precision: corresponding correct accepted positive outputs / accepted positive outputs. A zero denominator is reported as null, never as 100%.
5. Clear-hold false activation: accepted outputs / all 40 clear holds; also report each hold subtype.
6. Accepted exact precision over all unambiguous rows: correct exact accepted positive outputs / all accepted positive and clear-hold outputs. Report the permitted-family counterpart separately. These fixture-weighted values depend on the authored 80:40 mix and are not production prevalence estimates.
7. Ambiguous acceptance: accepted outputs / 20 ambiguous rows, without an accuracy claim.
8. Primitive subset: report the 6-way candidate's exact primitive accuracy, coverage, accepted precision, and raw decisions only for positive rows whose `primitive` is non-null. Clear holds are separately scored if actually submitted to that candidate. Do not count unsubmitted rows or force other authored labels into six primitives.
9. Label coverage: unique exact expected authored labels, positive count per label, and labels actually accepted/correct. Report the denominators of every subset.

## Evaluation and provenance

Freeze JSON bytes and this method's bytes with SHA-256 before candidate access. Record the freeze time, allowed-label source hash, creator (`AI/manual`), and that no human validated the fixture. Send the fixture hash to the coordinator before opening candidate material.

Run the frozen interface on the original full `text` field for every submitted row. Do not replace sentences with extracted keywords, translate them, add prompts, or apply a post-hoc gate. Log the exact input delivered to the candidate (`actual_query`), the acceptance decision, label, scores/margins if provided, interface/model identities and hashes, errors, and per-call timing. If the implementation transforms the query internally, preserve that transformed query separately where accessible.

Audit full-text overlap after freeze against all identifiable candidate training, calibration, and caption text. Compare Unicode-NFKC/lowercased/whitespace-collapsed full strings and separately note exact-byte equality; do not call shared geometry words leakage. If any source is unavailable, report that scope as unavailable rather than asserting independence from it. A full-text duplicate is disclosed but never edited out after seeing results.

Save raw decisions before scoring. Save all failures, elapsed startup/query timing, a summary, and the frozen manifest. Do not tune the candidate or fixture after seeing this holdout. A later fix requires a new independently authored prospective benchmark; this fixture becomes regression material.

## Scope of conclusions

This checks text-to-caption retrieval and the candidate's frozen rejection behavior on manually chosen sentences. It does not establish Japanese semantic understanding, general intent parsing, compositional instruction following, native game behavior, renderer fidelity, IME correctness, play quality, offline resource use, or UI operation. Adoption recommendations must name measured limited cases and disclose failures and subjective mappings. The Mac is locked; this evaluation must not claim normal UI or player interaction validation.
