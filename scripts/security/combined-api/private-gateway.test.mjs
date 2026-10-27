import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {connect} from 'node:net';
import {createPrivateGateway, routeFor, safeHeaders} from './private-gateway.mjs';

test('gateway routes have exact local resource and method boundaries', () => {
  assert.deepEqual(routeFor('/auth/v1/token?grant_type=refresh_token', 'POST'), {service: 'auth', path: '/token?grant_type=refresh_token'});
  assert.deepEqual(routeFor('/rest/v1/user_profiles?id_user=eq.synthetic', 'PATCH'), {service: 'rest', path: '/user_profiles?id_user=eq.synthetic'});
  for (const route of ['/auth/v1/admin/users', '/auth/v1/signup', '/rest/v1/billing_events',
    '/rest/v1/rpc/grant_verified_entitlement_v1', '/storage/v1/object/x', '/codes', '/template',
    '//example.test/auth/v1/user', 'http://example.test/auth/v1/user',
    '/auth/v1/user/../admin', '/auth/v1/%75ser', '/rest/v1/user_profiles%2fsecret', '/auth/v1/user#x']) {
    assert.equal(routeFor(route, 'GET'), null);
    assert.equal(routeFor(route, 'POST'), null);
  }
  assert.equal(routeFor('/rest/v1/user_profiles', 'DELETE'), null);
  assert.equal(routeFor('/auth/v1/user', 'PUT'), null);
  assert.equal(routeFor('/rest/v1/user_profiles', 'CONNECT'), null);
});

test('hop-by-hop, connection nominated and forwarding headers are stripped', () => {
  assert.deepEqual(safeHeaders({host: 'external.test', connection: 'keep-alive, x-private-hop',
    'x-private-hop': 'drop', 'proxy-authorization': 'drop', forwarded: 'drop',
    'x-forwarded-host': 'drop', authorization: 'Bearer synthetic-user', apikey: 'ordinary-client'}),
  {authorization: 'Bearer synthetic-user', apikey: 'ordinary-client'});
  const old = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try { assert.throws(() => createPrivateGateway({mode: 'ci'})); }
  finally { if (old !== undefined) process.env.GITHUB_ACTIONS = old; }
  assert.throws(() => createPrivateGateway({mode: 'external'}));
});

test('real HTTP gateway forwards only to fixed loopback services and fails closed', async t => {
  const seen = [];
  const upstream = name => createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    seen.push({name, path: req.url, method: req.method, body, authorization: req.headers.authorization,
      forwarded: req.headers.forwarded, proxy: req.headers['proxy-authorization']});
    if (req.url.includes('redirect=true')) {
      res.writeHead(302, {Location: 'https://must-not-follow.example.test'}); res.end(); return;
    }
    res.writeHead(200, {'Content-Type': 'application/json', 'Set-Cookie': 'must-not-forward=1',
      'Access-Control-Allow-Origin': '*'});
    res.end(JSON.stringify({service: name}));
  });
  const auth = upstream('auth'), rest = upstream('rest'), gateway = createPrivateGateway();
  const listen = (server, port) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const call = (path, options = {}) => fetch('http://127.0.0.1:13004' + path, {...options, redirect: 'manual', signal: AbortSignal.timeout(3000)});
  try {
    // Bind synthetic servers first; if a port is occupied, never contact its owner.
    await listen(auth, 13002); await listen(rest, 33001); await gateway.start();
    await t.test('ordinary credentials and query/body go to the expected local service', async () => {
      const response = await call('/rest/v1/user_profiles?id_user=eq.synthetic', {method: 'PATCH',
        headers: {Authorization: 'Bearer synthetic-user', 'Content-Type': 'application/json',
          Origin: 'http://127.0.0.1:55440', Forwarded: 'host=external.test', 'Proxy-Authorization': 'drop'},
        body: JSON.stringify({first_name: 'Synthetic'})});
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {service: 'rest'});
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:55440');
      assert.deepEqual(seen.at(-1), {name: 'rest', path: '/user_profiles?id_user=eq.synthetic', method: 'PATCH',
        body: '{"first_name":"Synthetic"}', authorization: 'Bearer synthetic-user', forwarded: undefined, proxy: undefined});
      assert.equal((await call('/auth/v1/health').then(r => r.json())).service, 'auth');
    });
    await t.test('CORS preflight is bounded to the harness and allowed routes/headers', async () => {
      const before = seen.length;
      const headers = {Origin: 'http://127.0.0.1:55440', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,x-client-info'};
      assert.equal((await call('/auth/v1/otp', {method: 'OPTIONS', headers})).status, 204);
      assert.equal((await call('/auth/v1/otp', {method: 'OPTIONS', headers: {...headers, Origin: 'https://external.test'}})).status, 403);
      assert.equal((await call('/auth/v1/otp', {method: 'OPTIONS', headers: {...headers, 'Access-Control-Request-Headers': 'x-forwarded-host'}})).status, 403);
      assert.equal((await call('/rest/v1/billing_events', {method: 'OPTIONS', headers})).status, 403);
      assert.equal(seen.length, before);
    });
    await t.test('unknown routes, external origins and upstream redirects cannot escape', async () => {
      const before = seen.length;
      for (const path of ['/codes', '/storage/v1/object/test', '/auth/v1/admin/users', '/rest/v1/program_versions']) {
        assert.equal((await call(path)).status, 404);
      }
      assert.equal((await call('/auth/v1/user', {headers: {Origin: 'https://external.test'}})).status, 403);
      assert.equal(seen.length, before);
      const redirected = await call('/auth/v1/user?redirect=true');
      assert.equal(redirected.status, 502);
      assert.equal(redirected.headers.get('location'), null);
    });
    await t.test('oversized mutation body is rejected before any upstream request', async () => {
      const before = seen.length;
      await call('/rest/v1/user_profiles', {method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1)})
        .then(r => assert.equal(r.status, 413), error => assert(['TypeError', 'TimeoutError'].includes(error.name)));
      assert.equal(seen.length, before);
    });
    await t.test('CONNECT and WebSocket upgrade are closed rather than tunnelled', async () => {
      const before = seen.length;
      for (const line of ['CONNECT external.test:443 HTTP/1.1\r\nHost: external.test\r\n\r\n',
        'GET /auth/v1/user HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n']) {
        await new Promise((resolve, reject) => {
          const socket = connect(13004, '127.0.0.1', () => socket.end(line));
          socket.setTimeout(3000, () => { socket.destroy(); reject(Error('Tunnel remained open')); });
          socket.on('error', reject); socket.on('close', resolve);
        });
      }
      assert.equal(seen.length, before);
    });
    await t.test('unavailable local service returns a generic error without credential disclosure', async () => {
      rest.closeAllConnections(); await new Promise(resolve => rest.close(resolve));
      const response = await call('/rest/v1/user_profiles', {headers: {Authorization: 'Bearer synthetic-user'}});
      assert.equal(response.status, 502);
      assert.equal(await response.text(), 'Local upstream failed');
    });
  } finally {
    await gateway.close();
    for (const server of [auth, rest]) { server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
  }
});
