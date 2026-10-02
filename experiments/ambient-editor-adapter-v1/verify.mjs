import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'MANIFEST-FINAL-R2.json')));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const errors = [];
for (const record of [...manifest.files, ...manifest.readOnlyDependencies]) {
  if (path.isAbsolute(record.path) || record.path.split('/').includes('..')) { errors.push(`unsafe manifest path: ${record.path}`); continue; }
  const buffer = fs.readFileSync(path.join(REPO, record.path));
  if (sha(buffer) !== record.sha256 || buffer.length !== record.bytes) errors.push(`changed: ${record.path}`);
}
console.log(JSON.stringify({ version: manifest.version, verifiedFiles: manifest.files.length,
  verifiedReadOnlyDependencies: manifest.readOnlyDependencies.length, errors, valid: !errors.length,
  scope: 'Byte/hash verification only; no runner, UI, OS, clipboard or network operation.' }, null, 2));
process.exitCode = errors.length ? 1 : 0;
