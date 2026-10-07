// One command that owns the whole local API test lifecycle:
// start Worker -> wait until ready -> run the integration/browser suites -> cleanup.
//
// Cleanup is guaranteed on success, failure, timeout, Ctrl+C, SIGINT and SIGTERM,
// and only ever targets the process tree this run started.

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withLocalWorker, allocateFreePort, resolveLocalWorkerPort } from './local-api-test-harness.mjs';
const cloudflareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(cloudflareRoot, '..');
const wranglerCli = path.join(cloudflareRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const API_SUITES = [
  'scripts/check-local-api-workflow.mjs',
  'tests/ejs-audit-approval-v2.mjs',
  'tests/ejs-content-service-v2.mjs',
  'tests/cover-approval-isolation.mjs',
  'tests/content-validation-approval.mjs',
];

const BROWSER_SPEC = 'tests/e2e/ejs-two-phase-upload.spec.mjs';

function runNode(script, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(cloudflareRoot, script)], {
      cwd: cloudflareRoot,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 0));
  });
}

function runPlaywright(spec, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        spec,
        '--config',
        path.join(repoRoot, 'playwright.config.mjs'),
        '--project',
        'desktop-chromium',
        '--retries=0',
        '--reporter=line',
      ],
      {
        cwd: repoRoot,
        env: { ...process.env, ...extraEnv },
        stdio: 'inherit',
        shell: false,
        windowsHide: true,
      },
    );
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 0));
  });
}

async function ensureWrangler() {
  try {
    await access(wranglerCli);
  } catch {
    throw new Error(
      'Wrangler is not installed in cloudflare/node_modules. Run `npm ci` in the cloudflare directory first.',
    );
  }
}

async function ensurePlaywright() {
  const spec = path.join(repoRoot, BROWSER_SPEC);
  try {
    await access(spec);
  } catch {
    throw new Error(`Browser spec is missing: ${spec}`);
  }
  try {
    await access(path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js'));
  } catch {
    throw new Error(
      'Playwright is not installed in the repository node_modules. Run `pnpm install` at the repository root first.',
    );
  }
}

const port = process.env.WORKSHOP_LOCAL_API_PORT
  ? resolveLocalWorkerPort()
  : await allocateFreePort();

await ensureWrangler();
await ensurePlaywright();
console.log(`[local-api] Local API test run will use port ${port}.`);

const env = { WORKSHOP_LOCAL_API_PORT: String(port), WORKSHOP_LOCAL_WORKER: `http://127.0.0.1:${port}` };

const failures = [];

await withLocalWorker(
  async () => {
    for (const suite of API_SUITES) {
      console.log(`\n[local-api] Running ${suite}...`);
      const code = await runNode(suite, env);
      if (code !== 0) failures.push(suite);
    }

    // The browser journey is part of this run's contract, so a missing spec or
    // missing Playwright install is reported as a failure rather than skipped.
    console.log(`\n[local-api] Running ${BROWSER_SPEC}...`);
    const code = await runPlaywright(BROWSER_SPEC, env);
    if (code !== 0) failures.push(BROWSER_SPEC);
  },
  { port },
);

if (failures.length > 0) {
  console.error(`[local-api] Failing suites: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\n[local-api] Local API integration suites passed.');
}
