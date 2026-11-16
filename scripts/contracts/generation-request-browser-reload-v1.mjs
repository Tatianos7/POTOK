import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

export async function checkReload(account, key, rpc) {
  const host = 'http://127.0.0.1:4179';
  const supabaseHost = 'ozidryfvhkcbtpnulakq.supabase.co';
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js',
    '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, VITE_SUPABASE_URL: 'https://' + supabaseHost,
      VITE_SUPABASE_ANON_KEY: 'local-browser-fixture', VITE_POTOK_STAGING_GENERATION_CHECK: 'true',
      VITE_POTOK_STAGING_GENERATION_ACCOUNT: account },
  });
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt++) {
      if (vite.exitCode !== null) throw new Error('Local fixture frontend failed to start');
      ready = await fetch(host, { signal: AbortSignal.timeout(1000) })
        .then((response) => response.ok, () => false);
      if (!ready) await delay(250);
    }
    assert.ok(ready, 'Local fixture frontend must respond before Chromium opens it');
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ timezoneId: 'UTC', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const user = { id: account, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid',
      user_metadata: {}, app_metadata: {}, created_at: '2026-11-16T00:00:00Z' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = [b64({ alg: 'HS256' }), b64({ sub: account, exp }), 'fixture'].join('.');
    await context.addInitScript(({ user, token, exp, key }) => {
      localStorage.setItem('pin_offer_skipped_v1', 'true');
      localStorage.setItem('sb-ozidryfvhkcbtpnulakq-auth-token', JSON.stringify({
        access_token: token, refresh_token: 'fixture', expires_at: exp, token_type: 'bearer', user,
      }));
      crypto.randomUUID = () => key;
    }, { user, token, exp, key });
    let requests = 0;
    let reads = 0;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === host) return route.continue();
      if (url.hostname !== supabaseHost) return route.abort();
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      const name = url.pathname.split('/').at(-1);
      if (['adaptive_nutrition_request_generation_v2', 'adaptive_nutrition_generation_status_v2',
          'adaptive_nutrition_read_generation_plan_v2'].includes(name)) {
        if (name === 'adaptive_nutrition_request_generation_v2') requests++;
        if (name === 'adaptive_nutrition_read_generation_plan_v2') reads++;
        const result = await rpc(name, route.request().postDataJSON());
        return route.fulfill({ status: result.error ? 400 : 200, json: result.error ?? result.data });
      }
      return route.fulfill({json:url.pathname.startsWith('/rest/v1/rpc/') ? false : []});
    });
    const page = await context.newPage();
    await page.goto(host + '/staging/generation-check');
    await page.getByRole('button', { name: 'Составить меню' }).click({ timeout: 12000 });
    await page.getByRole('heading', { name: 'Моё меню на неделю' }).waitFor({ timeout: 12000 });
    assert.equal(await page.locator('details').count(), 7);
    await page.reload();
    await page.getByRole('button', { name: 'Проверить результат' }).click({ timeout: 12000 });
    await page.getByRole('heading', { name: 'Моё меню на неделю' }).waitFor({ timeout: 12000 });
    assert.equal(await page.locator('details').count(), 7);
    assert.equal(requests, 1);
    assert.equal(reads, 2);
  } finally {
    try { await browser?.close(); } finally { vite.kill(); }
  }
}
