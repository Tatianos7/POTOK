import test from 'node:test';

test('diary create integration requires dedicated Supabase test environment', {
  skip: !process.env.RUN_SUPABASE_DIARY_INTEGRATION,
}, async () => {
  // Intentionally left as a guarded scaffold.
  // This repo currently does not ship a dedicated backend test harness or
  // isolated Supabase test database credentials by default.
  //
  // Expected integration coverage when env is available:
  // - unique (user_id, idempotency_key) replay behavior
  // - mismatch reject without row mutation
  // - persisted snapshot equals server-side food calculation
  // - invisible private food rejection through real RLS/data visibility
});
