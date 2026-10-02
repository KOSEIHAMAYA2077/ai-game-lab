# 再現（独立CPU候補、既定へ接続しない）

repository rootから。追加download/installは不要、Node v26.4.0と既存local Rolldown1.2.11を使用。candidateのみは標準JavaScriptで、Node module adapterにfs/pathがあるだけ。

```js
const {predict, rank, info} = await import('./experiments/ambient-shape-retrieval-v1/api.mjs');
const result = predict('庭で小鳥が歌った。', {current:'mobius', mode:'full'});
// accepted / shape(null on hold) / nextShape / rawTop1 / actual query / ranking60
// proposalを返すだけ。OS入力・保存・renderer接続なし。
```

baselineは `prepare.mjs` の `baseline(text)`。import時は資料copyを書かず、現凍結sourceに対するTS syntax transform/compile-time JSON展開だけを行う。直接 `node prepare.mjs` は既存snapshotファイルがあるとwxで停止する。元fixture/旧sourceを上書きする処理はない。

prepare→build-weights→author-dev→run-dev→verify→freezeの初回成果は保存済み。R0weightも削除せず保存。再生成するとwxで拒否されるので、比較再実行は新しい版/出力名を設けてsourceSHAと区別する。

CPU harness:

```text
node --expose-gc experiments/ambient-shape-retrieval-v1/bench-node.mjs
node experiments/ambient-shape-retrieval-v1/prepare-jsc.mjs
swiftc experiments/ambient-shape-retrieval-v1/JSCProbe.swift -o experiments/ambient-shape-retrieval-v1/jsc-probe-r1
experiments/ambient-shape-retrieval-v1/jsc-probe-r1
```

上の成果CPU-NODE-R1.json/JSC-CASES-R1.json/CPU-JSC-R1.jsonは存在するため、同名で実行すると最後の保存はwx/withoutOverwritingで拒否される。candidateの再importとpredictはread-only。JSCProbe.swiftはFoundation/JavaScriptCoreのみのCPU console検証、UI/OSイベント取得はない。生成executable jsc-probe-r1は検証用で配布アプリではない。

SOURCE.jsonは元資料/TS、FREEZE-R1.jsonはcandidate/weight/方法/dev/output/原source/Node/主要localdep SHA。FREEZE-SUPPORT-R1.jsonはgeneratorと追加transitive dep3件。独立評価は別担当の新fixture、candidateとdevの編集所有を分けた。評価本文は実装前に見ていない。ライセンスはlicenses/に残す。
