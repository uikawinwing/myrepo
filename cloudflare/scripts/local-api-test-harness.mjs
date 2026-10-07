// Shared lifecycle helpers for the local API (wrangler/workerd) test worker.
//
// The local test worker is started and owned by exactly one Node parent process.
// Every helper here is written so that a run only ever stops the process tree it
// created itself, and so that concurrent worktrees never share one hard-coded port.

import { spawn, spawnSync } from 'node:child_process';
import { access, mkdir, readdir, rm, stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cloudflareRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const starterScript = path.join(cloudflareRoot, 'scripts', 'start-local-api-test.mjs');
const wranglerCli = path.join(cloudflareRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const persistRoot = path.join(cloudflareRoot, '.wrangler', 'local-api-test-runs');

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

  // The port closing does not prove wrangler exited: it can still be holding
  // its local state directory for a moment afterwards. Wait for the child
  // itself, so callers can safely delete the run state directory.
  if (child.exitCode === null && child.signalCode === null) {
    stopProcessTree(child, label);

    const exitDeadline = Date.now() + 15_000;
    while (Date.now() < exitDeadline) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  if (await isLocalWorkerGone(origin)) return true;

  // Escalate once: a workerd that ignored the group signal still has to go.
  if (child.exitCode === null && child.signalCode === null) {
    stopProcessTree(child, `${label} (escalated)`);
    const escalateDeadline = Date.now() + 15_000;
    while (Date.now() < escalateDeadline) {
      if (child.exitCode !== null || child.signalCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  try {
    await waitUntil(() => isLocalWorkerGone(origin), `${origin} shutdown`, 10_000);
  } catch {
    return false;
  }
  return true;
}

export async function startLocalWorker({ port, stdio = 'inherit', persistTo } = {}) {
  const resolvedPort = port ?? resolveLocalWorkerPort();
  const origin = localWorkerOrigin(resolvedPort);

  if (await canReach(origin)) {
    throw new Error(
      `Port ${resolvedPort} is already serving at ${origin}. `
        + 'Stop that process, or start this run with a different WORKSHOP_LOCAL_API_PORT. '
        + 'This runner never kills a process it did not start.',
    );
  }

  const persistDir = persistTo || (await prepareRunState(resolvedPort));
  console.log(`[local-api] Starting the test Worker on ${origin}...`);

  const child = spawn(process.execPath, [starterScript], {
    cwd: cloudflareRoot,
    env: {
      ...process.env,
      WORKSHOP_LOCAL_API_PORT: String(resolvedPort),
      WORKSHOP_LOCAL_API_PERSIST_TO: persistDir,
    },
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
    await removeRunState(persistDir);
    throw error;
  }

  return { child, origin, port: resolvedPort, persistDir };
}

/**
 * Give this run its own local wrangler state and apply the local test schema.
 *
 * Concurrent runs otherwise share one local SQLite file and one of them dies
 * with SQLITE_BUSY before it ever binds its port.
 */
async function prepareRunState(port) {
  try {
    await access(wranglerCli);
  } catch {
    throw new Error(
      'Wrangler is not installed in cloudflare/node_modules. Run `npm ci` in the cloudflare directory first.',
    );
  }

  await mkdir(persistRoot, { recursive: true });
  const persistDir = path.join(persistRoot, `port-${port}-${process.pid}-${Date.now()}`);

  const result = spawnSync(
    process.execPath,
    [
      wranglerCli,
      'd1',
      'execute',
      'creative_workshop_local_test',
      '--local',
      '--config',
      'wrangler.local-test.jsonc',
      '--persist-to',
      persistDir,
      '--file=schema.sql',
    ],
    { cwd: cloudflareRoot, stdio: 'ignore', shell: false, windowsHide: true },
  );

  if (result.status !== 0) {
    throw new Error(
      `Could not prepare the local test database for port ${port} (wrangler d1 execute exited with ${result.status ?? 'unknown'}).`,
    );
  }

  return persistDir;
}

/** Remove this run's throwaway wrangler state directory. */
export async function removeRunState(persistDir) {
  if (!persistDir || !persistDir.startsWith(persistRoot)) return;
  await rm(persistDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(
    error => console.warn(`[local-api] Could not remove the run state ${persistDir}: ${error.message}`),
  );
}

/**
 * Delete run state left behind by a killed process, so a crashed or SIGKILLed
 * run does not permanently fill the disk.
 */
export async function sweepStaleRunState(maxAgeMs = 24 * 60 * 60 * 1000) {
  let entries = [];
  try {
    entries = await readdir(persistRoot, { withFileTypes: true });
  } catch {
    return 0;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(persistRoot, entry.name);
    try {
      const stats = await stat(dir);
      if (Date.now() - stats.mtimeMs > maxAgeMs) {
        await rm(dir, { recursive: true, force: true });
        removed += 1;
      }
    } catch {}
  }
  return removed;
}

/**
 * Run a child command to completion while guaranteeing the Worker tree is taken
 * down afterwards, including on SIGINT, SIGTERM, failure and timeout.
 */
export async function withLocalWorker(run, { port, timeoutMs } = {}) {
  await sweepStaleRunState();
  const started = await startLocalWorker({ port });
  const { child, origin } = started;
  const workers = new Set();
  let finished = false;
  let timedOut = false;

  const cleanup = async () => {
    const stopped = await stopLocalWorker(child, origin);
    await removeRunState(started.persistDir);
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
