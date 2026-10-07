// Shared lifecycle helpers for the local API (wrangler/workerd) test worker.
//
// The local test worker is started and owned by exactly one Node parent process.
// Every helper here is written so that a run only ever stops the process tree it
// created itself, and so that concurrent worktrees never share one hard-coded port.

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudflareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const starterScript = path.join(cloudflareRoot, 'scripts', 'start-local-api-test.mjs');

export const DEFAULT_LOCAL_WORKER_PORT = 8791;

export function localWorkerOrigin(port) {
  return `http://127.0.0.1:${port}`;
}

/**
 * Ask the OS for a currently free TCP port and release it again.
 *
 * There is an unavoidable race between closing the probe socket and wrangler
 * binding it, which is why every run also reports the port it actually got and
 * fails loudly if the port turns out to be taken.
 */
export function allocateFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(error => (error ? reject(error) : resolve(port)));
    });
  });
}

export function resolveLocalWorkerPort() {
  const raw = process.env.WORKSHOP_LOCAL_API_PORT;
  if (!raw) return DEFAULT_LOCAL_WORKER_PORT;
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`WORKSHOP_LOCAL_API_PORT must be a valid TCP port, received: ${raw}`);
  }
  return port;
}

export function resolveLocalWorkerUrl() {
  return process.env.WORKSHOP_LOCAL_WORKER || localWorkerOrigin(resolveLocalWorkerPort());
}

export async function canReach(url, init = {}) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(1_500) });
  } catch {
    return null;
  }
}

export async function waitUntil(check, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError.message || lastError}` : ''}`,
  );
}

export async function isLocalWorkerReady(origin) {
  const response = await canReach(new URL('/api/auth/local-preview', origin), { method: 'POST' });
  return response?.ok === true;
}

export async function isLocalWorkerGone(origin) {
  return (await canReach(origin)) === null;
}

/**
 * Stop only the process tree this run spawned.
 *
 * On Windows `child.kill()` only reaches the direct child and leaves the
 * workerd grandchild alive holding the port, so the whole tree is taken down
 * with taskkill. On POSIX the child is spawned detached, so the negated pid
 * addresses its whole process group.
 */
export function stopProcessTree(child, label) {
  if (!child?.pid) return;

  if (child.exitCode === null && child.signalCode === null) {
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      if (result.status !== 0 && result.error) {
        console.warn(`[local-api] Could not stop the ${label} tree (pid ${child.pid}): ${result.error.message}`);
      }
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        try {
          child.kill('SIGTERM');
        } catch {}
      }
    }
  }
}

export async function stopLocalWorker(child, origin, label = 'local Worker') {
  if (!child?.pid) return true;

  stopProcessTree(child, label);

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (await isLocalWorkerGone(origin)) return true;

  // Escalate once: a workerd that ignored the group signal still has to go.
  stopProcessTree(child, `${label} (escalated)`);
  try {
    await waitUntil(() => isLocalWorkerGone(origin), `${origin} shutdown`, 10_000);
  } catch {
    return false;
  }
  return true;
}

export async function startLocalWorker({ port, stdio = 'inherit' } = {}) {
  const resolvedPort = port ?? resolveLocalWorkerPort();
  const origin = localWorkerOrigin(resolvedPort);

  if (await canReach(origin)) {
    throw new Error(
      `Port ${resolvedPort} is already serving at ${origin}. `
        + 'Stop that process, or start this run with a different WORKSHOP_LOCAL_API_PORT. '
        + 'This runner never kills a process it did not start.',
    );
  }

  console.log(`[local-api] Starting the test Worker on ${origin}...`);

  const child = spawn(process.execPath, [starterScript], {
    cwd: cloudflareRoot,
    env: { ...process.env, WORKSHOP_LOCAL_API_PORT: String(resolvedPort) },
    stdio,
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });

  let spawnFailure = null;
  child.on('error', error => {
    spawnFailure = error;
  });

  try {
    await waitUntil(
      async () => {
        if (spawnFailure) throw spawnFailure;
        if (child.exitCode !== null) {
          throw new Error(`The test Worker exited early with code ${child.exitCode}`);
        }
        return isLocalWorkerReady(origin);
      },
      `the local Worker on ${origin}`,
    );
  } catch (error) {
    await stopLocalWorker(child, origin);
    throw error;
  }

  return { child, origin, port: resolvedPort };
}

/**
 * Run a child command to completion while guaranteeing the Worker tree is taken
 * down afterwards, including on SIGINT, SIGTERM, failure and timeout.
 */
export async function withLocalWorker(run, { port, timeoutMs } = {}) {
  const started = await startLocalWorker({ port });
  const { child, origin } = started;
  const workers = new Set();
  let finished = false;
  let timedOut = false;

  const cleanup = async () => {
    const stopped = await stopLocalWorker(child, origin);
    if (!stopped) {
      console.error(
        `[local-api] The Worker process tree started by this run is still alive on ${origin}. `
          + 'Stop it manually before starting another local API run.',
      );
    }
    return stopped;
  };

  const onSignal = signal => {
    if (finished) return;
    finished = true;
    console.warn(`[local-api] Received ${signal}; stopping this run's Worker tree...`);
    cleanup()
      .catch(error => console.error(`[local-api] Cleanup failed: ${error.message}`))
      .finally(() => process.exit(130));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  let timer = null;
  let runPromise = Promise.resolve();
  try {
    runPromise = Promise.resolve().then(() => run({ ...started, origin, child }));
    if (timeoutMs && Number.isFinite(timeoutMs)) {
      runPromise = Promise.race([
        runPromise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => {
              timedOut = true;
              reject(new Error(`Timed out after ${timeoutMs}ms; stopping this run's Worker tree.`));
            },
            timeoutMs,
          );
        }),
      ]);
    }
    return await runPromise;
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    if (timedOut) {
      console.warn(`[local-api] ${timedOut ? 'Run timed out' : 'Run ended'}; stopping this run's Worker tree...`);
    }
    const stopped = await cleanup();
    for (const pending of workers) stopProcessTree(pending, 'test command');
    if (!stopped) process.exitCode = 1;
  }
}
