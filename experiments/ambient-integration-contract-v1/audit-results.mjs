import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { validateStorage } from './storage-gate.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const folder = process.argv[2] ?? 'results-r4-receiver-r2-regression';
if (!/^[A-Za-z0-9_-]+$/.test(folder)) throw new Error('result folder basename required');
const casesFile = path.join(here, 'CASES.json'), runsFile = path.join(here, folder, 'runs.json');
const cases = JSON.parse(fs.readFileSync(casesFile)).cases, runs = JSON.parse(fs.readFileSync(runsFile));
const findings = []; let activeWorkChecked = 0;
for (const run of runs) {
  const fixture = cases.find(c => c.id === run.id);
  const activeAt = at => {
    let visible = true, paused = false;
    for (const step of fixture.events.filter(e => e.at <= at)) {
      if (step.kind === 'visibility') visible = step.data.visible;
      if (step.kind === 'pause') paused = step.data.paused;
    }
    return visible && !paused;
  };
  for (const kind of ['queries', 'reveals', 'changes']) for (const row of run.histories[kind]) {
    activeWorkChecked++; if (!activeAt(row.at)) findings.push({ id: run.id, kind, row, reason: 'work while hidden/paused' });
  }
  if (run.histories.queries.length !== run.actual.queries) findings.push({ id: run.id, reason: 'query count lacks matching raw records' });
  const storage = validateStorage(run.exported); if (!storage.valid) findings.push({ id: run.id, reason: storage.reason });
}
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const result = { syntheticOnly: true, resultFolder: folder, fixtures: runs.length, activeWorkChecked,
  storageExportsChecked: runs.length, findings, passed: !findings.length,
  sourceSha256: digest(fileURLToPath(import.meta.url)), fixtureSha256: digest(casesFile), inputSha256: digest(runsFile),
  scope: 'Read-only independent audit of actual query/reveal/change timestamps and recursive export schema. No rerun or real render/OS/IME check.' };
fs.writeFileSync(path.join(here, folder, 'audit.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2)); process.exitCode = result.passed ? 0 : 1;
