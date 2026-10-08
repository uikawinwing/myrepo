import { homePage, homeScriptPage } from './pages/home';

interface PreviewEnv {
  STAGING_WORKER: Fetcher;
}

const UPSTREAM = 'https://workshop-test.uika.cc.cd';
const READ_ONLY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'public, max-age=30',
  'X-Workshop-Preview': 'read-only-appstore',
};

function allowedPublicApi(path: string): boolean {
  return path === '/api/projects'
    || path === '/api/devteam-recommendations'
    || path === '/api/site/discover-banner'
    || /^\/api\/projects\/[0-9a-f-]{36}$/.test(path)
    || path === '/api/character-references'
    || /^\/api\/character-references\/[A-Za-z0-9_-]+\/versions$/.test(path);
}

function previewHtml(): string {
  const banner = '<div role="status" style="padding:9px 20px;text-align:center;font:600 13px/1.5 system-ui;background:#4a3921;color:#fff4dc">独立设计预览 · 真实公开作品 · 只读模式（登录、安装及资料修改不可用）</div>';
  return homePage().replace('<div class="container" id="app"></div>', banner + '<div class="container" id="app"></div>');
}

export default {
  async fetch(request: Request, env: PreviewEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('此预览只支持公开浏览，不允许修改任何资料。', {
        status: 405,
        headers: { Allow: 'GET, HEAD', ...READ_ONLY_HEADERS },
      });
    }
    if (path === '/' || path === '/index.html') {
      return new Response(request.method === 'HEAD' ? null : previewHtml(), {
        headers: {
          ...READ_ONLY_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; script-src 'self'; img-src 'self' https://workshop-test.uika.cc.cd https://cdn.discordapp.com https://wsrv.nl data: blob:; font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' https://discord.com; frame-ancestors 'none';",
        },
      });
    }
    if (path === '/assets/home.js') {
      return new Response(request.method === 'HEAD' ? null : homeScriptPage(), {
        headers: { ...READ_ONLY_HEADERS, 'Content-Type': 'application/javascript; charset=utf-8' },
      });
    }
    if (!allowedPublicApi(path)) {
      return new Response('预览版不开放此功能', { status: 404, headers: READ_ONLY_HEADERS });
    }
    if (path === '/api/projects') {
      const page = Number(url.searchParams.get('page') || '0');
      const size = Number(url.searchParams.get('pageSize') || '48');
      if (!Number.isInteger(page) || page < 0 || page > 25 ||
          !Number.isInteger(size) || size < 1 || size > 50 ||
          (url.searchParams.get('search') || '').length > 120) {
        return new Response('查询范围超出预览限制', { status: 400, headers: READ_ONLY_HEADERS });
      }
    }
    const upstreamUrl = new URL(path + url.search, UPSTREAM);
    // Never forward credentials, cookies, session tokens, or non-GET methods.
    const upstream = await env.STAGING_WORKER.fetch(new Request(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }));
    const headers = new Headers(READ_ONLY_HEADERS);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8');
    // Do not make credentialed upstream responses public. All proxy traffic is anonymous.
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};

