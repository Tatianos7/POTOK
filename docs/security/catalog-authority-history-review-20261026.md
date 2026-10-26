# Catalog authority and historical snapshots — 2026-10-26

Status: review-only candidate, no hosted apply or release authorization.
This package contains authored code, public source analysis and synthetic test
fixtures only. No hosted function definitions, ACL snapshots or user records are
published.

## Boundaries and existing architecture

The existing AdminAccessService already reads has_verified_entitlement_v1 and
fails closed on unavailable/malformed results or account changes. The reviewed
trusted-entitlement v2 design uses owner-controlled append-only attestations,
with v1 as the compatibility predicate. This package reuses that contract. It
does not install its store/writers, issue grants, migrate legacy is_admin values
or activate a generator. A separate owner-approved authority installation and
explicit administrator decisions remain necessary before legitimate live admin
access can be enabled where that predicate is unavailable.

The new has_catalog_admin_access_v1 invoker wrapper checks signed top-level role
and identity, checks the verified predicate's owner/return type and delegates to
the existing admin capability predicate. Missing, errored or NULL verification
denies access. It does not turn an arbitrary owner-created predicate into proof
of correct attestation infrastructure: that infrastructure remains a separate
review/rollout prerequisite. It uses no legacy profile flags or editable JWT
metadata and creates no parallel authority table or public issuer.

## Candidate scope

The tracked SQL always ROLLBACKs. Fixed disposable test wrappers alone replace
the final terminator with COMMIT. It requires PostgreSQL 17, postgres ownership,
RLS, no client CREATE on public and exact baseline bodies derived from tracked
public sources:
- 20260802_admin_approved_alias_apply_draft.sql;
- 20260809_owner_apply_missing_food_draft_draft.sql;
- food_ingestion_schema.sql.

It replaces only the two admin RPCs' exact legacy profile authorization guard;
the remainder of each function body is checked for byte equality to the expected
substitution. OIDs, signatures, return DTOs, defaults and domain validation remain.
Client EXECUTE is authenticated-only; anon/service cannot impersonate an admin.
Both retained definer bodies receive an empty pinned search_path; all their
relation and normalization references are explicitly schema-qualified.

Six named administrative RLS policies move to the verified predicate. Ordinary
own-search analytics policies are preserved. Restrictive foods/aliases policies
prevent a client-owned personal row from being published as shared core/brand
data and keep a personal alias private even when its target is a shared food.
Visible alias targets must themselves be visible through foods RLS. These policies
add no new permissive catalog-wide write privilege or foreign-personal-data read
privilege. Existing broader/lower-level permissive policies remain bounded by
these restrictions. Direct client audit INSERT/UPDATE/DELETE/TRUNCATE and column
writes are revoked; reviewed definer RPC audit logging still works.

The old recompute_food_entries_for_food_ids signature is retained with an
always-denying invoker body and revoked client/service EXECUTE. Replacing its body
also stops owner/definer delegation, which an ACL-only revoke cannot do. Its
legacy user_id vs id_user bug is not silently repaired to re-enable it.

The actual foodIngestionService stops invoking that legacy endpoint, using the
same isolated change previously reviewed in Draft #186. Catalog nutrition-version
updates and recommendation invalidation remain. Other #186 program-day changes
are not included here. A VM test runs the actual transpiled service against
mocked I/O, verifies no history RPC/write, and preserves version/invalidation
behavior. Existing deployed clients must be coordinated with server rollout;
old history RPC calls will now fail rather than rewrite snapshots.

## Acceptance and its limits

Twelve embedded PostgreSQL 17.5 cases pass. Native PostgreSQL 17 repeats them:
legacy profile authorization/history rewrite reproduction; legacy flag denial;
verified admin with false old flag successfully applying the complete public
alias and missing-food RPC bodies; duplicate apply behavior; NULL fiber; unchanged
full diary rows, favorites and ingredient pointers; same-JWT revocation and
metadata manipulation; missing/failed verification; personal/shared source and
alias visibility; ordinary analytics; audit forgery denial; client/service/owner
and definer-delegated history denial; source/policy drift rollback; review-wrapper
rollback; and the id_user-only profile schema compatibility case.

The schema is synthetic. Complete public review/alias/draft SQL is replayed;
foods/alias/history base table shapes are fixture definitions, and normalization
is an ASCII lower/trim substitute, not production language-search acceptance.
An additional legacy user_id column exists only in one fixture variant to
exercise a working historical rewrite; the id_user-only variant is separately
tested. Broad legacy grants/own policies are deliberately constructed threat
models, not copies of hosted permissions.

Positive authority cases execute the unchanged three v2 reader functions from
the tracked trusted-entitlement design against an operator-seeded synthetic
attestation table. They do not install/test the full issuer, constraints,
retention/privacy lifecycle, concurrent provisioning or verified payment code.
No authority record is installed by the candidate itself.

The real CLI 2.122.0 Auth/Mailpit/PostgREST job reruns photo acceptance, obtains
two additional OTP sessions and checks actual public admin RPC bodies, direct
catalog publication, historical rewrite, candidate denial/positive admin apply,
private personal foods/aliases, source-promotion rejection, audit forgery denial,
same-token revocation and unchanged diary rows for both accounts. Fresh SQL
connections verify final state. OTPs/tokens/status logs stay private; HTTP accepts
only loopback origins and rejects redirects. CI results must be verified before
claiming native/API acceptance.

## Remaining stage/release gates

- Complete verified-authority installation/provenance/retention approval and
  current administrator decisions; never infer authority from old flags.
- Review pre-existing personal/shared source classifications and aliases. This
  candidate does not reclassify, delete, attest or backfill historical data.
- Review other direct/indirect/dynamic writers and fresh hosted drift; lexical
  source searches and these bounded fixtures cannot prove universal absence.
- The retired bulk endpoint is not a global ban on intentional own diary edits,
  privileged direct SQL or future writers. Full Nutrition Integrity V1 remains
  separately governed by Issue #170; immutable consumption history and PLAN !=
  FACT must persist.
- Combine exact profile/TRUNCATE/anonymous-RPC/pg_trgm/photo/Premium/catalog
  candidates on a restored complete schema. This isolated schema is not parity.
- Resolve Staging divergence, refresh backup/recovery evidence for the actual
  apply time, establish post-apply monitoring and obtain exact Production approval.

Agreed order remains security completion, celebration, then plan generation.
