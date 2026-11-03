import process from 'node:process';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {generationSqlWeightedWorkerFixtureV1} from '../../../src/server/__tests__/generationSqlWeightedWorkerFixturesV1';
import {createManagedGenerationRuntimeV1, createPortableStagingGenerationRuntimeV1, createStagingGenerationRuntimeV1, type GenerationRuntimePoolsV1} from '../../../src/server/generationRuntimeV1';
import {restrictedGenerationLoadSqlV1, restrictedGenerationRecordSqlV1, restrictedGenerationActivateSqlV1} from '../../../src/server/generationSqlGatewayV1';

const isDeno = 'Deno' in globalThis;
// Deno 2.1's compatibility stub returns zeroes with a warning, not a CPU measurement.
function cpu() {if (isDeno) return null; try {return process.cpuUsage();} catch {return null;}}
function rss() {try {const value = process.memoryUsage().rss;return value > 0 ? value : null;} catch {return null;}}
function peakRss() {if (isDeno) return null; try {return process.resourceUsage().maxRSS;} catch {return null;}}
type Fixture = Awaited<ReturnType<typeof generationSqlWeightedWorkerFixtureV1>>;
function pools(x: Fixture): GenerationRuntimePoolsV1 {
  const {sourcesSql, gateway} = x.deps;
  return {
    sourcesPool: {async acquire() {return {async query(sql, parameters) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {rows: []};
      return sourcesSql.query(sql, parameters);
    }, async release() {}};}},
    gatewayPool: {async acquire() {return {async query(sql, parameters) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {rows: []};
      const names = new Map([[restrictedGenerationLoadSqlV1, 'load_generation_request_v2'],
        [restrictedGenerationRecordSqlV1, 'record_generated_week_gateway_v2'], [restrictedGenerationActivateSqlV1, 'activate_generated_week_gateway_v2']]);
      const name = names.get(sql); assert.ok(name);
      const result = await gateway.rpc(name, {p_request_operation_id: parameters[0],
        ...(name === 'record_generated_week_gateway_v2' ? {p_generated_week_plan_canonical: '\\x' + parameters[1]} : {})});
      return {rows: [{result_raw: result.data}]};
    }, async release() {}};}}, async close() {},
  };
}
/** Synthetic full-worker protocol, never a hosted load test or source publisher. */
export async function profileGenerationWorkerV1(samples = 3, options: {caseName?: 'small' | 'robust' | 'strict'; probes?: boolean} = {}) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 5) throw Error('PROFILE_SAMPLES_OUT_OF_BOUNDS');
  if (options.caseName !== undefined && !['small', 'robust', 'strict'].includes(options.caseName)) throw Error('PROFILE_CASE_INVALID');
  const measurements = [];
  let disabledPgFactoryProbe: 'PASS' | 'FAIL' = 'FAIL';
  let disabledPgFactoryProbeStage = 'PUBLIC_CA';
  let x509CheckIssued: 'PASS' | 'UNAVAILABLE_OR_FAILED' = 'UNAVAILABLE_OR_FAILED';
  let portablePgFactoryProbe: 'PASS' | 'FAIL' = 'FAIL';
  for (const [name, slots, known] of [['small', 1, false], ['robust', 4, false], ['strict', 4, true]] as const) {
    if (options.caseName !== undefined && name !== options.caseName) continue;
    for (let sample = 0; sample < samples; sample++) {
      // Setup and fixture signing are excluded. Synthetic adapter work during continue is included.
      const x = await generationSqlWeightedWorkerFixtureV1(known, slots);
      const {sourcesSql, gateway, ...config} = x.deps; void sourcesSql; void gateway;
      if (measurements.length === 0 && options.probes !== false) {
        let probeCa: string | undefined;
        // Only public test trust material and synthetic passwords; never acquire a connection.
        try {
          const ca = rootCertificates.find(pem => {const r = new X509Certificate(pem);
            return r.ca && Date.now() >= Date.parse(r.validFrom) && Date.now() < Date.parse(r.validTo);});
          assert.ok(ca);
          probeCa = ca;
          try {const root = new X509Certificate(ca); if (root.checkIssued(root)) x509CheckIssued = 'PASS';} catch {/* Recorded capability failure, never skipped inside the real factory. */}
          disabledPgFactoryProbeStage = 'FACTORY_CONSTRUCTION';
          const {enabled, ...disabled} = config; void enabled;
          const probe = await createStagingGenerationRuntimeV1({...disabled, secrets: {ca, readerPassword: 'synthetic-reader', gatewayPassword: 'synthetic-gateway'}});
          try {disabledPgFactoryProbeStage = 'DEFAULT_GATE'; await assert.rejects(probe.continue(x.request), /GENERATION_RUNTIME_DISABLED/);}
          finally {disabledPgFactoryProbeStage = 'CLOSE'; await probe.close();}
          disabledPgFactoryProbe = 'PASS'; disabledPgFactoryProbeStage = 'COMPLETE';
        } catch {disabledPgFactoryProbe = 'FAIL';}
        if (probeCa) {
          try {
            const {enabled, ...disabled} = config; void enabled;
            const probe = await createPortableStagingGenerationRuntimeV1({...disabled,
              secrets: {ca: probeCa, readerPassword: 'synthetic-reader', gatewayPassword: 'synthetic-gateway'}});
            try {await assert.rejects(probe.continue(x.request), /GENERATION_RUNTIME_DISABLED/);}
            finally {await probe.close();}
            portablePgFactoryProbe = 'PASS';
          } catch {portablePgFactoryProbe = 'FAIL';}
        }
      }
      const startCpu = cpu(), startRss = rss(), start = performance.now();
      const runtime = await createManagedGenerationRuntimeV1({...config,
        comparison: known ? 'STRICT' : 'ROBUST_CONVENIENCE_BOUNDS', openPools: () => pools(x)});
      try {
        assert.equal((await runtime.continue(x.request)).status, 'ACTIVE');
        assert.ok(x.state.stored);
        const raw = Buffer.from(x.state.stored, 'hex').toString('utf8'), plan = JSON.parse(raw);
        assert.equal(plan.graph.days.length, 7);
        assert.equal(plan.graph.days.reduce((n: number, d: {slots: unknown[]}) => n + d.slots.length, 0), 7 * slots);
        assert.deepEqual(plan.facts, []); assert.equal(x.state.records, 1); assert.equal(x.state.activations, 1);
        assert.equal(x.state.finalReads, 2);
        const wallMs = performance.now() - start, endCpu = cpu();
        measurements.push({slotsPerDay: slots, comparison: known ? 'STRICT' : 'ROBUST_CONVENIENCE_BOUNDS', sample,
          wallMs, cpuMs: startCpu && endCpu ? (endCpu.user + endCpu.system - startCpu.user - startCpu.system) / 1000 : null,
          rssBeforeBytes: startRss, rssAfterBytes: rss(), processPeakRssKiB: peakRss(),
          sourceReads: x.queryLog.length, gatewayCalls: x.rpcLog.length, planBytes: Buffer.byteLength(raw),
          meals: 7 * slots, records: x.state.records, activations: x.state.activations, authorityReads: x.state.finalReads, facts: 0});
      } finally {await runtime.close();}
    }
  }
  const deno = (globalThis as typeof globalThis & {Deno?: {version: {deno: string}}}).Deno;
  return {contract: 'potok-generation-worker-local-profile-v1', runtime: deno ? `Deno ${deno.version.deno}` : `Node ${process.versions.node}`,
    input: 'SYNTHETIC_SQL_AUTH_CATALOG_FIXTURE', factoryProbesRun: options.probes !== false,
    disabledPgFactoryProbe: options.probes === false ? 'NOT_RUN' : disabledPgFactoryProbe,
    disabledPgFactoryProbeStage: options.probes === false ? 'NOT_RUN' : disabledPgFactoryProbeStage,
    portablePgFactoryProbe: options.probes === false ? 'NOT_RUN' : portablePgFactoryProbe,
    x509CheckIssued: options.probes === false ? 'NOT_RUN' : x509CheckIssued, hostedAcceptance: false, cloudLimitsEnforced: false,
    cpuIncludesSyntheticAdapters: true, memoryScope: 'PROCESS_NOT_REQUEST_OR_EDGE_ISOLATE',
    measuredScope: 'RUNTIME_ASSEMBLY_SELECTION_VALIDATION_RECORD_ACTIVATION_PROTOCOL_AND_OUTPUT_ASSERTIONS',
    excluded: ['FIXTURE_SETUP', 'REAL_DATABASE_IO_AND_COMMIT', 'TLS_AND_ROLE_ADMISSION', 'SUPABASE_AUTH', 'HTTP_UI', 'WORST_CASE_CATALOG', 'CLOUD_CPU_ACCOUNTING'],
    measurements};
}
