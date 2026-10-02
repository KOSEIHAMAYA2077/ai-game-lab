// Development-corpus checks only. Never reads the independent final test set.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const { widgetStudentScores, widgetStudentResolution } = await import(pathToFileURL(resolve(dir, '../../.local/widget-student-runtime/widget-student.mjs')));
const corpus = JSON.parse(await readFile(resolve(dir, 'artificial-corpus.json'), 'utf8'));
const model = JSON.parse(await readFile(resolve(dir, 'student-model.json'), 'utf8'));
const reports = {};
for (const head of ['primitive', 'relation']) {
  const predictions = corpus.filter(r => r.head === head && r.split === 'dev').map(row => {
    const [top, runner] = widgetStudentScores(row.text, head);
    const thresholds = model.thresholds;
    const held = top.label === (head === 'primitive' ? 'unknown' : 'none')
      || top.score < thresholds[head + 'Score'] || top.score-runner.score < thresholds[head + 'Margin']
      || (head === 'primitive' && top.coverage < thresholds.primitiveCoverage);
    const expectedHold = row.label === (head === 'primitive' ? 'unknown' : 'none');
    return { ...row, prediction: held ? 'hold' : top.label, score: top.score, margin: top.score-runner.score, correct: expectedHold ? held : !held && top.label === row.label, unsafeAccepted: !held && (expectedHold || top.label !== row.label) };
  });
  const accepted = predictions.filter(x => x.prediction !== 'hold');
  reports[head] = { count: predictions.length, accepted: accepted.length, acceptedCorrect: accepted.filter(x=>x.correct).length, held: predictions.length-accepted.length, correctIncludingExpectedHolds: predictions.filter(x=>x.correct).length, unsafeAccepted: predictions.filter(x=>x.unsafeAccepted).length, failures: predictions.filter(x=>!x.correct), note: 'Family-held-out development data; not an independent final test and not whole Program scoring' };
}
const fixtures = ['球体','立方体','棒','剣','輪っか','花瓶','白い細い棒の先に青い大きな球','a sphere above a box','箱を輪が貫く','a blade through a box','宇宙船','球を作らないで','球の上に箱と棒'];
reports.wholeProgramSmoke = fixtures.map(text => ({ text, ...widgetStudentResolution(text) }));
await writeFile(resolve(dir, 'development-report.json'), JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(['primitive','relation'].map(h=>[h,Object.fromEntries(Object.entries(reports[h]).filter(([k])=>k!=='failures'))])),null,2));
