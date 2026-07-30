import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { completeAuthCallback } from '../AuthCallback';

const currentDir = dirname(fileURLToPath(import.meta.url));
const loginSource = readFileSync(resolve(currentDir, '../Login.tsx'), 'utf8');
const registerSource = readFileSync(resolve(currentDir, '../Register.tsx'), 'utf8');
const authContextSource = readFileSync(resolve(currentDir, '../../context/AuthContext.tsx'), 'utf8');

test('auth callback exchanges code query param when no session exists yet', async () => {
  const calls: string[] = [];
  const client = {
    auth: {
      exchangeCodeForSession: async (code: string) => {
        calls.push(`exchange:${code}`);
        return { error: null };
      },
      getSession: async () => {
        calls.push('session');
        return {
          data: {
            session: calls.includes('exchange:auth-code') ? { user: { id: 'user-1' } } : null,
          },
        };
      },
    },
  };

  const hasSession = await completeAuthCallback(
    client,
    'https://tatianos7.github.io/POTOK/auth/callback?code=auth-code',
  );

  assert.equal(hasSession, true);
  assert.deepEqual(calls, ['session', 'exchange:auth-code', 'session']);
});

test('auth callback does not exchange code when session already exists', async () => {
  let exchangeCount = 0;
  const client = {
    auth: {
      exchangeCodeForSession: async () => {
        exchangeCount += 1;
        return { error: null };
      },
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
    },
  };

  const hasSession = await completeAuthCallback(
    client,
    'https://tatianos7.github.io/POTOK/auth/callback?code=already-exchanged',
  );

  assert.equal(hasSession, true);
  assert.equal(exchangeCount, 0);
});

test('auth callback reports failed code exchange', async () => {
  const client = {
    auth: {
      exchangeCodeForSession: async () => ({ error: { message: 'bad code' } }),
      getSession: async () => ({ data: { session: null } }),
    },
  };

  await assert.rejects(
    () => completeAuthCallback(client, 'https://tatianos7.github.io/POTOK/auth/callback?code=bad'),
    /bad code/,
  );
});

test('email auth uses magic link redirect instead of visible email code flow', () => {
  assert.match(loginSource, /emailRedirectTo: getAuthCallbackRedirectUrl\(\)/);
  assert.match(authContextSource, /emailRedirectTo: getAuthCallbackRedirectUrl\(\)/);
  assert.match(loginSource, /Ссылка для входа отправлена на email/);
  assert.match(loginSource, /Проверьте письмо и откройте ссылку для входа/);
  assert.match(loginSource, /Получить ссылку/);
  assert.doesNotMatch(loginSource, /Код из письма/);
  assert.match(registerSource, /Получить ссылку/);
});
