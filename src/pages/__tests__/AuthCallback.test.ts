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

test('email auth uses OTP code UI while keeping redirect fallback configured', () => {
  assert.match(loginSource, /emailRedirectTo: getAuthCallbackRedirectUrl\(\)/);
  assert.match(authContextSource, /emailRedirectTo: getAuthCallbackRedirectUrl\(\)/);
  assert.match(loginSource, /Мы отправили код на email\. Введите код из письма\./);
  assert.match(loginSource, /id="otpCodeEmail"/);
  assert.match(loginSource, /label="Код из письма"/);
  assert.match(loginSource, /onClick=\{handleVerifyEmailCode\}/);
  assert.match(loginSource, /email: normalizedEmail,\s+token: emailCode,\s+type: 'email'/);
  assert.match(loginSource, /Получить код повторно через/);
  assert.doesNotMatch(loginSource, /откройте ссылку для входа/);
  assert.match(registerSource, /Мы отправили код на email\. Введите код из письма\./);
  assert.match(registerSource, /\? 'Код из письма' : 'Код из SMS'/);
  assert.match(registerSource, /Получить код/);
});

test('email OTP resend rate limit keeps code entry available', () => {
  assert.match(loginSource, /EMAIL_OTP_AWAITING_KEY/);
  assert.match(loginSource, /persistEmailOtpAwaiting\(normalizedEmail\);/);
  assert.match(loginSource, /isEmailOtpAwaiting\(normalizedEmail\) \|\| emailResendIn > 0/);
  assert.match(loginSource, /setEmailIsCodeStep\(true\);/);
  assert.match(loginSource, /Если код уже пришёл, введите его ниже\. Повторно запросить код можно через/);
  assert.match(loginSource, /Подождите немного и запросите код повторно\./);
  assert.match(loginSource, /disabled=\{emailIsVerifying \|\| !isEmailCodeValid\}/);
  assert.match(loginSource, /disabled=\{emailResendIn > 0 \|\| emailIsSending\}/);
  assert.match(loginSource, /Код неверный или истёк\. Запросите новый код\./);
});
