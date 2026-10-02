# Freeze and provenance

All input is synthetic. There was no external text collection, OS/clipboard monitoring, network call, UI operation, widget call, package installation or Git operation. One agent authored and implemented only this new experiment folder. Parent's native resource quiet interval was respected: documents/cases only before the explicit end message, then pure runners. No source in the returned upstream folders was edited.

Before implementation or results, parent was notified of:

|Frozen file|SHA256|
|---|---|
|METHOD.json|ef0aa7f0347132e73da949d7227f551b7b880ac7ad51cec9759e9466248e7f57|
|CASES.json|c7ffe342746c2c83d76d2721ae39a5440af3502db9d0cdf29082daaa826be208|
|GRAMMAR.md|1d19c22fd2ac759237ed407c61e524ccc1da1c112b9103ff6b15109fff5e9511|

Those three hashes stayed unchanged through all regressions. After R3 harness results, supplementary expectations were separately frozen before implementation/execution: PROBES-METHOD.json `4229c8e1f7fbfcb6e3c7087194b315b704d27793c986d99114a7ee9f1c186954`. R2-REGRESSION-METHOD.json `4ead5e66cc226f7ad32237dfb3c4a3ec947e685578beecf49fb9a56c6501e797` records the post-result receiver correction. RECOVERY-REGRESSION.json `4008be420e0a054f0658a3a73d29c79fd330913bf7b75493a12d663ae28666e9` was frozen before the post-review recovery test.

|Implementation|SHA256|
|---|---|
|receiver.mjs, original R1 preserved|c10e352cef8534c416ccad4c6b0565cf71245008bbcb2300e9b163da10c323a8|
|receiver-r2.mjs, correction candidate|96550b3131ad8275d61d5463d11f5e9f0684a8959897f6a45d8452c472df2e57|
|shape-only.mjs, unchanged R1|bc2e3ce24f5fe43889dc2527ef741bb620f57d24f3c754acfbb1b67024c83239|
|storage-gate.mjs|7eb88202152658ff5ad944b483f0579130677c61741a4e939c08e16fc826c3c0|
|body-view.mjs|7bbca53b4849b1e652cc97c07d8a141c8c9b17af4974066110af428dc74bee36|
|run.mjs, R2-selectable corrected harness|d69f99713b25923ea1f265bb3052696655e6c3653536933a39f689d59098e593|
|run-probes.mjs, R2-selectable harness|d10ff6153bd0d926831170df25bce7466f397404ded3be9ebb94a83b86fdc5a2|

Exact initial source snapshots are in results-r1-first/source. Changed runner versions are retained in subsequent source subfolders. The snapshots are for audit at original source location, not directly runnable from their nested archive paths. Corrected current runners reproduce the preserved R1 receiver or the explicit `r2` candidate; old initial harness failures are historical observations. Raw result folders are never overwritten. The recommended latest summary hashes are `42e5d0aedc6f35db52158b8ca5799fb1486825d5bda1d536df9330a213af4427` (20-case R2) and `3012fdb34f6d9b15d91229d92591aaf87b626b765ad0596be91800f5d605269e` (supplementary R2).

Runtime mutants were executed as alternate in-memory modules, not edits to frozen source. M01 removes operation gates; M02 consumes no-ACK watermarks; M03 promotes unknown document quality; M04 reuses ID1; M05 accepts stale/absent answer; M06 exports raw off body. All6 were detected by concrete count/identity/gate outcomes. The original private probes.json retains executed module text with runtime file URLs; .gitignore excludes it from publication. observations-public.json removes only those source strings, records the local raw digest, and retains all findings/expected/actual/decisions and executed source hash. Mutation recipes are reconstructible from relative runner source. This publication transform is separate from the receiver's saving-off schema.

Read-only sources and hashes (same before/after):

|Reference|SHA256|
|---|---|
|experiments/ambient-input-contract-v1/reducer.mjs|785d53ff236f27977ee2b034e146eab1da86519aaa692cc3cabffdbf604b2f57|
|experiments/ambient-material-scheduler-v1/scheduler.mjs|78f2fb2b32a90e1bf712a2f4e2647f9ce4493ad5e5f3a033f7c6441ca64b1bc2|
|experiments/ambient-material-scheduler-v1/storage-export-r2.mjs|a26def7f01860dfc8f6e7c626ade125458394ca3d5556149ccd5f6df726c9981|
|experiments/ambient-integration-map-v1/INTEGRATION_CASES.json|4df5cbcb722844e2d179129ba340c4c92493715eae4d69f7080974598df103a7|

The map README was read initially at `96212583fcea0b8db328eecd227def507942d68ce5bf449bfa726e640e955af5`; final read-only check observed `24578f6fe7bf29df60efd83e4c53d32ced68884a5421096d2fecc396066d2368`. This agent did not edit it. The map's proposal cases and pinned implementation constants stayed unchanged. Requirements inspired the new cases, but no map expected/pass result was imported.

Executed environment: Node v26.4.0, ICU78.3, Darwin arm64. Clock values are artificial integer milliseconds. Harness durations and serialized state size are observations of this experiment only. Reproduction commands in README are repository-root relative; no machine-specific path is needed. Existing source/research/Git ownership remains with parent.
