import assert from 'node:assert/strict';
export function validateIdentities(users, ci = false) {
  assert.equal(users.length, 2);
  assert.equal(new Set(users.map(u => u.id)).size, 2);
  assert.equal(new Set(users.map(u => u.email)).size, 2);
  for (const [i, user] of users.entries()) {
    assert.match(user.id, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    if (ci) assert.equal(user.email, ['combined-ui-a@example.test', 'combined-ui-b@example.test'][i]);
    else assert.match(user.email, new RegExp('^potok-ab-[a-f0-9]{24}-' + ['a', 'b'][i] + '@example\\.test$'));
  }
  if (!ci) assert.equal(users[0].email.slice(0, 33), users[1].email.slice(0, 33));
}
export function browserArgs({name, dbId, imageId, envFile}) {
  assert.match(name, /^potok_private_browser_2026-10-27$/);
  assert.match(dbId, /^[a-f0-9]{64}$/); assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  assert(typeof envFile === 'string' && envFile.startsWith('/') && !/[\r\n\0]/.test(envFile));
  return ['create', '--name', name, '--pull', 'never', '--network', 'container:' + dbId, '--restart', 'no',
    '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=536870912,mode=1777', '--shm-size', '256m',
    '--env-file', envFile, '--entrypoint', 'node', imageId, '/app/scripts/security/accumulated/private-browser-worker.mjs', '--private'];
}
export function verifyIdentityScope(original, after, scoped) {
  assert.deepEqual(scoped.map(t => t.schema + '.' + t.name).sort(), ['auth.users', 'auth.identities', 'auth.sessions', 'auth.refresh_tokens', 'auth.audit_log_entries', 'auth.one_time_tokens', 'auth.flow_state', 'auth.mfa_amr_claims', 'public.user_profiles'].sort());
  for (const table of scoped) {
    const before = original.find(t => t.schema === table.schema && t.name === table.name);
    const now = after.find(t => t.schema === table.schema && t.name === table.name);
    assert(before && now); assert.equal(now.hashes.length - before.hashes.length, table.rows);
    if (table.schema === 'auth' && table.name === 'users' || table.schema === 'public' && table.name === 'user_profiles') assert.equal(table.rows, 2);
  }
  assert.equal(scoped.length, 9);
  assert.equal(new Set(scoped.map(t => t.schema + '.' + t.name)).size, 9);
}
