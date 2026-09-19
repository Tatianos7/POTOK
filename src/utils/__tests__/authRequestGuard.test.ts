import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthRequestGuard } from '../authRequestGuard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('late bootstrap cannot overwrite a newer account, including A -> B -> A', async () => {
  const guard = createAuthRequestGuard();
  const bootstrap = deferred<string>();
  const isBootstrapCurrent = guard.begin();
  const writes: string[] = [];
  const pending = bootstrap.promise.then((user) => { if (isBootstrapCurrent()) writes.push(user); });
  const isBCurrent = guard.begin();
  const isNewACurrent = guard.begin();
  bootstrap.resolve('old A with old premium profile');
  await pending;
  assert.deepEqual(writes, []);
  assert.equal(isBCurrent(), false);
  assert.equal(isNewACurrent(), true);
});

test('sign-out invalidates pending profile success and profile update work', async () => {
  const guard = createAuthRequestGuard();
  const profile = deferred<string>();
  const isCurrent = guard.begin();
  const isUpdateCurrent = guard.capture();
  let displayedUser: string | null = null;
  const pending = profile.promise.then((value) => { if (isCurrent()) displayedUser = value; });
  guard.invalidate();
  profile.resolve('signed-out user');
  await pending;
  assert.equal(displayedUser, null);
  assert.equal(isUpdateCurrent(), false);
});

test('an obsolete rejection cannot clear the current account', async () => {
  const guard = createAuthRequestGuard();
  const profile = deferred<string>();
  const isCurrent = guard.begin();
  let signedOut = false;
  const pending = profile.promise.catch(() => { if (isCurrent()) signedOut = true; });
  guard.begin();
  profile.reject(new Error('invalid refresh token from old request'));
  await pending;
  assert.equal(signedOut, false);
});
