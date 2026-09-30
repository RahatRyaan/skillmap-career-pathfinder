#!/usr/bin/env node
/**
 * Cheap pre-flight check so we fail fast on a broken environment.
 * No dependencies on the app itself.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const results = [];

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}

check('.env exists', () => {
  if (!existsSync(join(root, '.env'))) throw new Error('missing .env — copy from .env.example');
  return 'found';
});

check('.env has JWT secrets', () => {
  const env = readFileSync(join(root, '.env'), 'utf8');
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const match = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!match || match[1].includes('replace_me')) throw new Error(`${key} not configured`);
  }
  return 'secrets set';
});

check('no secrets committed', () => {
  if (!existsSync(join(root, '.gitignore'))) throw new Error('missing .gitignore');
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8');
  if (!/^\.env$/m.test(ignore)) throw new Error('.env is not gitignored');
  return '.env ignored';
});

check('node version', () => {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) throw new Error(`need node >= 20, got ${process.versions.node}`);
  return process.versions.node;
});

let failed = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
process.exit(failed === 0 ? 0 : 1);
