# POTOK architecture

## Application

POTOK is a TypeScript web application. The frontend owns presentation, authenticated navigation, local recovery state, and strict client DTO validation. Server authority is never inferred from local flags, email, demo state, query parameters, or local storage.

## Supabase and PostgreSQL

Supabase provides authentication and PostgreSQL persistence. RLS, narrow RPC grants, fixed `search_path`, account ownership, verified entitlement, idempotency, and immutable history form the server boundary. STAGING and production are separate operational checkpoints; SQL and policy changes require explicit owner approval.

## Adaptive Nutrition Premium

Adaptive Nutrition uses server-verified Premium entitlement. Weekly selections bind an account, local Monday week, timezone, Goal revision, plan revision, and immutable graph history. Discovery and reads fail closed on missing entitlement, ambiguity, foreign ownership, stale revisions, or invalid lineage.

Graph v1 remains supported. Graph v2 is separately versioned and adds reviewed composition snapshots and trusted generation evidence without rewriting Graph v1 semantics. The protected execution channel exposes narrow authenticated request/status RPCs and three service gateway functions while keeping internal writers inaccessible.

The trusted generator and Edge orchestration are inactive. Their local skeleton cannot activate plans without separately approved runtime bindings, reviewed canonical inputs, and server acceptance.

## Food and recipes

Curated recipes and canonical foods require stable identities, explicit revisions, evidence-backed nutrition, immutable snapshots, and publication eligibility. Authoring names or draft workbook rows are not canonical runtime records and must not be assigned invented identifiers.

## PLAN and FACT

`PLAN != FACT`. Plan provisioning, generation, annotations, diary facts, and consumption history are distinct contracts. Creating or reading a plan must not create diary rows or claim that food was consumed.

## Environments

STAGING is read-only by default and is used for separately approved migrations and rollback-only acceptance. Production database, Supabase, Edge, feature flags, and deployment changes require explicit owner approval. Codex Cloud changes are prepared on branches and reviewed through pull requests before integration.
