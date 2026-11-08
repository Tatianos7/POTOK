import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screenPilotFamilyCandidateV2 as screen } from './pilot-family-identity-review-v2';

const aggregate = JSON.parse(readFileSync(
  'docs/premium/retained-sources/pilot-staging-review-20261106/family-review-aggregate-v2.json','utf8'
));
const gate = readFileSync(
  'docs/premium/retained-sources/pilot-staging-review-20261107/unresolved-five-families-decision-gate.md','utf8'
);
const keys = [
  'SR28:01174','SR28:01287','SR28:20124',
  'FDC_SR_LEGACY:168411:PREPARED:100G','FDC_SR_LEGACY:172420:DRY_RAW:100G'
];

test('five explicitly unresolved source families remain review-only, with no implicit publishing or approval', () => {
  assert.deepEqual([...aggregate.summary.sourceGroupsRequiringPrecheck].sort(),[...keys].sort());
  assert.equal(aggregate.summary.recipes,19);
  assert.equal(aggregate.summary.foodRows,69);
  assert.equal(aggregate.summary.foodRowsWithFamilyCandidates,59);
  assert.equal(aggregate.summary.foodRowsWithoutFamilyCandidates,10);
  assert.equal(aggregate.summary.approvedBindings,0);
  assert.equal(aggregate.sourceApprovals,0);
  assert.equal(aggregate.catalogWrites,0);
  assert.equal(aggregate.canApply,false);
  assert.equal(aggregate.privateRowsCommitted,false);
  for (const key of keys) assert.ok(gate.includes('`'+key+'`'),key+' missing decision gate');
});

test('a matching variant label never selects identity or approves source applicability', () => {
  const examples = [
    ['SR28:01174','Молоко 2%', 'as-sold'],
    ['SR28:01287','Йогурт греческий натуральный 2%', 'as-sold'],
    ['SR28:20124','Макароны цельнозерновые из пшеницы','dry'],
    ['FDC_SR_LEGACY:168411:PREPARED:100G','Эдамаме очищенные','frozen'],
    ['FDC_SR_LEGACY:172420:DRY_RAW:100G','Чечевица коричневая','dry'],
  ] as const;
  for (const [sourceRecord,name,state] of examples) {
    const result = screen(sourceRecord,{name,cooking_state:state});
    assert.ok(result,sourceRecord+' should be screenable');
    assert.equal(result.disposition,'CANDIDATE_FOR_REVIEW');
    assert.equal(result.selected,false);
    assert.equal(result.sourceApplicabilityApproved,false);
    assert.ok(result.remainingAttributes.length>0);
  }
});
test('incompatible close variants and misleading cooked aliases cannot bypass the source gate', () => {
  const wrong = [
    ['SR28:01174','Молоко 3,2%','as-sold','EXCLUDED_VARIANT'],
    ['SR28:01174','Молоко','as-sold','INSUFFICIENT_VARIANT_LABEL'],
    ['SR28:01287','Йогурт греческий сладкий 2%','as-sold','EXCLUDED_VARIANT'],
    ['SR28:20124','Макароны цельнозерновые из полбы','dry','EXCLUDED_VARIANT'],
    ['FDC_SR_LEGACY:168411:PREPARED:100G','Соя сухая','dry','INSUFFICIENT_VARIANT_LABEL'],
    ['FDC_SR_LEGACY:172420:DRY_RAW:100G','Чечевица красная','dry','EXCLUDED_VARIANT'],
  ] as const;
  for (const [sourceRecord,name,state,disposition] of wrong) {
    const result = screen(sourceRecord,{name,cooking_state:state});
    assert.ok(result,sourceRecord+' expected matched family');
    assert.equal(result.disposition,disposition,name);
    assert.equal(result.selected,false);
  }
  const alias = screen('SR28:20124',{name:'Макароны цельнозерновые варёные',aliases:['Макароны цельнозерновые'],cooking_state:'raw'});
  assert.ok(alias);
  assert.equal(alias.disposition,'EXCLUDED_VARIANT');
  assert.equal(alias.stateFinding,'NAME_STATE_CONFLICT');
});
