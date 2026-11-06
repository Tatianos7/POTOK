/** No DB URL: uses parent suite's own Unix-only disposable PostgreSQL17+ cluster. */
process.env.POTOK_NONFOOD_ACCEPTANCE = '1';
await import('./food-evidence-disposable-db-v1.test');
export {};
