# Artificial ambient input contract

Independent pure JavaScript reducer and manually authored synthetic event tests. No widget imports, OS/clipboard monitoring, real documents, UI, permission changes or network calls.

Publication note: [PROVENANCE.json](PROVENANCE.json) records the author's completed snapshot. README and REPORT later removed a local workstation path and added this clarification. Their original and current document hashes are recorded separately in [ROOT-PUBLICATION.json](ROOT-PUBLICATION.json); the five implementation/interface/contract/harness hashes and original result files are unchanged. [Root replay](results-root-replay-r1/summary.json) independently repeated the artificial cases. This contract is not yet connected to the platform schema or widget storage.

- [REPORT.md](REPORT.md): results and adoption limits in Japanese
- [CONTRACT.md](CONTRACT.md): source evidence, ordering, composition, edit reasons, finite buffers and retention
- [contract.d.ts](contract.d.ts): TypeScript event interface
- [reducer.mjs](reducer.mjs): independent implementation
- [fixtures.mjs](fixtures.mjs): artificial events with hardcoded expected outcomes
- [run.mjs](run.mjs): bounded-producer harness, probes and mutation checks
- [results-final-v2/summary.json](results-final-v2/summary.json): canonical completed run and SHA-256 provenance

```sh
# リポジトリのルートで実行
node experiments/ambient-input-contract-v1/run.mjs results-replay
```

Use a new `results-…` suffix to preserve earlier raw output. The runner allows output only inside this experiment directory. No package installation is needed on the tested Node v26.4.0 runtime. Generated intentionally incorrect variants are ignored test runtime, never production implementations.

Provisional adoption: known commits may append from a cooperative source; raw keys are activity only; unknown commit quality is reversible preview; activity-only stores no text; initial whole-document material capture is not adopted. Document-sync remains a separate comparison and its original-baseline scope and identity/color limitations are explicit. The harness's artificial finalBody/finalDocument raw output is unsuitable for recording real text.
