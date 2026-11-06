/** Tests the proposed Staging installation inside the same OWN Unix-only test cluster, never hosted. */
process.env.POTOK_EXACT_FOOD_ACCEPTANCE='1';
process.env.POTOK_EXACT_FOOD_STAGING_ACCEPTANCE='1';
await import('./food-evidence-disposable-db-v1.test');
export {};
