// Runs only inside an already authenticated, isolated application browser harness.
// No credentials, original rows, OTPs or request bodies are returned or logged.
import assert from 'node:assert/strict';

export async function verifyProfileRecovery({page, context, a, b, remote}) {
  assert.notEqual(a, b);
  const queueA = await page.evaluate(id => localStorage.getItem('profile_pending_v1_' + id), a);
  assert(queueA, 'Expected the existing A-owned offline queue');
  const before = await remote(page, b);
  const writes = [];
  const capture = request => {
    const url = new URL(request.url());
    if (url.pathname !== '/rest/v1/user_profiles' || !['POST', 'PATCH'].includes(request.method())) return;
    const body = request.postDataJSON();
    for (const row of Array.isArray(body) ? body : [body]) {
      writes.push({keys: Object.keys(row).sort(), foreign: row.id_user != null && row.id_user !== b});
    }
  };
  page.on('request', capture);
  try {
    // A malformed B queue must not replay A's payload, mutate B or disappear.
    const mismatched = JSON.stringify({version: 2, account_id: a, ordinary: {first_name: 'must-not-replay'}});
    await page.evaluate(({b, mismatched}) => localStorage.setItem('profile_pending_v1_' + b, mismatched), {b, mismatched});
    await page.evaluate(async id => { await window.__potokAcceptance.profiles.getProfile(id); }, b);
    assert.equal(await page.evaluate(id => localStorage.getItem('profile_pending_v1_' + id), b), mismatched);
    assert.equal((await remote(page, b)).first_name, before.first_name);
    assert.equal(writes.length, 0, 'Mismatched queue issued a mutation');

    // A legacy queue can preserve ordinary changes without sending old privileges.
    await page.evaluate(id => localStorage.setItem('profile_pending_v1_' + id, JSON.stringify({
      id_user: id, first_name: 'Recovered ordinary profile', height: 173,
      is_admin: true, has_premium: true, premium_provenance_id: 'never-send-this-value',
      created_at: '2099-01-01T00:00:00Z', updated_at: '2099-01-01T00:00:00Z',
    })), b);
    await page.evaluate(async id => { await window.__potokAcceptance.profiles.getProfile(id); }, b);
    const recovered = await remote(page, b);
    assert.equal(recovered.first_name, 'Recovered ordinary profile');
    assert.equal(recovered.height, 173);
    assert.equal(recovered.is_admin, false);
    assert.equal(recovered.has_premium, false);
    assert.equal(recovered.created_at, before.created_at);
    assert.equal(recovered.updated_at, before.updated_at);
    assert.equal(await page.evaluate(id => localStorage.getItem('profile_pending_v1_' + id), b), null);
    const quarantine = await page.evaluate(id => window.__potokAcceptance.profiles.getProfilePrivilegeQuarantine(id), b);
    assert.deepEqual(quarantine, {
      version: 1, account_id: b, status: 'requires_trusted_authority',
      omitted_fields: ['has_premium', 'is_admin', 'premium_provenance_id'],
    });
    assert(!JSON.stringify(quarantine).includes('never-send-this-value'));
    assert(writes.length > 0, 'Recovery never reached the actual API');
    for (const write of writes) {
      assert.equal(write.foreign, false);
      assert(write.keys.every(key => ['id_user', 'first_name', 'height'].includes(key)), 'Protected field sent over HTTP');
    }

    // Offline cache is untrusted even if its privilege booleans are forged.
    await context.setOffline(true);
    const cached = await page.evaluate(async id => {
      const key = 'profile_cache_v1_' + id;
      const current = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({...current, is_admin: true, has_premium: true}));
      const profile = await window.__potokAcceptance.profiles.getProfile(id);
      return {id: profile.id_user, admin: profile.is_admin, premium: profile.has_premium};
    }, b);
    assert.deepEqual(cached, {id: b, admin: false, premium: false});
    await context.setOffline(false);
    const setters = await page.evaluate(async id => {
      const result = [];
      for (const name of ['updateAdminStatus', 'updatePremiumStatus']) {
        try { await window.__potokAcceptance.profiles[name](id, true); result.push('unexpected-success'); }
        catch (error) { result.push(error.name); }
      }
      return result;
    }, b);
    assert.deepEqual(setters, ['ProfilePrivilegeWriteBlockedError', 'ProfilePrivilegeWriteBlockedError']);
    await page.reload();
    await page.waitForFunction(id => window.__potokAcceptance?.state?.status === 'authenticated' && window.__potokAcceptance.state.id === id, b);
    assert.deepEqual(await page.evaluate(() => ({admin: window.__potokAcceptance.state.admin, premium: window.__potokAcceptance.state.premium})), {admin: false, premium: false});
    assert.equal(await page.evaluate(id => localStorage.getItem('profile_pending_v1_' + id), a), queueA);
    assert.equal((await remote(page, b)).first_name, 'Recovered ordinary profile');
    console.log('PROFILE_RECOVERY_BROWSER_OK: legacy queue sanitized; wrong-account replay blocked; forged offline flags fail closed; A queue unchanged');
  } finally {
    page.off('request', capture);
    await context.setOffline(false);
  }
}
