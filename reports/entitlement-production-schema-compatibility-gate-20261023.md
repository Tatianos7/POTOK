# Production entitlement migration compatibility gate — 2026-10-23

Status: schema-compatible / DEPLOY NO-GO pending staging acceptance and owner authorization.

## Read-only production evidence
Project dtsdnhbcwpbfrhcazqkb. No SQL writes executed.
- public.get_entitlements(uuid): jsonb, SECURITY DEFINER, owner postgres, search_path=public,pg_temp, p_user_id uuid DEFAULT NULL.
- public.get_paywall_state(text,uuid): jsonb, SECURITY DEFINER, owner postgres, same search_path.
- public.entitlements fields: id uuid NOT NULL, user_id uuid NOT NULL, tier text NOT NULL, flags jsonb NOT NULL, updated_at timestamptz NOT NULL.
- Effective get_entitlements EXECUTE currently true for anon, authenticated and service_role. This is the pre-fix exposure and is not changed by draft CI.
- Forward review SQL changes only get_entitlements function body and grants; same signature and return type.
- Safe recovery review SQL revokes all public RPC access rather than reverting to cross-account-readable legacy behavior.

## Release gates
1. Review production function body for exact semantic parity (fallback JSON, errors, paywall delegation); read-only DDL evidence above does not prove full behavioral parity.
2. Verify no unexpected dependencies/overloads and no external service-role consumers.
3. Run exact forward and safe recovery against staging under separate explicit owner approval, then signed-in own, cross-account, anon, service_role, paywall tests.
4. Re-run CI on final exact HEAD and verify inventory checkout matches HEAD.
5. Record migration transaction, expected grant matrix, smoke tests, and safe-recovery command with execution evidence.
6. Production deployment requires distinct explicit owner approval; do not infer approval from approval of access policy.

## Current verdict
The schema does not block the candidate migration. However production remains exposed until a separately approved rollout. Draft SQL's ROLLBACK is intentional; no deployment has happened.
