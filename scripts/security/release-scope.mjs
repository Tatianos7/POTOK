// Reproducible source-only review. No Docker, network, credentials or SQL execution.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {inputs} from './accumulated/inputs.mjs';
import {followupInputs} from './accumulated/restored-twelve.mjs';
const base = '555d3263ce20e70ae59576e9dd3e2d2c4a97240e';
const candidate = '4e4bbe0bb05a8fb1fb6f47d4affd0b039a7a68ca';
const output = new URL('../../docs/security/release-scope-20261027.json', import.meta.url);
const git = (...args) => execFileSync('git', args, {maxBuffer: 8 * 1024 * 1024});
const text = (...args) => git(...args).toString('utf8').trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(text('merge-base', base, candidate), base);
for (const file of ['scripts/security/accumulated/inputs.mjs', 'scripts/security/accumulated/restored-twelve.mjs']) {
  assert.equal(hash(await readFile(new URL('../../' + file, import.meta.url))), hash(git('show', candidate + ':' + file)), 'Reviewed input registry changed');
}
const deploy = git('show', candidate + ':.github/workflows/deploy.yml').toString('utf8');
assert(deploy.includes("node-version: '18'"));
assert(git('show', candidate + ':.github/workflows/potok-pr-checks.yml').toString('utf8').includes("node-version: '20'"));
assert(git('show', candidate + ':.github/workflows/combined-eight-app.yml').toString('utf8').includes("node-version: '22'"));
for (const branch of ['main', 'master', 'feature/initial-setup', 'feature/workout-diary']) assert(deploy.includes('      - ' + branch + '\n'));
const paths = text('diff', '--name-only', base, candidate).split('\n');
const appPaths = paths.filter(p => p.startsWith('src/'));
assert.deepEqual(appPaths, ['src/pages/MyProgram.tsx', 'src/services/entitlementService.ts',
  'src/services/foodIngestionService.ts', 'src/services/programDeliveryService.ts', 'src/services/programGenerationService.ts']);
const unchanged = ['src/pages/Login.tsx', 'src/pages/Profile.tsx', 'src/context/AuthContext.tsx',
  'src/services/profileService.ts', 'src/services/adminAccessService.ts'];
const application = appPaths.map(path => ({path, beforeBlob: text('rev-parse', base + ':' + path),
  afterBlob: text('rev-parse', candidate + ':' + path), sha256: hash(git('show', candidate + ':' + path))}));
const existingCore = unchanged.map(path => {
  const before = text('rev-parse', base + ':' + path), after = text('rev-parse', candidate + ':' + path);
  assert.equal(before, after); return {path, blob: after, unchangedFromBase: true};
});
const sql = [...inputs.map(i => ({...i, group: 'original-eight'})),
  ...followupInputs.map(i => ({...i, terminator: 'ROLLBACK', group: 'follow-up-four'}))]
  .map((i, index) => ({order: index + 1, key: i.key, ref: i.ref, path: i.path, sha256: i.sha256,
    sourceTerminator: i.terminator, group: i.group, deploymentEligible: false}));
assert.equal(sql.length, 12); assert.equal(new Set(sql.map(i => i.key)).size, 12);
for (const i of sql) assert.match(i.sha256, /^[a-f0-9]{64}$/);
const report = {
  schema: 'potok-release-source-review-v1', date: '2026-10-27', base, candidate,
  candidateTree: text('rev-parse', candidate + '^{tree}'), baseIsAncestor: true,
  changedFiles: paths.length, applicationChangedFiles: application.length,
  reviewAndInfrastructureChangedFiles: paths.length - application.length,
  deploymentWorkflowChanged: paths.includes('.github/workflows/deploy.yml'),
  newMigrationFiles: paths.filter(p => p.startsWith('supabase/migrations/')),
  deploymentBranchTriggers: ['main', 'master', 'feature/initial-setup', 'feature/workout-diary'],
  buildNodeVersions: {pagesDeployment: '18', rootValidation: '20', combinedBrowserValidation: '22', packagedBrowser: '24.22.1'},
  application, existingCore, sql,
  sourceOnly: true, deploymentAuthorized: false, releaseReady: false,
  blockers: [
    {key: 'program-client-schema-transition', evidence: 'source-confirmed',
      detail: 'New delivery writes execution_reason; new quarantine SQL adds it and denies old plan_payload writes. A coordinated program-write transition or separately reviewed bridge is required.'},
    {key: 'forward-migration-and-recovery', evidence: 'source-confirmed',
      detail: 'Inputs are pinned review/rehearsal wrappers; no approved hosted forward migration or safe recovery batch is present in this reviewed scope.'},
    {key: 'deployment-build-environment', evidence: 'source-confirmed-coverage-gap',
      detail: 'Pages build selects Node18 while root validation uses Node20. Successful root/browser CI does not prove that exact deployment environment; pushing master triggers publication.'},
    {key: 'private-terminal-and-later-acceptance', evidence: 'unavailable-in-this-chat',
      detail: 'Owner reports terminal work finished and later tests run; missing synchronized evidence must be reconciled, not rerun or counted as failure.'},
    {key: 'target-drift-and-current-backup', evidence: 'requires-current-target-evidence',
      detail: 'Source ancestry and CI do not establish current hosted schema, exposed schemas, managed extension behavior or fresh recovery readiness.'},
    {key: 'exact-hosted-batch-approval', evidence: 'not-granted-for-this-review',
      detail: 'This task authorizes source review/preparation; no hosted apply or release activation is performed.'},
  ],
};
const rendered = JSON.stringify(report, null, 2) + '\n';
assert(['--write', '--verify'].includes(process.argv[2]));
if (process.argv[2] === '--write') {await writeFile(output, rendered); console.log('RELEASE_SCOPE_WRITTEN: source review only');}
else {assert.equal(await readFile(output, 'utf8'), rendered); console.log(`RELEASE_SCOPE_OK: ${paths.length} changed files; ${application.length} application files; ${sql.length} pinned SQL inputs; hosted release not authorized`);}
