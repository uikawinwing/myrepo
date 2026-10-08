import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({
  entryPoints: ['src/appstore-preview.ts'], bundle: true, write: false,
  format: 'esm', platform: 'browser', target: 'es2022',
  loader: { '.txt': 'text', '.json': 'json' },
});
const worker = (await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))).default;
const calls = [];
const env = {
  STAGING_WORKER: {
    fetch: async request => {
      calls.push(request);
      return new Response(JSON.stringify({ success: true, projects: [] }), { headers: { 'Content-Type': 'application/json' } });
    },
  },
};
const request = (path, method = 'GET') => new Request('https://preview.example' + path, { method });
const home = await worker.fetch(request('/'), env);
assert.equal(home.status, 200);
assert.match(await home.text(), /独立设计预览/);
const js = await worker.fetch(request('/assets/home.js'), env);
assert.equal(js.status, 200);
assert.match(await js.text(), /renderDiscoverHome/);
for (const method of ['POST', 'PUT', 'DELETE']) {
  assert.equal((await worker.fetch(request('/api/projects', method), env)).status, 405);
}
for (const path of ['/api/admin/pending', '/api/projects/x/install-info', '/api/auth/me']) {
  assert.equal((await worker.fetch(request(path), env)).status, 404);
}
assert.equal(calls.length, 0, 'blocked requests may not reach real staging');
const catalog = await worker.fetch(request('/api/projects?page=0&pageSize=10&sort=discover'), env);
assert.equal(catalog.status, 200);
assert.equal(calls.length, 1);
assert.equal(new URL(calls[0].url).hostname, 'workshop-test.uika.cc.cd');
assert.equal(calls[0].method, 'GET');
assert.equal(calls[0].headers.has('Authorization'), false);
assert.equal(calls[0].headers.has('Cookie'), false);
assert.equal((await worker.fetch(request('/api/projects?page=1000&pageSize=500'), env)).status, 400);
assert.equal(calls.length, 1, 'out-of-range queries may not reach staging');
console.log('appstore preview read-only smoke: ok');
