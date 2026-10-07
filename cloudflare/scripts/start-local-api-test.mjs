// Thin wrangler launcher for the local API test Worker.
//
// This script only starts wrangler and mirrors its exit code. Process-tree
// ownership and cleanup belong to the caller (see local-api-test-harness.mjs),
// so that a test run can never leave a workerd process behind.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudflareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wranglerCli = path.join(cloudflareRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const variableName = ['JWT', 'SECRET'].join('_');

const port = process.env.WORKSHOP_LOCAL_API_PORT || '8791';
if (!/^\d+$/.test(String(port))) {
  throw new Error(`WORKSHOP_LOCAL_API_PORT must be a TCP port number, received: ${port}`);
}

const args = [
  wranglerCli,
  'dev',
  '--config',
  'wrangler.local-test.jsonc',
  '--local',
  '--ip',
  '127.0.0.1',
  '--port',
  String(port),
  '--var',
  `${variableName}:cw-local-api-test`,
];

// A dynamic port alone is not enough for concurrency: wrangler's default local
// persistence directory is shared, so two runs would fight over the same local
// SQLite file and one would die with SQLITE_BUSY. Each run therefore gets its
// own throwaway persist directory, seeded with the local test schema.
const persistTo = process.env.WORKSHOP_LOCAL_API_PERSIST_TO;
if (persistTo) {
  args.push('--persist-to', persistTo);
}

const child = spawn(process.execPath, args, {
  cwd: cloudflareRoot,
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', error => {
  console.error(`[local-api] Failed to start wrangler: ${error.message}`);
  process.exit(1);
});

child.on('exit', code => process.exit(code ?? 0));
