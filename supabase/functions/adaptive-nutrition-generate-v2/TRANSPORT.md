# Request/status HTTP adapter

The deployed entrypoint is not enabled or deployed by this change. Its only
capability is a user JWT client calling public request/status RPCs. Authorization
is forwarded unchanged; the database derives account identity from auth.uid().
The adapter does not decode identity, generate keys or retry internally.

POST accepts the exact existing protocolVersion/idempotencyKey DTO. GET accepts
exactly one requestOperationId query field. OPTIONS returns unauthenticated CORS
preflight without constructing a client. Wildcard CORS supports bearer clients;
cookies and Access-Control-Allow-Credentials are not enabled. CORS is not auth.

POST returns 202 with the existing status DTO, including on replay; GET returns
200. An ambiguous transport failure returns RPC_FAILED/retryable=true. Retry POST
with the original key, or GET with the known original requestOperationId.
Do not infer success, rotate keys or rebase authorities. Only exact allowlisted
RPC reason messages become typed public errors; raw errors/details are suppressed.

The request RPC may create a durable request/projection in the database when
deployed and separately authorized. “Disabled” means no generation, Graph writes,
record/activation or privileged client, not that request RPC is SELECT-only.
Tests use mocks and do not query or mutate Supabase.

## Future protected gateway transport (unproven)

The existing pure orchestration contract names three RPCs in potok_nutrition:

- load_generation_request_v2(uuid)
- record_generated_week_gateway_v2(uuid,bytea)
- activate_generated_week_gateway_v2(uuid)

Any future runtime binding must select an explicitly reviewed schema transport,
verify API exposure/schema-cache behavior and confirm the exact gateway allowlist.
Schema USAGE/EXECUTE alone does not prove PostgREST reachability. A default public
RPC client is not a proven transport for these functions. No fallback to internal
writers, direct tables or owner credentials is permitted.

This HTTP adapter has no such binding or privileged factory. It does not change
SQL, grants, exposed schemas or secrets. Generator and validator remain null;
the existing continueGenerationV2 contract is unreachable from the entrypoint.
