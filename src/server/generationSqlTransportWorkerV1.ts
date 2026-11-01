import {createSqlWeightedGenerationWorkerV1,type SqlWeightedGenerationWorkerDependenciesV1} from './generationSqlWeightedWorkerV1';
import {createGenerationSqlGatewayV1,createRestrictedGenerationSqlGatewayV1,type GenerationGatewaySqlClientV1} from './generationSqlGatewayV1';
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
