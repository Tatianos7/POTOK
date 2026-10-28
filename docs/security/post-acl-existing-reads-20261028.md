# Existing-account HTTP reads after candidate ACL repair

## Confirmed owner state

PR #229's exact 211-permission local narrowing passed temporary checks/ROLLBACK, then COMMIT and independent verification on the existing isolated candidate. Owner subsequent HTTP results: Auth health, public REST and four internal schema exclusions passed; all 20 affected anon SELECT requests returned the expected permission denial. These are actual local observations, not hosted deployment or full application acceptance. Earlier two-account A/B receipt is present. No browser receipt was found under the searched directory convention; owner-reported later work remains unreconciled, not declared unexecuted.

## Narrow existing-account probe

`post-acl-reads.mjs --run-existing-private BACKUP_DIR COMMIT_EVIDENCE_DIR` requires the existing private candidate's fixed immutable container/image, separate volume, network none and no published ports; existing API/Auth must share that namespace and match the old A/B state. It rechecks the committed plan's independent verification SQL and hashes, then obtains two synthetic identities from the existing private result. No installer, Auth reconfiguration, account creation, service-role key or signing path is provided.

A new non-root read-only Node worker shares only the candidate network namespace. It receives synthetic IDs/emails and the selected permission matrix through stdin, with no signing secret, DB credential, bind mounts or external network. It runs real OTP with create_user=false against existing Auth and captures mail solely on the existing local SMTP/template ports. Only OTP request/verify use POST; Data API requests are GET. Tokens stay in worker memory and are not emitted or persisted.

The probe checks both own profiles and both foreign-profile exclusions using real Auth tokens. It then makes 243 limit=0 table-read requests: 81 anonymously and 81 for each user. Expected responses come from the actual current effective SELECT matrix. Allowed means 200 with an empty array; denied means 401/403 with SQLSTATE 42501. A missing route, invalid token, leaked profile, unexpected rows or an unexpectedly allowed/denied table stops; grants are never widened to make tests pass. Limit=0 is table accessibility evidence, not row-level ownership proof across all tables; the concrete ownership checks here cover profiles only.

## Independent preservation proof

Read-only SQL before and after fingerprints all 112 selected current tables, including execution_reason and all public profiles. Eight explicitly named Auth tables may change only for the two existing synthetic users: users, identities, sessions, refresh_tokens, one_time_tokens, flow_state, audit_log_entries and mfa_amr_claims (session ownership). All other rows, including every public profile, must remain identical. A separate hash of the complete auth.users ID set prohibits account creation/deletion. Both expected synthetic id/email pairs must remain present. Auth catalog metadata, public/private metadata, full selected permissions, column ACLs and empty authority are independently compared. The historical 14,888 total is used only to identify the old A/B receipt, not imposed on the current copy.

Worker failure still leads to an attempted independent after-check; a live timed-out worker is stopped before that check. Evidence is retained in a new 0700 folder with 0600 private files; only bounded status/counter lines are shown. Failed/interrupted attempts are not automatically replayed and accounts/sessions are not reset or deleted. SQL in this controller is read-only. Auth login necessarily changes the bounded synthetic Auth state.

## Verification limits and next gates

Unit tests use a synthetic HTTP provider to exercise successful existing-user login/read behavior and failures. Native isolated PostgreSQL CI executes the actual preservation query with the eight Auth table shapes, permits only scoped synthetic session/token additions and rejects unrelated Auth changes. These checks do not claim a real Mac OTP pass. Only the owner's later POST_ACL_EXISTING_READS_OK result will confirm execution on the repaired copy.

This probe does not exercise profile writes, protected-write HTTP denial, diary/Storage/program actions, browser UI, generation, purchase verification or hosted release. Existing receipts remain preserved. The current security completion/release gates and owner sequence are unchanged.

Protocol references reviewed: Supabase Auth v2.197.0 OTP source (`internal/api/otp.go`), current signInWithOtp docs and the existing pinned local SMTP worker. No dependency/CLI upgrade or schema change is introduced.
