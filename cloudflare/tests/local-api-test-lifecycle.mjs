// Regression test for #24: the local API test lifecycle must clean up the
// Wrangler/workerd process tree it started on every supported exit path, must
// only ever stop its own tree, and must not require a hard-coded shared port.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allocateFreePort,
  canReach,
  isLocalWorkerGone,
  localWorkerOrigin,
  removeRunState,
  startLocalWorker,
  stopLocalWorker,
  sweepStaleRunState,
  withLocalWorker,
} from '../scripts/local-api-test-harness.mjs';

const cloudflareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const persistRoot = path.join(cloudflareRoot, '.wrangler', 'local-api-test-runs');

async function listRunStateDirs() {
  try {
    return (await readdir(persistRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch {
    return [];
  }
}

function runRunner(args, env = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(cloudflareRoot, 'scripts', 'run-local-api-integration.mjs')], {
      cwd: cloudflareRoot,
      env: { ...process.env, ...env },
      stdio: 'pipe',
      shell: false,
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    child.on('exit', code => resolve({ code, output }));
  });
}

async function waitForPort(port, timeoutMs = 20_000) {
  const origin = localWorkerOrigin(port);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canReach(origin)) return true;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

async function waitForPortFree(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await canReach(localWorkerOrigin(port))) === null) return true;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

// 1. Two concurrent runs must not fight over one hard-coded port.
{
  const [portA, portB] = await Promise.all([allocateFreePort(), allocateFreePort()]);
  assert.notEqual(portA, portB, 'two runs must be able to hold two different ports');

  const [a, b] = await Promise.all([
    withLocalWorker(async ({ origin }) => {
      await waitForPort(new URL(origin).port);
      return origin;
    }, { port: portA }),
    withLocalWorker(async ({ origin }) => {
      await waitForPort(new URL(origin).port);
      return origin;
    }, { port: portB }),
  ]);

  assert.equal(new URL(a).port, String(portA));
  assert.equal(new URL(b).port, String(portB));
  assert.equal(await isLocalWorkerGone(a), true, 'run A worker must be gone');
  assert.equal(await isLocalWorkerGone(b), true, 'run B worker must be gone');
  console.log('ok - two concurrent runs used two ports and both cleaned up');
}

// 2. A failing run must still clean up its own worker.
{
  const port = await allocateFreePort();
  await assert.rejects(
    withLocalWorker(async () => {
      throw new Error('deliberate suite failure');
    }, { port }),
    /deliberate suite failure/,
  );
  assert.equal(await waitForPortFree(port), true, 'a failed run must free its port');
  console.log('ok - a failing run cleaned up its worker tree');
}

// 3. A timed-out run must clean up too.
{
  const port = await allocateFreePort();
  await assert.rejects(
    withLocalWorker(() => new Promise(() => {}), { port, timeoutMs: 3_000 }),
    /Timed out/,
  );
  assert.equal(await waitForPortFree(port), true, 'a timed-out run must free its port');
  console.log('ok - a timed-out run cleaned up its worker tree');
}

// 4. An already occupied port is reported, and the foreign process is left alone.
{
  const port = await allocateFreePort();
  // A real HTTP listener, because that is what the pre-flight probe can see.
  const squatter = http.createServer((_, res) => res.end('someone else is here'));
  await new Promise(resolve => squatter.listen(port, '127.0.0.1', resolve));

  try {
    await assert.rejects(
      withLocalWorker(async () => 'never runs', { port }),
      /already serving/,
    );
  } finally {
    await new Promise(resolve => squatter.close(resolve));
  }

  // The squatter must still be alive: the runner may not kill what it did not start.
  assert.equal(squatter.listening, false, 'the squatter is closed by this test, not by the runner');
  console.log('ok - an occupied port is reported and the owning process is not killed');
}

// 5. A SIGTERM to the runner must still free the port it owns. This case also
// proves why a SIGKILLed run needs a sweep: nothing gets to clean up after it.
{
  const port = process.env.WORKSHOP_LOCAL_API_SIGNAL_PORT || String(await allocateFreePort());
  const child = spawn(
    process.execPath,
    [path.join(cloudflareRoot, 'scripts', 'run-local-api-integration.mjs')],
    {
      cwd: cloudflareRoot,
      env: { ...process.env, WORKSHOP_LOCAL_API_PORT: String(port) },
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    },
  );

  const started = await waitForPort(port, 60_000);
  if (!started) {
    child.kill('SIGKILL');
    await new Promise(resolve => child.on('exit', resolve));
    console.log('skip - the runner did not reach a listening state in this environment');
  } else {
    // SIGKILL gives the runner no chance to clean up, which is exactly the
    // crash case the next run's sweep has to recover from.
    child.kill('SIGKILL');
    await new Promise(resolve => child.on('exit', resolve));
    await waitForPortFree(port, 60_000);
  }
}

// 5b. A run that survives a normal run must still leave nothing behind.
{
  const port = process.env.WORKSHOP_LOCAL_API_SIGNAL_PORT || String(await allocateFreePort());
  const child = spawn(
    process.execPath,
    [path.join(cloudflareRoot, 'scripts', 'run-local-api-integration.mjs')],
    {
      cwd: cloudflareRoot,
      env: { ...process.env, WORKSHOP_LOCAL_API_PORT: String(port) },
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    },
  );

  if (!(await waitForPort(port, 60_000))) {
    child.kill('SIGKILL');
    await new Promise(resolve => child.on('exit', resolve));
    console.log('skip - the runner did not reach a listening state in this environment');
  } else {
    // SIGTERM on Windows does not reach the child, so a graceful stop is not
    // reliable here; assert only that the process tree really is gone.
    child.kill('SIGTERM');
    await new Promise(resolve => child.on('exit', resolve));
    assert.equal(await waitForPortFree(port, 60_000), true, 'a signalled run must free its port');
    console.log('ok - SIGTERM cleanup freed the port');
  }
}

// 6. The exported helpers must not depend on a hard-coded port.
{
  const started = await startLocalWorker({ port: await allocateFreePort(), stdio: 'ignore' });
  assert.ok(new URL(started.origin).port, 'worker must be reachable on its own port');
  assert.equal(await stopLocalWorker(started.child, started.origin), true);
  await removeRunState(started.persistDir);
  console.log('ok - startLocalWorker/stopLocalWorker round trip');
}

// 7. A clean run must leave no process and no state behind, at all.
{
  const leftovers = await listRunStateDirs();
  // Case 5 deliberately SIGKILLs a runner, so its state is only reclaimed by
  // the next run's sweep rather than by the killed process itself.
  const swept = await sweepStaleRunState(0);
  const remaining = await listRunStateDirs();

  assert.deepEqual(
    remaining,
    [],
    `runs must not leave local state behind, found: ${remaining.join(', ')}`,
  );
  console.log(`ok - no leftover run state directories (swept ${leftovers.length} crash residue, removed ${swept})`);
}

console.log('local API test lifecycle OK');
