# Integrity and result verification

- Recomputed fixture and SCORING_METHOD SHA-256 after evaluation; both still equal their independent frozen values.
- Recomputed candidate manifest, runtime, caption, method and calibration hashes before executing; all match the independently frozen candidate v2.
- Verified all 1,816 predict calls and 908 separate raw-rank calls received the original full fixture text exactly. Counts follow four variants × two registries (140 shape + 87 primitive) × two operating modes for predictions, and four variants × (140 + 87) for ranks.
- Verified 140 unique fixture IDs and balanced per-language strata (40 positives, 20 holds, 10 ambiguous). All 60 exact authored labels appear; primitive mapping exists only for 27 positive requests.
- No exception or stderr warnings occurred in the candidate evaluation or the authored-rule runner. Normal local dependency bundling was used only for the pure authored language module; no page, DOM or app was launched.
- Checked 128-float32/float16 predictions pairwise by registry/mode/ID: all accepted/hold decisions and accepted labels match. Raw shape top1 differs on one input, en-P30 (snake versus fireworks); both candidates hold it. Raw top1 agreement is therefore 139/140, not universal equality.
- Verified the raw predictions, independently recomputed counts, and report tables agree. The only prospective family relaxation is cube/cuboid. Post-freeze mapping conflicts were retained in the primary scores and disclosed in a separate 77-positive sensitivity subset.

The fixture and scoring method are frozen. All reported human-intent labels are AI/manual author judgments without human validation. Source-catalog mapping and renderer fidelity remain limitations; no UI, IME, end-user latency, game resource use or player experience was validated.
