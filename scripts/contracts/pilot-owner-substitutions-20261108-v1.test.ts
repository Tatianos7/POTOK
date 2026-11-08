import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPilotOwnerSubstitutions20261108V1} from './pilot-owner-substitutions-20261108-v1';
test('owner scope excludes one edamame recipe and replaces brown lentil intent without changing frozen19 evidence',()=>{
 const p=buildPilotOwnerSubstitutions20261108V1();
 assert.equal(p.originalFrozen19Immutable,true);
 assert.deepEqual(p.exclusion,['lemon_shelled_edamame']);
 assert.equal(p.ownerDecisions.milk.intendedProduct,'PLAIN_DAIRY_MILK_2_PERCENT');
 assert.equal(p.ownerDecisions.greekYogurt.intendedProduct,'PLAIN_UNSWEETENED_GREEK_YOGURT_2_PERCENT');
 assert.equal(p.ownerDecisions.greekYogurt.notUniversalRetailEquivalence,true);
 assert.equal(p.ownerDecisions.lentils.intendedProduct,'GREEN_LENTILS');
 assert.equal(p.ownerDecisions.greenBuckwheat.intendedProduct,'GREEN_BUCKWHEAT_UNROASTED');
 assert.equal(p.ownerDecisions.greenBuckwheat.distinctFromGreenLentils,true);
 assert.deepEqual(p.ownerDecisions.greenBuckwheat.ownerReferencePer100g,{
  state:'DRY_UNCOOKED',caloriesKcal:343,proteinG:13.25,fatG:3.4,carbsG:71.5,
  fiberG:10,carbsExcludeFiber:null,
  referenceStatus:'OWNER_PROVIDED_INTERNET_TABLE_UNVERIFIED'
 });
 assert.equal(p.ownerDecisions.greenBuckwheat.sourceLinkProvided,false);
 assert.equal(p.ownerDecisions.greenBuckwheat.allowCanonicalWrite,false);
 assert.equal(p.ownerDecisions.greenBuckwheat.allowRecipeRecalculation,false);
 assert.deepEqual(p.ownerDecisions.lentils.ownerReferencePer100g,{
  state:'DRY_UNCOOKED',caloriesKcal:340,proteinG:26,fatG:2,carbsG:55,
  fiberG:null,carbsExcludeFiber:null,referenceStatus:'OWNER_PROVIDED_NOT_SOURCE_VERIFIED'
 });
 assert.equal(p.ownerDecisions.lentils.requiresIndependentNutritionSource,true);
 assert.equal(p.ownerDecisions.lentils.allowRecipeRecalculation,false);
 assert.deepEqual([...p.recipesRequiringNewDefinitionReview].sort(),['brown_lentils_rice_carrot','whole_wheat_pasta_lentils_tomato'].sort());
 assert.equal(p.productDatabaseWrites,0);
 assert.equal(p.recipeDatabaseWrites,0);
 assert.equal(p.noAutomaticCanonicalFoodSelection,true);
 assert.equal(p.sourceApproved,false);
 assert.equal(p.nutritionApproved,false);
 assert.equal(p.runtimePublishable,false);
 assert.equal(p.canApply,false);
 assert.equal(p.mayActivate,false);
});