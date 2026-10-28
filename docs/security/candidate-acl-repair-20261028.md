# Existing private candidate: exact ACL narrowing

Status: source implementation, not an executed Mac repair or release approval.

## Owner evidence

The strict baseline rehearsal passed all twelve pinned candidates after 213 temporary revokes, followed by content/metadata/ACL rollback. The existing private candidate subsequently showed 211 of those original extras still allowed, all direct postgres grants; two were already denied by the installed candidates. The owner confirmed no overlap with explicit client column grants or the seven required photo-table grants. This limits earlier acceptance on the more permissive copy; it does not invalidate owner-reported later work whose receipts are unavailable.

The existing candidate remains `potok_security_candidate_2026-10-26`, separate volume of the same name, immutable image `sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44`, network none, no published ports, cron off, listen 127.0.0.1. API/Auth share its network namespace. Owner observed 11 Auth users, 12 profiles and zero authority records. Preserve these records as found; do not reset, restore, reinstall or recreate accounts.

## Offline planner and execution boundary

`candidate-rights.mjs` has no database, Docker, network or subprocess capability. `--prepare-private BACKUP_DIR` validates all three original SQL hashes and writes a new owner-only capture query. A separately captured, fresh local snapshot feeds `--plan-candidate-local EVIDENCE_DIR CANDIDATE_JSON`. The planner rechecks the original 213 differences and remaining 211, current scope, owner/role context and all 1,944 public effective table permissions.

Read-only captures return hashes/counts, not user records, OTPs or credentials. All 112 current selected tables are fingerprinted, including execution_reason and synthetic accounts; the old total 14,888 is not imposed on this candidate. All current fingerprints must remain unchanged. Explicit client column grants and required photo grants cannot overlap the revoke set. Raw column ACLs, schema/function/policy/default/role/constraint/index metadata, all other selected table permissions, empty authority and twelve candidate SQL contracts are checked around the change.

Table REVOKE can remove corresponding column permissions. This planner therefore stops on overlap rather than automatically regranting anything. No GRANT, data repair, schema migration or candidate reinstall is generated.

The new private folder contains hashed, separate files:

- `rollback.sql`: exact 211 revokes, checks, ROLLBACK, baseline checks. Both CANDIDATE_ACL_TEMPORARY_OK and CANDIDATE_ACL_ROLLBACK_OK are required.
- `commit.sql`: same guarded local transaction, COMMIT, checks. CANDIDATE_ACL_COMMIT_RETURNED alone is not independent verification.
- `verify.sql`: a new read-only connection must return CANDIDATE_ACL_COMMITTED_VERIFIED_OK.
- `reconcile.sql`: read-only original/desired matrix and content/metadata comparisons after an interrupted or uncertain commit. Never replay commit or restore broad grants automatically.

Before execution, the caller must verify the fixed local Docker endpoint, actual candidate container/image/volume/network/no ports and SQL manifest hashes. JSON context checks alone cannot identify a physical endpoint. Use psql file execution, ON_ERROR_STOP, private logs and separate connections; do not send the whole script as one Management API or SQL Editor packet. Keep private tests idle while capture/repair/verification run; concurrent Auth/content changes fail closed. Evidence freshness is fifteen minutes. Expired/drifted evidence requires fresh read-only capture and review, not bypassing guards. The restored baseline and hosted databases are outside this operation.

## Verification and remaining scope

Unit tests cover exact counts, overlapping grants, provenance/context/freshness/scope failures, content fingerprints and private file preservation. An isolated PostgreSQL CI job exercises the real twelve SQL sources, temporary rollback, a late pre-COMMIT failure, local COMMIT and independent verification. It uses disposable synthetic data, network none, no published ports, public source cache only and no host credentials. CI is not actual owner or application acceptance.

After an owner-confirmed local repair and independent verification, affected HTTP/API/application checks must use the existing private Auth/API and existing synthetic accounts. SQL permission assertions do not prove UI acceptance. Production/Staging writes, managed/config/recovery gates and concrete target-bound release approval remain separate. The guarded source packet is unchanged. Meal-plan generation and purchase verification #198 retain their agreed order after security completion and fireworks.
