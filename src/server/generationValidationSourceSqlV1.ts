import type { GenerationValidationSourceStoreV1 } from './generationValidationAuthorityLoaderV1';

export const generationValidationSourceReadSqlV1 =
  'SELECT potok_nutrition.read_generation_validation_source_v1($1::uuid, pg_catalog.decode($2::text,\'hex\')) AS source_raw';
export const admittedGenerationValidationSourceReadSqlV1 =
  'SELECT potok_nutrition.read_admitted_generation_validation_source_v1($1::uuid, pg_catalog.decode($2::text,\'hex\')) AS source_raw';

/** Trusted backend driver; no connection, credentials, HTTP RPC or runtime binding. */
export interface GenerationValidationSourceSqlClientV1 {
  query(sql: string, parameters: readonly string[]): Promise<{ rows: Array<{ source_raw: string | null }> }>;
}

function sourceStore(client: GenerationValidationSourceSqlClientV1, statement: string): GenerationValidationSourceStoreV1 {
  return Object.freeze({
    async readSnapshotRaw(requestOperationId: string, proposalRawSha256: string): Promise<string | null> {
      if (typeof requestOperationId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestOperationId)
        || typeof proposalRawSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(proposalRawSha256)) {
        throw new Error('INVALID_GENERATION_SOURCE_LOOKUP');
      }
      const result = await client.query(statement, [requestOperationId, proposalRawSha256]);
      if (!result || !Array.isArray(result.rows) || result.rows.length !== 1
        || !result.rows[0] || Object.keys(result.rows[0]).length !== 1
        || !Object.prototype.hasOwnProperty.call(result.rows[0], 'source_raw')
        || (result.rows[0].source_raw !== null && typeof result.rows[0].source_raw !== 'string')) {
        throw new Error('INVALID_GENERATION_SOURCE_SQL_RESULT');
      }
      return result.rows[0].source_raw;
    },
  });
}

/** Owner-context storage fixture reader from #247; not an admitted runtime path. */
export function createSqlGenerationValidationSourceStoreV1(client: GenerationValidationSourceSqlClientV1): GenerationValidationSourceStoreV1 {
  return sourceStore(client, generationValidationSourceReadSqlV1);
}

/** Explicit admitted query only: never falls back to the unadmitted source reader. */
export function createAdmittedSqlGenerationValidationSourceStoreV1(client: GenerationValidationSourceSqlClientV1): GenerationValidationSourceStoreV1 {
  return sourceStore(client, admittedGenerationValidationSourceReadSqlV1);
}
