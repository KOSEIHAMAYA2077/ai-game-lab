import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const dir = dirname(fileURLToPath(import.meta.url));
const runtimePath = resolve(dir, '../../.local/widget-student-runtime/widget-student.mjs');
if (global.gc) global.gc();
const before = process.memoryUsage();
const importedAt = performance.now();
const { widgetStudentResolution, inspectWidgetStudent } = await import(pathToFileURL(runtimePath));
const importMs = performance.now() - importedAt;
const started = performance.now();
const first = widgetStudentResolution('細い棒の先に球');
const coldMs = performance.now() - started;
const fixtures = ['表面 球体', '白い細い棒の先に大きな球', 'a sphere above a box', '箱を輪が貫く', 'a blade through a box', 'do not attach a sphere to a tube', 'unknown nebula concept', '花瓶', 'ねじれた長い管', 'こんにちは'.repeat(400)];
const values = [];
const cpuBefore = process.cpuUsage();
for (let i = 0; i < 2000; i++) {
  const t = performance.now(); widgetStudentResolution(fixtures[i % fixtures.length]); values.push(performance.now() - t);
}
const cpu = process.cpuUsage(cpuBefore), peak = process.memoryUsage();
if (global.gc) global.gc();
const after = process.memoryUsage();
values.sort((a,b) => a-b);
const report = {
  environment: { platform: process.platform, arch: process.arch, node: process.version, thread: 'single JS thread', browserNativeMeasured: false },
  fixtures: fixtures.map(x => ({ codeUnits: x.length })), count: values.length,
  importMs, coldMs, firstAccepted: first.program !== null,
  warm: { medianMs: values[Math.floor(values.length*.5)], p95Ms: values[Math.floor(values.length*.95)], maxMs: values.at(-1) },
  cpu: { userMs: cpu.user/1000, systemMs: cpu.system/1000, totalMs: (cpu.user+cpu.system)/1000 },
  memory: { before, peak, afterGC: after, heapDeltaAfterGCBytes: after.heapUsed-before.heapUsed, rssDeltaAfterGCBytes: after.rss-before.rss, note: 'Node harness runtime delta, not the whole Mac widget footprint; RSS not a heap size guarantee' },
  model: inspectWidgetStudent(),
};
await writeFile(resolve(dir, 'benchmark-report.json'), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report, null, 2));
