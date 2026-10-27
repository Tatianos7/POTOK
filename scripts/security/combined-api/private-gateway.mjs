// Ordinary browser credentials pass through; this gateway owns no signing/DB key.
import assert from 'node:assert/strict';
import {createServer, request} from 'node:http';

const authRoutes = new Map([
  ['/otp', ['POST']], ['/verify', ['POST']], ['/user', ['GET']],
  ['/token', ['POST']], ['/logout', ['POST']], ['/health', ['GET']], ['/settings', ['GET']],
]);
const restRoutes = new Map([
  ['/user_profiles', ['GET', 'POST', 'PATCH']], ['/foods', ['GET']],
  ['/rpc/has_verified_entitlement_v1', ['POST']],
  ['/rpc/get_entitlements', ['POST']], ['/rpc/get_paywall_state', ['POST']],
]);
const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-connection']);
export function safeHeaders(headers) {
  const blocked = new Set(hopHeaders);
  for (const key of String(headers.connection ?? '').toLowerCase().split(',')) blocked.add(key.trim());
  return Object.fromEntries(Object.entries(headers).filter(([key]) =>
    !blocked.has(key.toLowerCase()) && !key.toLowerCase().startsWith('x-forwarded-') && !['host', 'forwarded'].includes(key.toLowerCase())));
}

export function routeFor(rawPath, method) {
  if (typeof rawPath !== 'string' || !rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.length > 8192) return null;
  const [pathname] = rawPath.split('?');
  if (/[\\%#]/.test(pathname)) return null;
  for (const [prefix, routes, service] of [['/auth/v1', authRoutes, 'auth'], ['/rest/v1', restRoutes, 'rest']]) {
    if (!pathname.startsWith(prefix + '/')) continue;
    const suffix = pathname.slice(prefix.length);
    if (!routes.get(suffix)?.includes(method)) return null;
    return {service, path: rawPath.slice(prefix.length)};
  }
  return null;
}

export function createPrivateGateway({mode = 'private'} = {}) {
  assert(['private', 'ci'].includes(mode));
  if (mode === 'ci') assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Synthetic endpoints are CI-only');
  // No arbitrary upstream URL, environment proxy, remote hostname or redirect target.
  const targets = mode === 'private'
    ? {auth: {port: 13002, prefix: ''}, rest: {port: 33001, prefix: ''}}
    : {auth: {port: 54321, prefix: '/auth/v1'}, rest: {port: 54321, prefix: '/rest/v1'}};
  const sockets = new Set(), upstreams = new Set();
  const server = createServer({maxHeaderSize: 16384}, async (req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== 'http://127.0.0.1:55440') { res.writeHead(403); res.end(); return; }
    const cors = origin ? {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin'} : {};
    if (req.method === 'OPTIONS') {
      const method = req.headers['access-control-request-method'];
      const requested = String(req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
      const allowed = ['authorization', 'content-type', 'apikey', 'prefer', 'x-client-info', 'accept-profile', 'content-profile', 'x-supabase-api-version'];
      if (!origin || !routeFor(req.url, method) || requested.some(h => !allowed.includes(h))) { res.writeHead(403); res.end(); return; }
      res.writeHead(204, {...cors, 'Access-Control-Allow-Methods': method, 'Access-Control-Allow-Headers': requested.join(', ')}); res.end(); return;
    }
    const route = routeFor(req.url, req.method);
    if (!route) { res.writeHead(404, {'Content-Type': 'text/plain'}); res.end('Unavailable'); return; }
    const chunks = []; let bytes = 0;
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) { res.writeHead(413, cors); res.end(); return; }
        chunks.push(chunk);
      }
    } catch { if (!res.destroyed) { res.writeHead(400); res.end(); } return; }
    // Validate the whole bounded body before contacting any mutation endpoint.
    if (req.method === 'GET' && bytes) { res.writeHead(400, cors); res.end(); return; }
    const body = Buffer.concat(chunks);
    const outgoing = safeHeaders(req.headers);
    delete outgoing['content-length'];
    if (req.method !== 'GET') outgoing['content-length'] = String(body.length);
    const target = targets[route.service];
    const upstream = request({hostname: '127.0.0.1', port: target.port, agent: false,
      method: req.method, path: target.prefix + route.path,
      headers: outgoing, timeout: 15000}, response => {
      // Auth OTP uses JSON; redirects must never move browser credentials elsewhere.
      if (response.statusCode >= 300 && response.statusCode < 400) {
        response.resume(); res.writeHead(502); res.end('Local upstream failed'); return;
      }
      const headers = safeHeaders(response.headers);
      delete headers['set-cookie'];
      // CORS is owned by this gateway, not copied from an upstream configuration.
      for (const key of Object.keys(headers)) if (key.startsWith('access-control-')) delete headers[key];
      res.writeHead(response.statusCode, {...headers, ...cors});
      response.pipe(res);
      response.on('error', () => res.destroy());
    });
    upstreams.add(upstream);
    upstream.on('close', () => upstreams.delete(upstream));
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) { res.writeHead(502); res.end('Local upstream failed'); }
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    upstream.end(body);
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', (_req, socket) => socket.destroy());
  server.on('connect', (_req, socket) => socket.destroy());
  return {
    server,
    async start() { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(13004, '127.0.0.1', resolve); }); },
    async close() {
      for (const upstream of upstreams) upstream.destroy();
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
