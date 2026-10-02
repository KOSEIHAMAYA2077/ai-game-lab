import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const read = async name => JSON.parse(await readFile(resolve(here, name), 'utf8'));
const [nodeManual, nativeManual, nodeOld, nativeOld, nativeSummary] = await Promise.all(['results-node-r1/manual12.json','results-native-r1/manual12.json','results-node-r1/original20.json','results-native-r1/original20.json','results-native-r1/summary.json'].map(read));
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const value = { version: 'ambient-native-cpu-r1', manualNodePassed: nodeManual.passed, manualNativePassed: nativeManual.passed, manual12Exact: same(nodeManual, nativeManual), oldNodePassed: nodeOld.passed, oldNativePassed: nativeOld.passed, original20Exact: same(nodeOld, nativeOld), projectionCPU: nativeSummary.projectionCPU, instanceChecks: nativeSummary.instanceChecks, geometryFrameChecks: nativeSummary.geometryFrameChecks, actualNativeUI: false, actualNativeIME: false, resourceMeasured: false };
try { await access(resolve(here, 'CPU-RESULTS-R1.json')); throw new Error('preserve prior comparison'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await writeFile(resolve(here, 'CPU-RESULTS-R1.json'), JSON.stringify(value, null, 2)+'\n'); console.log(JSON.stringify(value));
if (!value.manual12Exact || !value.original20Exact || !value.projectionCPU || value.manualNativePassed !== 12 || value.oldNativePassed !== 20) process.exitCode = 1;
