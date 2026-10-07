// Fetches the served /assets/home.js from a managed local test Worker and parses
// it, so the check verifies the real served asset instead of a rebuilt copy.
//
// Uses the shared #24 lifecycle helper, so this run owns the Worker tree and
// always cleans it up. Set WORKSHOP_HOME_JS_PORT to reuse an already-running
// Worker instead of starting one.

import {
  canReach,
  isLocalWorkerReady,
  localWorkerOrigin,
  resolveLocalWorkerPort,
  withLocalWorker,
} from './local-api-test-harness.mjs';

const EXTERNAL_PORT = process.env.WORKSHOP_HOME_JS_PORT;
const url = `${EXTERNAL_PORT ? localWorkerOrigin(EXTERNAL_PORT) : localWorkerOrigin(resolveLocalWorkerPort())}/assets/home.js`;

async function checkHomeJs() {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch home.js: HTTP ${response.status}`);
  }

  const code = await response.text();
  new Function(code);
  console.log('home.js syntax OK');
}

if (EXTERNAL_PORT) {
  console.log(`[home-js] Using the already-running local Worker at ${localWorkerOrigin(EXTERNAL_PORT)}.`);
  if (!(await canReach(localWorkerOrigin(EXTERNAL_PORT)))) {
    throw new Error(`WORKSHOP_HOME_JS_PORT is set to ${EXTERNAL_PORT} but nothing is serving there.`);
  }
  await checkHomeJs();
} else {
  await withLocalWorker(async ({ origin }) => {
    if (!(await isLocalWorkerReady(origin))) throw new Error('local Worker never became ready');
    await checkHomeJs();
  });
}
