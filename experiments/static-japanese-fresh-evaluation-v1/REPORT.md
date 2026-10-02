# Independent synthetic static retrieval evaluation v1

The frozen 128-float32 guarded candidate correctly accepted 23/80 clear requests and falsely activated on 3/40 clear holds. Its positive accepted precision was 23/23 (100%), but accepted precision including clear holds was 23/26 (88.5%). This is evidence for a conservative experimental retrieval option, not a default general Japanese/English intent parser. English coverage was only 2/40 (5%). No app adoption or UI/play/resource validation was performed.

The fixture was AI/manual authored without human annotation. 140 original full sentences contain 80 positive requests, 40 clear holds and 20 ambiguous descriptions; each stratum is JA/EN balanced. All 60 enum labels are represented, but three post-freeze meaning/subtype conflicts and abstract/flat authored shapes limit that coverage claim. Positive words include periphrases, colloquials and intentional typos. Scores are subjective intent-to-authored-label judgments, not human agreement.

Fixture SHA-256: `1f0d971a19adbba9551799f5543bb2e42b9e144c6fdf8028d428d4c7f0affb1e`. Scoring SHA-256: `721b787efc4d3d12a72ccd5ecc62021505c356cf8a5160ad65db2264aed5b536`. Candidate frozen manifest SHA-256: `ee83896eb1f074a787a8f587d12577761c399b224d5b5a8675351c5b5884abe1`. All sentences and scoring prose were authored before candidate-interface information arrived; hashes were recorded after that interface message but before any candidate source, numeric threshold, calibration, caption, or result access. This chronology is disclosed in frozen-fixture.json. No tuning followed evaluation.

## All frozen rows: 60-label retrieval

| Variant/mode | Exact positive | Permitted-family | Coverage | Accepted positive precision | Clear-hold activation | Accepted unambiguous precision | Ambiguous accepted |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1024-float32/retrieval_only | 39/80 | 39/80 | 43/80 (53.8%) | 90.7% | 17/40 | 65.0% | 16/20 |
| 1024-float32/guarded | 30/80 | 30/80 | 34/80 (42.5%) | 88.2% | 5/40 | 76.9% | 12/20 |
| 128-float32/retrieval_only | 18/80 | 18/80 | 18/80 (22.5%) | 100.0% | 5/40 | 78.3% | 3/20 |
| 128-float32/guarded | 23/80 | 23/80 | 23/80 (28.7%) | 100.0% | 3/40 | 88.5% | 5/20 |
| 128-float16/retrieval_only | 18/80 | 18/80 | 18/80 (22.5%) | 100.0% | 5/40 | 78.3% | 3/20 |
| 128-float16/guarded | 23/80 | 23/80 | 23/80 (28.7%) | 100.0% | 3/40 | 88.5% | 5/20 |
| chargram/retrieval_only | 1/80 | 1/80 | 1/80 (1.2%) | 100.0% | 0/40 | 100.0% | 0/20 |
| chargram/guarded | 18/80 | 18/80 | 20/80 (25.0%) | 90.0% | 1/40 | 85.7% | 4/20 |

Only cube/cuboid had prospectively permitted family relaxation. No ring/Möbius, generic flower/rose, animal-family, or broad solid-family equivalence was granted. Exact and permitted-family accepted counts happen to be equal; this does not justify merging labels. Ambiguous acceptance has no correctness target.

| Variant | Raw top1 exact | Raw top1 permitted family | JA raw top1 | EN raw top1 |
|---|---:|---:|---:|---:|
| 1024-float32 | 52/80 | 54/80 | 37/40 | 15/40 |
| 128-float32 | 48/80 | 49/80 | 36/40 | 12/40 |
| 128-float16 | 48/80 | 49/80 | 36/40 | 12/40 |
| chargram | 40/80 | 41/80 | 32/40 | 8/40 |

The 1024 and 128-float32 raw top1 choices agree on 103/140 full inputs. Float16 and 128-float32 agree on 139/140 inputs. All thresholded accepted/hold decisions matched between 128-float32 and float16 across both registries/modes. Raw top1 differed on en-P30 (snake versus fireworks), which both variants held. These observations do not prove universal equivalence.

## Japanese and English at frozen guard modes

| Variant/language | Exact positive | Accepted positive | Positive accepted precision | Hold activation | Accepted unambiguous precision |
|---|---:|---:|---:|---:|---:|
| 1024-float32/ja | 25/40 | 26/40 | 96.2% | 4/20 | 83.3% |
| 1024-float32/en | 5/40 | 8/40 | 62.5% | 1/20 | 55.6% |
| 128-float32/ja | 21/40 | 21/40 | 100.0% | 3/20 | 87.5% |
| 128-float32/en | 2/40 | 2/40 | 100.0% | 0/20 | 100.0% |
| chargram/ja | 17/40 | 17/40 | 100.0% | 1/20 | 94.4% |
| chargram/en | 1/40 | 3/40 | 33.3% | 0/20 | 33.3% |

JA and EN cover different distributions of labels and phrases: the first seven labels overlap, while many of the 60 labels are present only once in one language. This is not a controlled estimate of language-only effects. matched_first_seven_labels in supplemental-analysis.json reports the 14 requests sharing seven exact labels; those are different sentences rather than paired translations. All-language percentages depend on this synthetic distribution.

## Same 60 authored-rule baseline

| Baseline/language | Exact positive | Permitted-family | Positive accepted | Hold activation | Ambiguous accepted |
|---|---:|---:|---:|---:|---:|
| shapeChoices + interpret/overall | 40/80 | 41/80 | 56/80 | 25/40 | 13/20 |
| shapeChoices + interpret/ja | 22/40 | 23/40 | 34/40 | 13/20 | 7/10 |
| shapeChoices + interpret/en | 18/40 | 18/40 | 22/40 | 12/20 | 6/10 |

The shape baseline calls existing shapeChoices(full_text) and interpret(full_text, DEFAULT_SPEC), preserving the normal deterministic first-candidate behavior. It accepts only when shapeChoices selected at least one shape. All candidate lists and multiple-choice cases are saved. A separate recognized_scene_prediction diagnostic includes count/motion/color recognition that can retain the default sphere without selecting a new shape; it is not the main comparable shape-only baseline. No rules or app state were changed.

## Separately mapped six-primitive subset

Only 27 positive requests have an explicit prospectively frozen sphere/box/tube/ring/blade/vase mapping (JA7, EN20). No other authored shape is forced into this registry. All 40 clear hold and 20 ambiguous row was also submitted, giving 87 inputs per variant/mode.

| Variant/mode | Primitive exact | Positive accepted | Positive accepted precision | Hold activation | Ambiguous accepted |
|---|---:|---:|---:|---:|---:|
| 1024-float32/retrieval_only | 8/27 | 8/27 | 100.0% | 11/40 | 7/20 |
| 1024-float32/guarded | 4/27 | 4/27 | 100.0% | 5/40 | 4/20 |
| 128-float32/retrieval_only | 10/27 | 10/27 | 100.0% | 16/40 | 8/20 |
| 128-float32/guarded | 5/27 | 5/27 | 100.0% | 5/40 | 5/20 |
| 128-float16/retrieval_only | 10/27 | 10/27 | 100.0% | 16/40 | 8/20 |
| 128-float16/guarded | 5/27 | 5/27 | 100.0% | 5/40 | 5/20 |
| chargram/retrieval_only | 3/27 | 3/27 | 100.0% | 8/40 | 2/20 |
| chargram/guarded | 1/27 | 1/27 | 100.0% | 1/40 | 3/20 |

This six-way result is a separate retrieval task, not a 60-class model score. The candidate is not a trained head; fixed caption max-cosine retrieval and thresholding supply decisions.

## Mapping validity and failure evidence

Three post-freeze mapping conflicts remain in all original scores: ja-P25 fan-shaped shell versus authored spiral shell; ja-P34 threaded fastener versus authored lightning bolt; en-P24 open ribbon strip versus a tied bow caption. mapping-audit.json records these and a 77 positive sensitivity subset. This subset is post-hoc, not a replacement prospective score; the remaining mappings also lack human validation. Renderer fidelity is untested.

| Variant/mode, mapping sensitivity | Exact positive | Positive accepted | Hold activation |
|---|---:|---:|---:|
| 1024-float32/retrieval_only | 38/77 | 41/77 | 17/40 |
| 1024-float32/guarded | 29/77 | 32/77 | 5/40 |
| 128-float32/retrieval_only | 18/77 | 18/77 | 5/40 |
| 128-float32/guarded | 22/77 | 22/77 | 3/40 |

The selected guarded 128 candidate still activates on ja-H02(`さっき剣って言ったけど取り消す。何も作らなくていい。`), ja-H09(the hypothetical quoted cube input), and ja-H20(the contradictory equal-edge/triple-edge box). These show missed cancellation language, quotation/mention intent, and geometric contradiction. A regex veto prevents some negatives, but also rejects legitimate single-object requests containing `with`, `and`, `without` or Japanese absence/relative phrases. For example, a vase whose bottom is closed and mouth open remains one object.

1024 retrieval confused en-P01 smooth glass marble with hourglass; en-P02 solid die with square; and en-P33 misspelled flower vase with flower. Different label captions/aliases compete even when nouns describe parts or usecases. Each label collapses its own captions by maximum score before the top-two-label margin, so the margin is not between duplicate same-label captions; variable caption counts and broad aliases still influence competition. raw-rankings.jsonl and supplemental-analysis.json preserve top 10 and expected ranks/scores.

Mean pooling cannot generally recover order or relational roles. The evaluator supplied full sentences exactly; no extracted short phrases inflated accuracy. Passing a word/description retrieval test is not evidence of understanding prohibition, negation scope, quotes, contradictory attributes, or composition. The guard_modes use separately calibrated fixed thresholds, so their changes combine threshold and rule effects. Only these pre-frozen operating points are compared; no post-hoc operating threshold was selected.

## Provenance, timing, and scope

Caption/alias and calibration full-text overlap was 0 under exact and Unicode-NFKC/lowercase/whitespace normalized complete-string comparisons. The audit covers all identifiable candidate task strings; pretrained training text is unavailable, so no pretraining non-overlap claim is made. Shared geometry labels, properties and short vocabulary are intentional. Raw decisions preserve actual full query text, guard-normalized text, scores, margins, timing, token metadata and interface hashes. No evaluation exceptions or stderr warnings occurred.

Candidate loads including integrity checks and caption-index creation were 1024-float32:104.6ms, 128-float32:44.3ms, 128-float16:36.4ms, chargram:17.5ms. Query timings are in summary.json; setup/query results are CPU-process observations in the locked-screen multi-agent Mac session. They are not app RAM, idle CPU, screen behavior, IME, play quality or end-user latency measurements. No network was used by this evaluator.

Retain the 128-float32 guarded variant as an optional experiment on explicitly requested known geometry and independently inspect its holds; do not promote it as a general semantic parser or default replacement. This fixture supports a limited conditional retrieval benefit but also shows sparse English acceptance and remaining false activation. Any attempted guard/caption/threshold improvements must use fresh independently authored prospective data; these 140 rows are now regression material.

Files: fixture.json + frozen-fixture.json + SCORING_METHOD.md; raw-predictions.jsonl and raw-rankings.jsonl; summary.json; failure-cases.json; authored-rules-raw.jsonl/summary/provenance; mapping-audit.json; overlap-audit.json; supplemental-analysis.json; run-provenance.json.
