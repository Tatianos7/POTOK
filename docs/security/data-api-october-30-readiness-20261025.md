# Data API opt-in readiness — 2026-10-25

Status: PARTIAL; review package, no hosted writes and no release approval.

## Reason for the work

Supabase discussion #45329 schedules the change for existing projects on
2026-10-30. New `public` tables need explicit grants; existing tables keep their
grants. RLS and table privileges are independent. Existing-object security defects
are separate from this compatibility change.

Sources checked 2026-10-25:
- https://github.com/orgs/supabase/discussions/45329
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/changelog.md

The docs also warn that the auto-exposure toggle does not remove all non-API
table/sequence privileges or PostgreSQL's global PUBLIC function EXECUTE default.
It is therefore not a substitute for the TRUNCATE/RPC containment candidates.

## Source review on master 555d3263ce20e70ae59576e9dd3e2d2c4a97240e

Inspected all 18 files in `supabase/migrations`. Six top-level CREATE TABLE
statements occur in four files:

| New table | Explicit authenticated table grants in that source | Finding |
|---|---|---|
| measurement_photo_assets | None | Replayed failure without defaults; candidate covers owner CRUD |
| measurement_photo_deletions | None | Replayed failure without defaults; repeated upsert also lacks UPDATE policy |
| recipe_ingredients | SELECT, INSERT, UPDATE, DELETE | Explicit grants present; not fully replayed by this package |
| exercise_definitions | SELECT | Explicit grants present; not fully replayed by this package |
| exercise_definition_media | SELECT | Explicit grants present; not fully replayed by this package |
| user_exercise_media | SELECT, INSERT, DELETE | Explicit grants present; not fully replayed by this package |

This is a bounded source inventory, not a proof of full migration-chain replay,
all SQL drafts, dynamic DDL, views, functions, sequences, service-role jobs or
hosted parity. Historical migrations are unchanged. Do not replay them on a live
database. Repository `supabase/*.sql` bootstrap paths and pending Premium drafts
still need classification by their actual intended deployment/caller paths.

## Reproduced defect and candidate

`measurementsService.ts` upserts/selects/deletes `measurement_photo_assets` and
upserts/selects/deletes `measurement_photo_deletions`. PostgREST upsert updates
the supplied key fields and timestamp on conflict. The deletion migration has
SELECT/INSERT/DELETE owner policies but no UPDATE policy. Granting UPDATE alone
does not repair repeated upsert.

`supabase/migration_drafts/measurement_photo_explicit_grants_review_v1.sql`:
- requires postgres ownership, RLS, UUID non-null owner columns and expected
  owner-policy semantics/command coverage before changing anything;
- grants authenticated CRUD on assets;
- grants authenticated SELECT/INSERT/DELETE and UPDATE(user_id,day,deleted_at)
  on deletion markers, with an owner UPDATE policy including WITH CHECK;
- adds no anon/service-role grants, no sequence grants (these tables use UUIDs),
  and makes no default-privilege, Auth, Storage, profile, finance or RPC changes;
- always ends in ROLLBACK. It is not a deployable migration.

It preserves pre-existing grants, so it does not claim to clean broad legacy
TRUNCATE/anon/service-role access in restored or hosted environments. Separate
containment candidates remain required. Storage tables in the test are minimal
stubs for replaying the historical Storage policy DDL, not a Storage API test.

## Verification

Seven executable cases replay both historical migration sources, reproduce the
missing-grant and missing-update-policy failures, then check owner CRUD/upsert,
foreign read/write/reassignment denial, anon/service-role denial without default
grants, column-update restriction, TRUNCATE denial, rollback, repeated application
and policy-drift rejection. The candidate actor is non-superuser postgres.

Local embedded PostgreSQL 17.5 passed all seven. The embedded engine omits only
the historical CREATE EXTENSION pgcrypto line because packaging is unavailable;
gen_random_uuid is core PostgreSQL. Native PostgreSQL 17 CI replays the complete
original files, including extension DDL. Its synthetic auth.uid/JWT substitute
does not prove real Auth/PostgREST upsert behavior. Real HTTP acceptance is an
outstanding gate for the SQL-only package; those tests issue the matching
INSERT ON CONFLICT UPDATE in SQL.

Run locally only against a disposable engine/database; the test drops its fixture
schemas. It accepts an embedded engine or named loopback database
`potok_data_api_test`, never a hosted connection string. Native CI uses a separate
test_admin bootstrap role and creates a non-superuser postgres owner before any
candidate application. It never demotes the PostgreSQL bootstrap superuser.

## Real Auth/PostgREST follow-up

`local-prepare.mjs` and `http.mjs` add a separate disposable Supabase CLI 2.122.0
CI job. It starts only the required local Auth, Mailpit and REST services on a
loopback-bound Docker network. There is no project link, hosted URL, remote DB
argument or Supabase access token. CLI status and startup logs stay private.

The database helper replays both complete historical migrations as non-superuser
postgres, removes automatic table/sequence grants for future postgres-created
objects and asserts actual absence of table AND column API privileges. The HTTP
test obtains two independent sessions via real Auth OTP emails captured locally.
It reproduces missing table grants and the missing UPDATE policy using actual
PostgREST requests. The temporary grants used for the latter reproduction are
revoked before the exact review candidate is committed in this fresh fixture.

Acceptance then checks photo upsert (including conflict update), repeated
deletion-marker upsert with persisted timestamp, own reads/deletes, foreign
reads/updates/deletes returning no rows, denied foreign inserts/reassignment,
protected id-column update denial and anonymous denial. A fresh SQL connection
checks final empty tables, two Auth users, no new anon/service grants and limited
UPDATE privileges. Tokens/OTPs stay in memory and no Auth response bodies are
logged. HTTP requests reject redirects and all non-local origins.

This is direct API acceptance, not the actual measurementsService UI, a Storage
binary upload test, all four previous candidates together, a full restored-schema
test or hosted acceptance. CI result must be checked before claiming this gate
passed. Native PostgreSQL SQL acceptance remains a separate job.

## Remaining completion gates and agreed order

1. Classify active bootstrap/deployment paths and pending Premium SQL; complete
   per-role grants and sequence/view/function review without blanket permissions.
2. Add real local Auth/PostgREST acceptance for measurement upsert/read/delete
   with automatic grants absent and the exact reviewed candidate applied.
3. Finish caller/authority audit (entitlement/paywall, billing mutation paths,
   admin food operations, historical food recomputation). Prior green synthetic
   tests and anonymous denial do not prove authenticated authorization.
4. Integrate exact candidate set and application changes on restored full schema;
   resolve or explicitly accept Staging parity gaps before release. Staging stays
   read-only until a specific write is authorized.
5. Recheck hosted drift, establish apply/recovery instructions and post-apply
   acceptance, then obtain separate exact Production approval.
6. Close the agreed security stage, celebrate, then resume plan generation.
   Trusted generator/Edge remain inactive; PLAN != FACT and Graph v1 persist.

Owner-reported backup progress: restored 112 tables/14888 rows; 63 Storage files
checked; joint four-candidate rehearsal and rollback passed; encrypted archive
uploaded to private cloud and downloaded copy SHA256 checked OK. This is not a
full provider-configuration backup or proof of a hosted production restore.
