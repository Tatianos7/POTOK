/** No hosted URL/credentials. Reuses the real V1 trust fixture in its own Unix-only PostgreSQL17 cluster. */
process.env.POTOK_EXACT_FOOD_ACCEPTANCE = '1';
await import('./food-evidence-disposable-db-v1.test');
export {};
