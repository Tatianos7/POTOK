import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOrdinaryProfileWritePayload,
  decodePendingProfileWrite,
  profileService,
  ProfilePrivilegeWriteBlockedError,
  ProfileUserScopeError,
  type PendingProfileWriteV2,
} from '../profileService';

test('profile save does not queue another account payload after a session mismatch', async () => {
  const service = profileService as unknown as { getSessionUserId(userId: string): Promise<string> };
  const original = service.getSessionUserId;
  service.getSessionUserId = async () => { throw new ProfileUserScopeError(); };
  try {
    // No storage or Supabase is installed: a fallback/write attempt would fail
    // or swallow the scope error instead of rejecting with the exact error.
    await assert.rejects(profileService.saveProfile('old-account', { firstName: 'Old profile' }), ProfileUserScopeError);
  } finally {
    service.getSessionUserId = original;
  }
});

test('ordinary profile payload keeps benign changes and omits current and future privilege fields', () => {
  assert.deepEqual(buildOrdinaryProfileWritePayload({
    first_name: 'Ирина',
    age: 0,
    phone: null,
    has_premium: true,
    is_admin: true,
    premium_provenance_id: 'attestation-1',
    admin_valid_until: '2099-01-01T00:00:00Z',
    premium_future_expiry: '2099-01-01T00:00:00Z',
    unrelated_unknown: 'drop-me',
  }), {
    first_name: 'Ирина',
    age: 0,
    phone: null,
  });
});

test('legacy pending payload rewrites benign fields and quarantines privilege names without values', () => {
  const decoded = decodePendingProfileWrite('account-a', {
    id_user: 'account-a',
    first_name: 'Анна',
    goal: 'strength',
    has_premium: true,
    is_admin: false,
    premium_provenance_id: 'secret-attestation-id',
  });

  assert.deepEqual(decoded.pending, {
    version: 2,
    account_id: 'account-a',
    ordinary: { first_name: 'Анна', goal: 'strength' },
  });
  assert.deepEqual(decoded.quarantine, {
    version: 1,
    account_id: 'account-a',
    status: 'requires_trusted_authority',
    omitted_fields: ['has_premium', 'is_admin', 'premium_provenance_id'],
  });
  assert.equal(decoded.shouldRewrite, true);
  assert.doesNotMatch(JSON.stringify(decoded.quarantine), /secret-attestation-id/);
});

test('legacy queue migration is durable while its benign payload remains syncable', () => {
  const storage = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  storage.set('profile_pending_v1_account-a', JSON.stringify({
    id_user: 'account-a',
    first_name: 'Мария',
    height: 172,
    has_premium: true,
    premium_valid_until: '2099-01-01T00:00:00Z',
  }));

  try {
    const service = profileService as unknown as {
      readPendingProfile(userId: string): PendingProfileWriteV2 | null;
    };
    assert.deepEqual(service.readPendingProfile('account-a'), {
      version: 2,
      account_id: 'account-a',
      ordinary: { first_name: 'Мария', height: 172 },
    });
    assert.deepEqual(JSON.parse(storage.get('profile_pending_v1_account-a') ?? ''), {
      version: 2,
      account_id: 'account-a',
      ordinary: { first_name: 'Мария', height: 172 },
    });
    assert.deepEqual(profileService.getProfilePrivilegeQuarantine('account-a'), {
      version: 1,
      account_id: 'account-a',
      status: 'requires_trusted_authority',
      omitted_fields: ['has_premium', 'premium_valid_until'],
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('protected profile setters fail explicitly without issuing an ordinary profile write', async () => {
  await assert.rejects(
    profileService.updatePremiumStatus('account-a', true),
    ProfilePrivilegeWriteBlockedError,
  );
  await assert.rejects(
    profileService.updateAdminStatus('account-a', true),
    ProfilePrivilegeWriteBlockedError,
  );
});
