import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const basename = process.argv[2];
if (!/^[A-Za-z0-9_-]+$/.test(basename ?? '')) throw new Error('existing output folder basename required');
const sourceFile = path.join(here, basename, 'probes.json');
const bytes = fs.readFileSync(sourceFile), rows = JSON.parse(bytes);
for (const row of rows) if (row.details?.mutatedSource) {
  delete row.details.mutatedSource;
  row.details.recipe = 'Reconstruct executed alternate code from run-probes.mjs mutation anchors, effective receiver source and fixed scheduler constants. The source SHA identifies the executed in-memory module; raw runtime file URLs remain local.';
}
const result = { publicationTransform: 'Only runtime-mutant source strings removed; assertions, decisions, expected/actual and failures retained.',
  rawLocalSha256: crypto.createHash('sha256').update(bytes).digest('hex'), observations: rows };
const output = path.join(here, basename, 'observations-public.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(`${basename}/observations-public.json`);
