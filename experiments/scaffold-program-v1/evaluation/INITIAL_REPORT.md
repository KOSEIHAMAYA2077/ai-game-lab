# Initial independent controller evaluation

Synthetic Japanese and English fixtures were frozen before the relation controller was completed. The base set contains 30 cases; the separate same-primitive set contains six. Their hashes and the first model revision are in `initial-cpu.json`. No fixture text exactly overlaps the recorded training or validation data. This does not establish separation at the semantic/template level.

The first CPU run passed the finite output contract in all 36 cases. Full meaning matched in **21/30** base cases and **5/6** same-primitive cases. In the base set, 17/26 requested structures were interpreted correctly and all four intended holds were correct. The attribute checks passed 10/10 conditions in the base set and 11/12 in the same-primitive set.

| Base group | Full meaning correct |
|---|---:|
| Single primitive | 6/6 |
| End attachment | 1/4 |
| Above placement | 2/4 |
| Through placement | 3/4 |
| Attributes scoped to different parts | 4/4 |
| Negation | 1/4 |
| Ordinary prose | 2/2 |
| Unsupported requests | 2/2 |

Of the 23 requests for a relation, the learned relation head was actually invoked in 16. Its top label matched the independent label in 16/16 of those cases; one correct `end` prediction was nevertheless held because its confidence was below the threshold. The other seven relation requests failed before the head, chiefly in rule-based part extraction or negation handling. The conditional 16/16 score is **not** a claim that the full controller handles relations perfectly: the complete requested-program result remains 22/32 across both sets.

Eight failed cases concern syntax or negation, one collapses two English tubes into one, and one holds a correctly ranked but uncertain relation. Failure details remain in the immutable JSON result. These cases have now been shared with implementation agents, so any later test of them is a regression evaluation, not a fresh independent accuracy estimate.

The CPU controller alone took 4.02 ms median and 21.50 ms p95 on the base set, and 7.49/8.17 ms on the same-primitive set. Model initialization took 713 ms. The Python process peak RSS was 714 MiB. These measurements exclude geometry, glyph placement, browser rendering and the absorption animation. The test machine is an Apple M5 Mac with 32 GB memory; they do not establish performance on the requested 16 GB laptop CPU/iGPU target.

Next: test the complete browser/WASM path, independently inspect actual surface contact and geometry rejection, and report the full visible completion timer separately from model-only time. Initial figures above remain unchanged after fixes.
