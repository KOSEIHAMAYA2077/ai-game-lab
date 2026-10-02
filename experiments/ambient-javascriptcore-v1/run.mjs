import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
const sha = data => createHash('sha256').update(data).digest('hex');
const bundle = await readFile(resolve(here, '.runtime/bundle-r1/receiver.iife.js'), 'utf8');
const bundleRecord = JSON.parse(await readFile(resolve(here, 'BUNDLE-R1.json'), 'utf8'));
if (sha(bundle) !== bundleRecord.sha256) throw new Error('shared bundle drift');
const input = await readFile(resolve(here, 'CASES-R3.json'), 'utf8');
if (sha(input) !== 'c7ffe342746c2c83d76d2721ae39a5440af3502db9d0cdf29082daaa826be208') throw new Error('fixture drift');
const capabilitiesScript = await readFile(resolve(here, 'capabilities.js'), 'utf8');
const out = resolve(here, 'results-r1');
try { await access(out); throw new Error('preserve earlier raw result'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(out);
const context = createContext({}, { codeGeneration: { strings: false, wasm: false } });
const capabilities = JSON.parse(runInContext(capabilitiesScript, context));
let node;
try {
  runInContext(bundle, context, { timeout: 10000 });
  // A data string is the only test host object passed to the realm; no host callbacks.
  context.syntheticInputJSON = input;
  const result = JSON.parse(runInContext('AmbientJSC.evaluateJSON(syntheticInputJSON)', context, { timeout: 10000 }));
  delete context.syntheticInputJSON;
  node = { engine: 'Node-vm', status: 'completed', capabilities, result };
} catch (e) { node = { engine: 'Node-vm', status: 'execution-error', capabilities, message: e.message }; }
await writeFile(resolve(out, 'node.json'), JSON.stringify(node, null, 2) + '\n');
const native = spawnSync(resolve(here, '.runtime/native-r1'), [resolve(here, '.runtime/bundle-r1/receiver.iife.js'), resolve(here, 'capabilities.js')], { input, encoding: 'utf8', timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
await writeFile(resolve(out, 'native-stdout.json'), native.stdout || '{}\n');
await writeFile(resolve(out, 'native-stderr.txt'), native.stderr || '');
let jsc; try { jsc = JSON.parse(native.stdout); } catch { jsc = { status: 'host-error', message: native.error?.message ?? 'native output not JSON' }; }
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const nodeDone = node.status === 'completed', nativeDone = jsc.status === 'completed';
const comparisons = Array.from({ length: 20 }, (_, i) => { const id = `C${String(i + 1).padStart(2, '0')}`, n = node.result?.runs.find(r => r.id === id), j = jsc.result?.runs.find(r => r.id === id); return { id, nodeManualExpectedPass: n?.passed ?? false, nativeManualExpectedPass: j?.passed ?? false, semanticOutputExact: Boolean(n && j && equal(n, j)) }; });
const summary = { version: 'javascriptcore-engine-comparison-r1', bundleSha256: sha(bundle), inputSha256: sha(input), sameHostSelectedBundle: true,
  nodeStatus: node.status, nativeStatus: jsc.status, nativeExit: native.status, nativeSignal: native.signal, nodeVersion: process.version,
  nodeManualExpected: node.result?.passed ?? 0, nativeManualExpected: jsc.result?.passed ?? 0, exactCases: comparisons.filter(r => r.semanticOutputExact).length,
  completeOutputExact: nodeDone && nativeDone && equal(node.result, jsc.result),
  expectedReceive120: nodeDone && nativeDone && node.result.receiveCalls === 120 && jsc.result.receiveCalls === 120,
  expectedLexicalQueries18: nodeDone && nativeDone && node.result.actualLexicalQueryCalls === 18 && jsc.result.actualLexicalQueryCalls === 18,
  nodeAssertions: node.result?.assertions ?? 0, nativeAssertions: jsc.result?.assertions ?? 0,
  comparisons, scope: 'CPU synthetic fixture transport only. No WebView/GPU/DOM/OS/IME/nativeinput/model/storage/network callbacks or resource measurement. Reused20 regression, not independent human/holdout proof.' };
await writeFile(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ nodeManualExpected: summary.nodeManualExpected, nativeManualExpected: summary.nativeManualExpected, exactCases: summary.exactCases, completeOutputExact: summary.completeOutputExact, nativeStatus: summary.nativeStatus, nativeExit: summary.nativeExit }));
if (!summary.completeOutputExact || summary.nodeManualExpected !== 20 || summary.nativeManualExpected !== 20 || !summary.expectedReceive120 || !summary.expectedLexicalQueries18) process.exitCode = 1;
