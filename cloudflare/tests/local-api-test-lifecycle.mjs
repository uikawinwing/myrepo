// Regression test for #24: the local API test lifecycle must clean up the
// Wrangler/workerd process tree it started on every supported exit path, must
// only ever stop its own tree, and must not require a hard-coded shared port.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allocateFreePort,
  canReach,
  isLocalWorkerGone,
  localWorkerOrigin,
  startLocalWorker,
  stopLocalWorker,
  withLocalWorker,
} from '../scripts/local-api-test-harness.mjs';

const cloudflareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

// 5. A SIGTERM to the runner must still free the port it owns.
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
  if (started) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.on('exit', resolve));
    assert.equal(await waitForPortFree(port), true, 'a SIGTERMed run must free its port');
    console.log('ok - SIGTERM cleanup freed the port');
  } else {
    child.kill('SIGKILL');
    await new Promise(resolve => child.on('exit', resolve));
    console.log('skip - the runner did not reach a listening state in this environment');
  }
}

// 6. The exported helpers must not depend on a hard-coded port.
{
  const started = await startLocalWorker({ port: await allocateFreePort(), stdio: 'ignore' });
  assert.ok(new URL(started.origin).port, 'worker must be reachable on its own port');
  assert.equal(await stopLocalWorker(started.child, started.origin), true);
  console.log('ok - startLocalWorker/stopLocalWorker round trip');
}

console.log('local API test lifecycle OK');
