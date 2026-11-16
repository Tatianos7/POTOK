# Staging empty-catalog check, 2026-11-16

Applied `generation_missing_catalog_response_v2` to Supabase Staging under the approved scope. Readback confirmed the error marker, owner `postgres`, SECURITY DEFINER, pinned `pg_catalog` search path, authenticated EXECUTE and no anonymous EXECUTE. The catalog has no active head.

The hosted browser run is pending. The current week has zero compatible pending selections, including zero with effective Premium. The generation RPC requires that selection before it reaches the catalog check. The isolated screen has not been deployed. Prepare one normal authenticated Staging test account with current goal and effective Premium, then provision its pending selection using the existing `adaptive_nutrition_provision_current_week_v1` entry point. Bind the screen to that account on the dedicated Vercel Staging project. Compare generation request and plan counts for the account before and after the empty-catalog check.

No test selection or generated plan was created during patch installation. Production was not changed.
