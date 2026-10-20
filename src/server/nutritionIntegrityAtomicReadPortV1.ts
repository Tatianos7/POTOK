/**
 * Issue #170 — fail-closed, isolated interface for a future transactional Supabase reader.
 * No DB client, credentials, table assumptions, HTTP route or diary writes in this file.
 */
import {
  resolveReviewedEvidenceSnapshotV1,
  type ReviewedEvidenceAuthorityV1,
  type ReviewedEvidenceSnapshotV1,
} from './nutritionIntegrityReviewedEvidenceAdapterV1';
import type { ServerFoodEvidenceV1 } from './nutritionIntegrityServerResolverV1';

export type AtomicReviewedEvidenceReadV1 =
  | { kind: 'UNAVAILABLE' }
  | {
      kind: 'COMPLETE';
      /** The privileged DB layer must prove this is a single consistent read with no pagination gaps. */
      snapshot: ReviewedEvidenceSnapshotV1;
      /** Independently trusted review authority, including issuance and historical role checks. */
      authority: ReviewedEvidenceAuthorityV1;
    };

/**
 * An implementation must run privileged, read-only database logic that returns the entire
 * evidence chain AND authorization within a single consistent snapshot. Never implement
 * this using parallel, paginated browser/PostgREST requests.
 */
export interface AtomicReviewedEvidenceStoreV1 {
  readComplete(foodId: string): Promise<AtomicReviewedEvidenceReadV1>;
}

const unresolved = (foodId: string): ServerFoodEvidenceV1 => ({ kind: 'UNRESOLVED', foodId });

/**
 * Safe boundary until tables, trusted issuance and the atomic store are approved.
 * An UNAVAILABLE result, missing chain, wrong identity or storage failure never confirms.
 *
 * NOT a DB write gate. A later diary write must recheck currentness in its own transaction.
 */
export async function readVerifiedNutritionEvidenceV1(
  foodId: string,
  store: AtomicReviewedEvidenceStoreV1
): Promise<ServerFoodEvidenceV1> {
  if (typeof foodId !== 'string' || !foodId.trim()) return unresolved('');
  try {
    const read = await store.readComplete(foodId);
    if (!read || read.kind !== 'COMPLETE' || !read.snapshot || !read.authority ||
      read.snapshot.requestedFoodId !== foodId ||
      typeof read.authority.isAuthorizedEvent !== 'function') return unresolved(foodId);
    const result = await resolveReviewedEvidenceSnapshotV1(read.snapshot, read.authority);
    return result.kind === 'REVIEWED' && result.foodId === foodId ? result : unresolved(foodId);
  } catch {
    return unresolved(foodId);
  }
}
