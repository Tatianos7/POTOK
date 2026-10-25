# Profile column write containment: review candidate

Ownership RLS restricts which user's profile a client can edit, but table-wide INSERT/UPDATE still permits that user to supply is_admin or has_premium. Client-side omission is useful compatibility work, not server enforcement. This candidate replaces client table/column INSERT/UPDATE with an explicit 13-column ordinary-field allowlist. It blocks direct client writes to the two privilege flags and timestamp columns created_at/updated_at.

The candidate lives outside automatic migrations. It is not a trusted entitlement/admin authority implementation and is not approved for hosted apply by this document. No profile values are reset, validated or migrated. Existing legacy flags, privileged triggers/functions and backend writers can still require authority review.

## Allowlist and current caller compatibility

Ordinary fields: id_user, first_name, last_name, middle_name, birth_date, age, height, goal, email, phone, avatar_url, coach_settings, voice_settings. authenticated receives INSERT and UPDATE only for these columns. anon/PUBLIC receive neither write privilege. All existing per-column client INSERT/UPDATE grants are revoked before the explicit allowlist is granted, because removing table privileges alone does not remove independent column grants.

The inspected profileService already strips protected fields, quarantines legacy pending privilege writes, rejects old privilege setters, and writes ordinary fields via upsert. PostgREST-style ON CONFLICT can update id_user even when assigning it its existing value, so the candidate preserves id_user UPDATE. It requires the exact bounded ownership RLS shape (authenticated self SELECT/INSERT/UPDATE via auth.uid() = id_user, including UPDATE WITH CHECK) before doing so. Tests prove both same-account upsert and rejection of foreign reassignment. It never weakens RLS to make upsert pass.

Old clients explicitly sending privilege fields, even false, will be rejected. Unknown clients and server writers are not ruled out by the current-source inspection. Coach/voice JSON remain user preferences, not trusted authorization inputs. The email/phone profile fields remain display data, not verified Auth identity.

## Preconditions and effective postconditions

Require effective postgres, a postgres-owned ordinary user_profiles table with RLS, exactly the reviewed 17 columns, a non-null UUID id_user, and non-null boolean privilege flags whose defaults are false. Policy shape drift, extra columns, disabled RLS or changed defaults abort for review. Existing authenticated SELECT and every ordinary INSERT/UPDATE privilege must already be present; restricted baselines abort rather than receiving newly broadened access. No new or altered policies, role memberships, triggers or routine bodies are installed.

After revocation/grant, check effective permissions (including inherited roles): protected writes denied, ordinary writes permitted, anonymous writes denied, service-role column access preserved, and authenticated SELECT unchanged. A policy hash must also remain identical. Unresolved inherited rights or required role access loss abort the whole transaction. lock_timeout is 5 seconds and statement_timeout is 30 seconds. Use stop-on-error; disconnect/ROLLBACK on failure.

This does not revoke DELETE/TRUNCATE or change future defaults; those are separate concerns. Retain private pre-apply table and column ACLs with grantors/options for an exact reviewed reversal. Never publish private ACLs or user records, and never use a blanket GRANT ALL as rollback.

## Rehearsal and automated verification

`scripts/security/profile-writes/rehearsal.sql` performs the same transaction checks, prints PROFILE_WRITE_REHEARSAL_OK and the four protected-column permissions, then always ROLLBACKs. It does not execute profile writes or any privileged RPC body. Use it only on the restored Docker database as postgres with ON_ERROR_STOP=1, followed by the existing row-count verification. This proves ACL rehearsal, not persistent protection or real API compatibility.

The dedicated CI workflow uses native PostgreSQL 17. Fourteen scenarios cover baseline self-promotion, denied protected INSERT/UPDATE (including explicit false), ordinary INSERT/UPDATE and PostgREST-shaped upsert, default false flags, avatar/coach/voice writes, RLS foreign-user denial and key reassignment, preserved service authority/data, anon denial, replay, exact rehearsal rollback, inherited protected grants, unsafe defaults, schema/policy/RLS drift, required service access loss, restricted client baselines and wrong actor.

The runner uses synthetic user IDs and an auth.uid fixture driven by a session setting; it does not validate real JWTs or prove hosted PostgREST behavior. It destroys public and creates auth fixture objects/roles, accepts only a loopback database named potok_profile_test, and must never be pointed at a restored user database. Optional PostgreSQL 17 PGlite can run the same suite.

Before hosted apply, validate registration/profile creation, same-account upsert, offline pending sync, avatar/settings updates and A-to-B account isolation through the actual authenticated application/API. Do not use real accounts to test privilege escalation. Stage deployment of compatible clients first, coordinate concurrent DDL/grants, and obtain explicit approval for the exact hosted candidate.

## Remaining release boundaries

Historical is_admin/has_premium values are not verified evidence. Trusted grant/revoke, provenance, expiry, revocation, server predicates and a reviewed owner/admin bootstrap remain separate work. Every SECURITY DEFINER path using those legacy fields and every trigger/backend writer must be audited. Purchase receipt/provider verification, mutable entitlement/billing tables and authenticated cross-account RPC authorization are not fixed here. service_role remains privileged and must never be exposed to clients. Do not claim full Premium/admin safety from this patch alone.

Primary references: [PostgreSQL 17 column privileges](https://www.postgresql.org/docs/17/sql-grant.html), [INSERT/ON CONFLICT permissions](https://www.postgresql.org/docs/17/sql-insert.html), [row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## Disposable HTTP/JWT integration gate

The `Profile HTTP regressions` workflow starts native PostgreSQL 17 and pinned PostgREST v12.2.3 with a non-superuser, NOINHERIT authenticator. It commits this exact candidate in a fresh synthetic database, then makes real HTTP requests signed by a per-run disposable HS256 key. The fixture auth.uid reads PostgREST request.jwt.claims. No hosted credentials, restored user records, Supabase project links or production endpoints are used.

It checks profile creation with false authority defaults, actual HTTP merge-duplicates upsert including id_user, avatar URL and coach/voice preference persistence, protected INSERT/UPDATE denial (including explicit false), A/B row isolation, foreign insertion and ownership reassignment denial, anonymous writes, invalid/expired JWT rejection and final unchanged authority flags. The database driver accepts only 127.0.0.1 and the exact disposable database name; setup refuses an existing profile table or auth schema. The API endpoint is fixed to loopback port 55439. The fixture is destructive only in its newly created disposable database; never run it on the restored backup.

This closes the SQL-only coverage gap for the tested PostgREST version, not the application acceptance gate. It does not exercise Supabase Auth/OTP/session refresh, the hosted PostgREST version/configuration, Storage uploads (avatar_url is only text here), offline queue synchronization or the browser application. Those remain required on an isolated application environment, together with combined-candidate and unknown-caller checks before hosted apply.
