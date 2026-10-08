import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Completely headless. Only a synthetic preview.test origin, no browser window,
// local listener or control of another device's Chrome.
const bundle = await build({
  entryPoints: ['src/pages/home.ts'], bundle: true, write: false,
  format: 'esm', platform: 'browser', target: 'es2022',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const checker = Buffer.from((await readFile(new URL('../src/generated/upload-checker.txt', import.meta.url), 'utf8')).trim(), 'base64').toString('utf8');
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const projectListSorts = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/api/projects') projectListSorts.push(url.searchParams.get('sort')); });
    const snapshots = new Map();
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.hostname !== 'preview.test') return route.fulfill({status: 204, body: ''});
      if (url.pathname === '/') return route.fulfill({ status: 200, contentType:'text/html', body: mod.homePage() });
      if (url.pathname === '/assets/home.js') return route.fulfill({ status: 200, contentType:'application/javascript', body: mod.homeScriptPage() });
      if (url.pathname === '/assets/upload-checker.js') return route.fulfill({status:200,contentType:'application/javascript',body:checker});
      if (!url.pathname.startsWith('/api/')) return route.fulfill({ status:404, body:'' });
      if (!['/api/projects', '/api/devteam-recommendations','/api/site/discover-banner'].includes(url.pathname) && !/^\/api\/projects\/[0-9a-f-]{36}$/.test(url.pathname)) {
        return route.fulfill({ status: 404, contentType:'application/json', body:'{}' });
      }
      const key = url.pathname + url.search;
      if (!snapshots.has(key)) {
        const upstream = await fetch('https://workshop-test.uika.cc.cd' + key, { headers: { Accept: 'application/json' } });
        snapshots.set(key, { status: upstream.status, body: await upstream.text() });
      }
      const response = snapshots.get(key);
      return route.fulfill({ status: response.status, contentType:'application/json', body: response.body });
    });
    await page.goto('https://preview.test/', { waitUntil: 'domcontentloaded' });
    await page.locator('.store-home .discover-shelf .store-row').first().waitFor({timeout:30000});
    await page.locator('.store-home .devteam-recommend-item .store-row').first().waitFor({timeout:30000});
    const metrics = await page.evaluate(() => {
      const section = [...document.querySelectorAll('.discover-shelf')].find(e => e.textContent.includes('下载排行榜'));
      const firstRank = section?.querySelector('.store-row-rank');
      const row = section?.querySelector('.store-row');
      const icon = row?.querySelector('.discover-card-cover-shell');
      const lastRow = document.querySelector('.store-home .store-row:last-child');
      const box = e => e?.getBoundingClientRect();
      return {
        rank: firstRank?.textContent?.trim(), iconWidth: box(icon)?.width, rowHeight: box(row)?.height,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        rankings: section?.querySelectorAll('.store-row').length,
        editor: document.querySelector('.devteam-recommendations-title')?.textContent,
        firstItem: row?.getAttribute('data-id'), bottomVisible: Boolean(lastRow),
      };
    });
    assert.equal(metrics.rank, '1', 'rank list must be numbered');
    assert.deepEqual([...new Set(projectListSorts)].sort(), ['discover','downloads','published'], 'home should not add a fourth D1 list request for updated projects');
    assert.ok(metrics.rankings >= 3, 'ranking must use real content');
    assert.ok(metrics.iconWidth >= 48 && metrics.iconWidth <= 64, JSON.stringify(metrics));
    assert.ok(metrics.rowHeight < 110, JSON.stringify(metrics));
    assert.ok(metrics.pageOverflow <= 1, JSON.stringify(metrics));
    assert.match(metrics.editor, /编辑精选/);
    assert.equal(await page.locator('.store-home .devteam-curator-head, .store-home .devteam-recommend-comment, .store-home .dlc-kitchen-reaction').count(), 0, 'homepage must not reveal curator identities or comments');
    assert.equal(await page.getByText('最低门槛', { exact: true }).count(), 0);
    assert.equal(await page.getByText('玩家好评（暂未开放）', { exact: true }).count(), 0);
    assert.ok(metrics.firstItem);
    await page.locator('.store-home .discover-shelf .store-row').first().click();
    await page.locator('.modal-overlay').first().waitFor({timeout:20000});
    await page.locator('.modal-overlay.project-detail-modal .detail-panel').first().waitFor({timeout:30000});
    const tabs = width <= 640 ? '.mobile-detail-tabs' : '.detail-page-tabs';
    const panels = width <= 640 ? '.mobile-detail-tab-panel' : '.detail-tab-panel';
    assert.equal(await page.locator('.project-detail-modal ' + panels + '[data-detail-tab-panel="overview"]:not([hidden])').count(), 1, 'overview tab must open by default');
    assert.equal(await page.locator('.project-detail-modal ' + panels + '[data-detail-tab-panel="technical"][hidden]').count(), 1, 'technical content must be hidden by default');
    const technicalTab = page.locator('.project-detail-modal ' + tabs + ' [data-detail-tab="technical"]');
    if (await technicalTab.count()) {
      await technicalTab.click();
      assert.equal(await page.locator('.project-detail-modal ' + panels + '[data-detail-tab-panel="technical"]:not([hidden])').count(), 1, 'technical tab must open');
      assert.equal(await page.locator('.project-detail-modal ' + panels + '[data-detail-tab-panel="overview"][hidden]').count(), 1, 'switch hides overview');
    }
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(node => node.remove()));
    if (width === 1280) {
      await page.locator('[data-discover-more-sort="downloads"]').first().click();
      await page.locator('.projects-grid.store-catalog .store-row').first().waitFor({timeout:25000});
      const count = await page.locator('.projects-grid.store-catalog .store-row').count();
      assert.ok(count >= 3, 'catalog navigation should show compact rows');
    }
    assert.deepEqual(errors, [], 'JavaScript page errors: ' + errors.join('; '));
    console.log('PASS ' + width + 'px ' + JSON.stringify(metrics));
    await context.close();
  }
} finally { await browser.close(); }
