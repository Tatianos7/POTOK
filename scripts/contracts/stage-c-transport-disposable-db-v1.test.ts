/** Separate REQUIRED transport acceptance entry. Uses ONLY own-cluster harness;
 * cannot point to Supabase, external PostgreSQL or an existing PostgREST. */
process.env.POTOK_FOOD_EVIDENCE_REQUIRE_DB='1';
process.env.POTOK_STAGE_C_REQUIRE_TRANSPORT='1';
await import('./shared-food-eligibility-disposable-db-v1.test');
export {};
