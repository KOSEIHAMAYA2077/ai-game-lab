# Artificial ambient integration contract

The R3 receiver is a candidate for a future dedicated-editor experiment. It joins a new versioned canonical gate to one material/ID authority, a shape-only sphere/box/ring lexical scheduler, and a strict storage allowlist. It does not acquire OS input or connect to the widget. Known commits are trusted synthetic producer declarations only.

The independent preimplementation method and20 manually expected cases cover map I01–I14. The canonical comparison reducer and scheduler source were read-only references. Only pinned PARAMETERS/LEXICAL_GROUPS are imported from the scheduler: none of its body/ID/reveal functions are called. This is not an adapter connected to reducer v1.

Latest same-fixture R3 regression:20/20,120 receive calls,18 actual lexical queries. Supplementary post-fixture probes:8/8; actual in-memory runtime mutants:6/6 detected; new gap regressions4/4. Independent behavioral11/11 and supplementary5/5 were reviewed separately. Initial harness failures, R1 pending provenance defect and R1/R2 activity-gap defects are retained. [REPORT.md](REPORT.md) gives evidence, limitations and adoption scope.

From repository root, with Node supporting Intl.Segmenter:

```sh
node experiments/ambient-integration-contract-v1/run.mjs results-local-r3 r3
node experiments/ambient-integration-contract-v1/run-probes.mjs results-local-probes-r3 r3
node experiments/ambient-integration-contract-v1/publish-probe-observations.mjs results-local-probes-r3
node experiments/ambient-integration-contract-v1/run-gap-r3.mjs results-local-gap-r3.json
node experiments/ambient-integration-contract-v1/audit-results.mjs results-local-r3
```

Output names must be new; runners never replace results. Omit the final receiver argument to run preserved R1; use `r2` for preserved R2. R1's20 cases pass with corrected current harness but P05 fails; R2's original probes pass but independent activity-gap probes fail. Both remain comparison baselines, not adoption candidates.

- [METHOD.json](METHOD.json), [CASES.json](CASES.json), [GRAMMAR.md](GRAMMAR.md): frozen before implementation/results.
- [receiver-r3.mjs](receiver-r3.mjs): recommended artificial implementation; [receiver.mjs](receiver.mjs)/[receiver-r2.mjs](receiver-r2.mjs) are unchanged baselines.
- [shape-only.mjs](shape-only.mjs): bounded references into the sole material body; artificial clock and stale-token gates.
- [storage-gate.mjs](storage-gate.mjs), [body-view.mjs](body-view.mjs): export validation and ephemeral renderer projection.
- [PROTOTYPE-BOUNDARY.md](PROTOTYPE-BOUNDARY.md): relative API example for a future own-textarea producer; no UI implemented.
- [PROBES-METHOD.json](PROBES-METHOD.json), [R2-REGRESSION-METHOD.json](R2-REGRESSION-METHOD.json): post-fixture regression declarations, separate from the prospective R1 test.
- `results-r1-first/`, `results-r2-harness-regression/`, `results-r3-harness-regression/`: initial raw results and harness repairs.
- `results-r4-receiver-r2-regression/`:20-case R2 rerun.
- `results-probes-r2-first/`, `results-probes-r3-receiver-r2-regression/`: first supplementary failure and corrected regression.
- `results-r5-receiver-r3-regression/`, `results-probes-r4-receiver-r3-regression/`, `results-gap-r3.json`: R3 regressions, with R3 METHOD/cases separately frozen before its implementation.

All fixture/probe text and persisted raw traces are artificial. Saving-off describes the receiver's exported user-state schema; the synthetic test repository intentionally retains its artificial fixtures/raw observations for reproducibility. It must not be used as a real input logging scheme.

Original `probes.json` files retain in-memory mutant code with runtime file URLs locally and are ignored for publication. `observations-public.json` removes only those program-source strings, retaining every assertion/failure/decision and the executed source SHA; exact mutation recipes remain in the runner. The helper never overwrites an earlier observation file.
