// Runs without Docker/DB/signing credentials. User JWTs come only from real OTP.
import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import {createPrivateGateway} from '../combined-api/private-gateway.mjs';
import {verifyProfileRecovery} from '../combined-api/profile-recovery.mjs';
import {createMailCapture} from './private-auth-ab-worker.mjs';
import {validateIdentities} from './private-browser-policy.mjs';

export async function runBrowser() {
  const self = process.argv[2] === '--self-check', ci = process.argv[2] === '--ci';
  assert(['--self-check', '--ci', '--private'].includes(process.argv[2]));
  if (ci) assert.equal(process.env.GITHUB_ACTIONS, 'true');
  const users = self ? [] : JSON.parse(process.env.POTOK_BROWSER_USERS);
  if (!self) validateIdentities(users, ci);
  const directory = await mkdtemp('/tmp/potok-browser-');
  process.env.VITE_SUPABASE_URL = self ? '' : 'http://127.0.0.1:13004';
  process.env.VITE_SUPABASE_ANON_KEY = self ? '' : process.env.POTOK_BROWSER_ANON_KEY;
  if (!self) {
    const payload = JSON.parse(Buffer.from(process.env.POTOK_BROWSER_ANON_KEY.split('.')[1], 'base64url'));
    assert.equal(payload.role, 'anon'); assert(!payload.sub);
  }
  const html = '<html><div id="root"></div><script type="module" src="/private-entry.jsx"></script></html>';
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {ThemeProvider} from '/src/context/ThemeContext.tsx';import {AuthProvider,useAuth} from '/src/context/AuthContext.tsx';
import Login from '/src/pages/Login.tsx';import Profile from '/src/pages/Profile.tsx';
import {supabase} from '/src/lib/supabaseClient.ts';import {profileService} from '/src/services/profileService.ts';
window.__potokAcceptance={client:supabase,profiles:profileService};
function Probe(){const a=useAuth();window.__potokAcceptance.state={id:a.user?.id,status:a.authStatus,admin:a.user?.isAdmin,premium:a.user?.hasPremium};return null;}
const e=React.createElement;createRoot(document.getElementById('root')).render(e(ThemeProvider,null,e(BrowserRouter,null,e(AuthProvider,null,e(Probe),e(Routes,null,e(Route,{path:'/auth',element:e(Login)}),e(Route,{path:'*',element:e(Profile)}))))));`;
  const server = await createServer({root: '/app', configFile: false, envDir: directory, cacheDir: directory + '/cache',
    plugins: [react(), {name: 'private-browser-harness', configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        if (req.url === '/private-entry.jsx') { const r = await s.transformRequest(req.url); res.setHeader('Content-Type', 'application/javascript'); res.end(r.code); return; }
        if (['/', '/auth', '/profile', '/pin/offer'].includes(req.url)) { res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml(req.url, html)); return; }
        next();
      });
    }, resolveId(id) { if (id === '/private-entry.jsx') return '\0private-entry.jsx'; }, load(id) { if (id === '\0private-entry.jsx') return entry; }}],
    server: {host: '127.0.0.1', port: 13005, strictPort: true, hmr: false}, logLevel: 'silent'});
  const gateway = self ? null : createPrivateGateway({mode: ci ? 'ci' : 'private'});
  const capture = self || ci ? null : createMailCapture(users.map(u => u.email));
  let browser, context, stage = 'start'; const forbidden = [];
  const poll = async (fn, label) => { for (let i = 0; i < 80; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 250)); } throw Error(label); };
  async function remote(page, id) {
    return page.evaluate(async id => {
      const r = await window.__potokAcceptance.client.from('user_profiles').select('*').eq('id_user', id).single();
      if (r.error) throw Error('Owned profile unavailable'); return r.data;
    }, id);
  }
  async function mailList(email) {
    const r = await fetch('http://127.0.0.1:54324/api/v1/messages', {signal: AbortSignal.timeout(3000)});
    const body = await r.json(); return (body.messages ?? []).filter(m => m.To?.some(to => to.Address === email));
  }
  async function login(page, user) {
    const seen = ci ? new Set((await mailList(user.email)).map(m => m.ID)) : null;
    await page.goto('http://127.0.0.1:13005/auth');
    await page.waitForFunction(() => Boolean(window.__potokAcceptance?.client));
    await page.locator('#email').fill(user.email);
    await page.getByRole('button', {name: 'Получить код', exact: true}).click();
    let code;
    await poll(async () => {
      if (capture) { code = capture.codes.get(user.email); return Boolean(code); }
      const message = (await mailList(user.email)).find(m => !seen.has(m.ID));
      if (!message) return false;
      const detail = await fetch('http://127.0.0.1:54324/api/v1/message/' + message.ID, {signal: AbortSignal.timeout(3000)}).then(r => r.json());
      code = (detail.Text + ' ' + detail.HTML).match(/POTOK_TEST_CODE=(\d{6})/)?.[1]; return Boolean(code);
    }, 'OTP unavailable');
    assert.match(code, /^[0-9]{6}$/);
    capture?.codes.delete(user.email);
    await page.locator('#otpCodeEmail').fill(code); code = null;
    await page.getByRole('button', {name: 'Войти', exact: true}).click();
    await page.waitForFunction(id => window.__potokAcceptance?.state?.status === 'authenticated' && window.__potokAcceptance.state.id === id, user.id);
    assert.deepEqual(await page.evaluate(() => ({admin: window.__potokAcceptance.state.admin, premium: window.__potokAcceptance.state.premium})), {admin: false, premium: false});
    const r = await remote(page, user.id); assert.equal(r.id_user, user.id); assert.equal(r.is_admin, false); assert.equal(r.has_premium, false);
  }
  try {
    await capture?.start(); await gateway?.start(); await server.listen();
    browser = await chromium.launch({headless: true}); context = await browser.newContext();
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      if (['http://127.0.0.1:13005', 'http://127.0.0.1:13004'].includes(u.origin) || u.protocol === 'data:') return route.continue();
      forbidden.push(u.origin); return route.abort();
    });
    let page = await context.newPage(); page.setDefaultTimeout(25000);
    if (self) {
      assert.equal(process.version, 'v24.22.1');
      assert.equal(JSON.parse(await readFile('/app/node_modules/playwright/package.json')).version, '1.40.0');
      await page.goto('http://127.0.0.1:13005/auth');
      await page.waitForFunction(() => window.__potokAcceptance?.client === null);
      assert.equal(forbidden.length, 0);
      console.log('PRIVATE_BROWSER_RUNTIME_OK: Node, Chromium and actual application modules load without a database'); return;
    }
    stage = 'A-login'; await login(page, users[0]);
    stage = 'A-profile'; await page.evaluate(async id => window.__potokAcceptance.profiles.saveProfile(id, {firstName: 'Browser synthetic A', height: 172}), users[0].id);
    assert.equal((await remote(page, users[0].id)).first_name, 'Browser synthetic A');
    const avatar = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
    await page.locator('input[type=file]').setInputFiles({name: 'synthetic.png', mimeType: 'image/png', buffer: avatar});
    await poll(async () => String((await remote(page, users[0].id)).avatar_url).startsWith('data:image/png;base64,'), 'Avatar unavailable');
    await page.reload(); await page.waitForFunction(id => window.__potokAcceptance?.state?.id === id && window.__potokAcceptance.state.status === 'authenticated', users[0].id);
    await page.locator('img[alt=Avatar]').waitFor(); assert((await page.locator('img[alt=Avatar]').getAttribute('src')).startsWith('data:image/png;base64,'));
    assert(await page.evaluate(async () => {const r = await window.__potokAcceptance.client.auth.refreshSession(); return !r.error && Boolean(r.data.session); }));
    stage = 'A-offline'; await context.setOffline(true);
    await page.evaluate(async id => window.__potokAcceptance.profiles.saveProfile(id, {firstName: 'Browser A reconnect'}), users[0].id);
    await context.setOffline(false); await page.evaluate(async id => window.__potokAcceptance.profiles.getProfile(id), users[0].id);
    assert.equal((await remote(page, users[0].id)).first_name, 'Browser A reconnect');
    await context.setOffline(true); await page.evaluate(async id => window.__potokAcceptance.profiles.saveProfile(id, {firstName: 'A queue during B'}), users[0].id); await context.setOffline(false);
    await page.evaluate(() => window.__potokAcceptance.client.auth.signOut()); await page.close();
    page = await context.newPage(); page.setDefaultTimeout(25000);
    stage = 'B-login'; await login(page, users[1]);
    stage = 'foreign-access';
    const foreign = await page.evaluate(async id => { const r = await window.__potokAcceptance.client.from('user_profiles').select('id_user').eq('id_user', id); return {data: r.data, error: Boolean(r.error)}; }, users[0].id);
    assert.deepEqual(foreign, {data: [], error: false});
    const rejected = await page.evaluate(async id => {try {await window.__potokAcceptance.profiles.saveProfile(id, {firstName: 'forbidden'}); return false;} catch (e) {return e.name === 'ProfileUserScopeError';}}, users[0].id);
    assert.equal(rejected, true);
    stage = 'profile-recovery'; await verifyProfileRecovery({page, context, a: users[0].id, b: users[1].id, remote});
    assert.equal(forbidden.length, 0);
    if (capture) assert(capture.rejected === 0 && users.every(u => capture.counts.get(u.email) === 1));
    console.log('PRIVATE_BROWSER_HTTP_OK: actual OTP/Login/Profile/AuthProvider, avatar, refresh, offline and A/B recovery; final database proof is separate');
  } catch { console.error('PRIVATE_BROWSER_HTTP_STOPPED: phase=' + stage); process.exitCode = 1; }
  finally { capture?.codes.clear(); await context?.close(); await browser?.close(); await server.close(); await gateway?.close(); await capture?.close(); await rm(directory, {recursive: true, force: true}); }
}
if (process.argv[1]?.endsWith('/private-browser-worker.mjs')) runBrowser().catch(() => {console.error('PRIVATE_BROWSER_HTTP_STOPPED: phase=admission'); process.exitCode = 1;});
