/** Disposable adapter only; no runtime wiring. Driver must confirm FULL rollback and
 * preserve native error fields. Not a PostgREST RPC retry policy: its internal
 * engine retries are outside this attempt budget; RPC client retry is disabled. An ambiguous COMMIT is never a retryable failure. */
export interface CatalogFailureV1 { code?: string; detail?: string; routine?: string; rollbackConfirmed: boolean }
export function retryableCatalogFailureV1(error: CatalogFailureV1): boolean {
  if (!error.rollbackConfirmed || ['PT409','PT500'].includes(error.code ?? '')
    || ['POTOK_BUSINESS_CONFLICT_V1','POTOK_INVARIANT_FAILURE_V1'].includes(error.detail ?? '')) return false;
  return error.code === '40P01' && error.routine === 'DeadLockReport'
    || error.code === '40001' && ['CheckForSerializableConflictOut','CheckForSerializableConflictIn',
      'PreCommit_CheckForSerializationFailure','ExecUpdate','ExecDelete'].includes(error.routine ?? '');
}
export type CatalogAttemptV1<T> = { ok: true; value: T } | { ok: false; error: CatalogFailureV1 };
export async function retryCatalogTransactionV1<T>(
  attempt: (remainingMs: number) => Promise<CatalogAttemptV1<T>>,
  options: { now?: () => number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {},
): Promise<T> {
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const deadline = now() + 15_000;
  for (let n=0;n<4;n++) {
    const remaining = deadline-now();
    if (remaining<=0) throw new Error('CATALOG_RETRY_DEADLINE');
    // Adapter MUST bound transaction/connection time by remainingMs, including COMMIT.
    const result = await attempt(remaining);
    if (result.ok) return result.value;
    if (!retryableCatalogFailureV1(result.error) || n===3) throw result.error;
    const delay = Math.floor(random()*[50,150,450][n]);
    if (now()+delay>=deadline) throw new Error('CATALOG_RETRY_DEADLINE');
    await sleep(delay);
  }
  throw new Error('CATALOG_RETRY_EXHAUSTED');
}
