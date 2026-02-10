export function isSchemaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message ?? '').toLowerCase();
  const code = String(err.code ?? '').toUpperCase();

  // PostgREST codes and raw Postgres SQLSTATEs
  const postgrestTableMissing = code === 'PGRST205' || code === 'PGRST204';
  const pgUndefinedColumn = code === '42703';
  const pgUndefinedTable = code === '42P01';
  const pgUniqueViolation = code === '23505';

  if (postgrestTableMissing || pgUndefinedColumn || pgUndefinedTable || pgUniqueViolation) return true;

  // Message-based fallbacks
  if (msg.includes('could not find table') || msg.includes('does not exist') || msg.includes('not found')) return true;
  if (msg.includes('no unique or exclusion constraint matching') || msg.includes('no unique constraint matching')) return true;
  if (msg.includes('duplicate key value violates unique constraint') || msg.includes('unique constraint')) return true;

  return false;
}

export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message ?? '').toLowerCase();
  const code = String(err.code ?? '').toUpperCase();
  return code === 'PGRST205' || code === 'PGRST204' || code === '42P01' || msg.includes('could not find table') || msg.includes('not found');
}

export function isUniqueConstraintError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message ?? '').toLowerCase();
  const code = String(err.code ?? '').toUpperCase();
  return code === '23505' || msg.includes('no unique or exclusion constraint matching') || msg.includes('no unique constraint matching') || msg.includes('duplicate key value violates unique constraint');
}
