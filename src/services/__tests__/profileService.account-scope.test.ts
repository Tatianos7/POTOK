import assert from 'node:assert/strict';
import test from 'node:test';
import { profileService, ProfileUserScopeError } from '../profileService';

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
