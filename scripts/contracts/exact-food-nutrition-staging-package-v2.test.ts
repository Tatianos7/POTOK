import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildExactFoodNutritionStagingPackageV2 as build,readExactIssuerSourceV2,exactStagingProjectV2,exactIssuerSourceSha256V2 } from './exact-food-nutrition-staging-package-v2';
const input = { projectId:exactStagingProjectV2,catalogFingerprint:'a'.repeat(64) };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
test('installation source is the pinned accepted issuer and no caller SQL can be injected', () => {
  assert.equal(sha(readExactIssuerSourceV2()),exactIssuerSourceSha256V2);
  for (const i of [{ ...input,projectId:'production' },{ ...input,catalogFingerprint:"'; SELECT 1; --" },{ ...input,catalogFingerprint:'' }]) assert.throws(()=>build(i));
  assert.throws(()=>build(input,readExactIssuerSourceV2()+'\n'));
});
test('issuer implementation remains byte-identical; only install guard and schema-cache notification differ', () => {
  const source = readExactIssuerSourceV2(), body = source.slice(source.indexOf('END $guard$;')+'END $guard$;'.length).replace(/COMMIT;\s*$/,'');
  const generated = build(input).sql;
  assert.equal(generated.slice(generated.indexOf('END $guard$;')+'END $guard$;'.length).replace(/NOTIFY pgrst, 'reload schema';\nCOMMIT;\s*$/,''),body);
});
test('bounded scope leaves catalog data, authority and generator activation outside the installation', () => {
  const p = build(input);
  assert.equal(p.canApply,false); assert.equal(p.ownerApprovalRequired,true); assert.equal(p.generatorActivated,false);
  assert.deepEqual(p.scope,{ privateTables:5,privateHelpers:7,authenticatedAdminRpcs:3,immutableTableTriggers:4,
    deferredAuthorityTrigger:1,existingV1VersionBarrierTrigger:1,catalogRowWrites:0,sourceApprovals:0,recipePublications:0 });
  assert.doesNotMatch(p.sql,/OWN_DISPOSABLE_CLUSTER_REQUIRED|data_directory|CREATE ROLE|ALTER ROLE|UPDATE public\.foods|INSERT INTO public\.foods/);
});
test('checked-in review artifact is exactly reproducible from its Staging fingerprint', () => {
  const manifest = JSON.parse(readFileSync('docs/premium/retained-sources/pilot-staging-review-20261106/install-package-v2.json','utf8'));
  const sql = readFileSync(manifest.sqlPath,'utf8'), p = build({ projectId:manifest.projectId,catalogFingerprint:manifest.catalogFingerprint });
  assert.equal(sql,p.sql); assert.equal(sha(sql),manifest.sqlSha256); assert.equal(manifest.sourceSha256,exactIssuerSourceSha256V2);
});
