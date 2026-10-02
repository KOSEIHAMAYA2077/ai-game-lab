# Artificial material scheduler comparison

Pure JavaScript comparison of immediate bounded material admission and slower shape scheduling. It starts from normalized synthetic known accepted-material events. No OS/clipboard/network/UI/widget source or earlier contract is executed/imported.

- [REPORT.md](REPORT.md): Japanese outcomes, adoption boundaries and limits
- [METHOD.json](METHOD.json): R1 proposed values frozen before cases
- [LIFECYCLE.md](LIFECYCLE.md): artificial clock ordering and deadlines
- [streams.mjs](streams.mjs): 17 artificial streams and fixed expected mechanism outcomes
- [scheduler.mjs](scheduler.mjs): per-word / batch / batch+hysteresis
- [results-r1-first/comparison.json](results-r1-first/comparison.json): same-stream measured mechanisms
- [R2-STORAGE-METHOD.json](R2-STORAGE-METHOD.json): post-R1 regression storage candidate
- [storage-export-r2.mjs](storage-export-r2.mjs): off export contains no raw text, per-unit ID or color order

```sh
# リポジトリのルートで実行
node experiments/ambient-material-scheduler-v1/run.mjs results-replay-r1
node experiments/ambient-material-scheduler-v1/run-storage-r2.mjs results-replay-r2
```

Output names must be fresh. R2 compares against the preserved `results-r1-first` data; it is exposed-case regression, not fresh evaluation. Tested Node v26.4.0 / ICU78.3 supports `Intl.Segmenter`; no additional package installation is needed.

R1 rawSavingOff allows body ordinal IDs/colors in an experimental metadata export and is not adopted under the parent's stricter storage gate. R2 removes that sequence. Bodies remain volatile and bounded in off mode. Explicit saving-on synthetic cases export body text. Fixture files themselves contain synthetic text for reproduction; this harness is not a real-input recorder.

Fewer shape changes/searches are mechanism outcomes only. The three lexical groups do not understand quotation or general meaning, and no comfort, actual IME, UI, upstream no-loss, resource budget or widget integration is validated. Body ID authority must be resolved before any upstream connection.

公開時のREADME/REPORTは端末固有パスを除いた文書差分。作者snapshotのPROVENANCEと実装・METHOD・初回原票は保持し、[ROOT-PUBLICATION.json](ROOT-PUBLICATION.json)に旧/新文書SHAを分ける。
