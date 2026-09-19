import type { PremiumCatalogResult } from '../services/premiumCatalogService';

export type RecipeCatalogReadStatus = 'idle' | 'loading' | 'catalog' | 'empty' | 'unavailable';

/** An unavailable/empty catalog must never be replaced with demo content. */
export async function readPremiumRecipeCatalog<T>(
  read: () => Promise<PremiumCatalogResult<T>>,
  empty: T,
): Promise<{ status: RecipeCatalogReadStatus; data: T }> {
  try {
    const result = await read();
    if (!result.ok) return { status: 'unavailable', data: empty };
    const missing = result.data === null || (Array.isArray(result.data) && result.data.length === 0);
    return { status: missing ? 'empty' : 'catalog', data: result.data };
  } catch {
    return { status: 'unavailable', data: empty };
  }
}
