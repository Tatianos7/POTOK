import {createSqlWeightedGenerationWorkerV1,type SqlWeightedGenerationWorkerDependenciesV1} from './generationSqlWeightedWorkerV1';
import {createGenerationSqlGatewayV1,createRestrictedGenerationSqlGatewayV1,type GenerationGatewaySqlClientV1} from './generationSqlGatewayV1';
import {createGenerationTransactionClientV1,type GenerationTransactionPoolV1} from './generationTransactionClientV1';
export interface SqlTransportGenerationWorkerDependenciesV1 extends Omit<SqlWeightedGenerationWorkerDependenciesV1,'gateway'> {
  readonly gatewaySql:GenerationGatewaySqlClientV1;
}
/** Inactive composition using separately supplied admitted source/gateway sessions.
 * This is driver wiring, not login/TLS admission, role provisioning or deployment.
 */
export function createSqlTransportGenerationWorkerV1(dependencies:SqlTransportGenerationWorkerDependenciesV1){
  const {gatewaySql,...generation}=dependencies;
  return createSqlWeightedGenerationWorkerV1({...generation,gateway:createGenerationSqlGatewayV1(gatewaySql,generation.enabled)});
}

/** Explicit restricted-login candidate; does not provision a login, secret or connection. */
export function createRestrictedSqlTransportGenerationWorkerV1(dependencies:SqlTransportGenerationWorkerDependenciesV1){
  const {gatewaySql,...generation}=dependencies;
  return createSqlWeightedGenerationWorkerV1({...generation,gateway:createRestrictedGenerationSqlGatewayV1(gatewaySql,generation.enabled)});
}

export interface PooledRestrictedGenerationWorkerDependenciesV1 extends Omit<SqlTransportGenerationWorkerDependenciesV1,'gatewaySql'|'sourcesSql'> {
  readonly sourcesPool:GenerationTransactionPoolV1<{source_raw:string|null}>;
  readonly gatewayPool:GenerationTransactionPoolV1<{result_raw:unknown}>;
}
/** Optional inactive pool lifecycle composition. Pools must already be separately
 * admitted as the narrow source/gateway identities over verified TLS. This opens
 * no connection until an enabled worker queries and provisions no credential.
 */
export function createPooledRestrictedGenerationWorkerV1(dependencies:PooledRestrictedGenerationWorkerDependenciesV1){
  const {sourcesPool,gatewayPool,...generation}=dependencies;
  if(Object.is(sourcesPool,gatewayPool))throw Error('GENERATION_SQL_POOLS_MUST_BE_SEPARATE');
  return createRestrictedSqlTransportGenerationWorkerV1({...generation,
    sourcesSql:createGenerationTransactionClientV1(sourcesPool,generation.enabled),
    gatewaySql:createGenerationTransactionClientV1(gatewayPool,generation.enabled)});
}

