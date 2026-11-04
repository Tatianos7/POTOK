import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {readPinnedProposalSourcesV1,type ProposalSourcesRawV1} from './authoring-reference-proposals-v1';
import {buildThreeFoodSourceCandidatesV1,readPrimaryRecheckRawV1,type PrimaryRecheckRawV1} from './three-food-source-candidates-v1';

type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
const cases=['FROZEN_STRAWBERRY','WALNUT','BLUEBERRY'];
function invalid():never{throw Error('INVALID_THREE_FOOD_APPLICABILITY_REVIEW');}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>1000)invalid();return v;}
function parse(raw:string){if(Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const r=obj(v);return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
}
function minor(v:unknown){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/.test(v))invalid();
  const [n,f='']=v.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));}
function fixed8(n:bigint){return(n/100000000n)+'.'+String(n%100000000n).padStart(8,'0');}

/** Narrow, versioned authoring-note grammar; reproduces text, not nutrient truth or semantics. */
export function reproduceThreeFoodReferenceTextV1(notes:unknown){
  if(typeof notes!=='string')invalid();
  const d='((?:0|[1-9][0-9]{0,5})(?:\\.[0-9]{1,3})?)';
  const ru=new RegExp('на 100 г: '+d+' ккал; Б '+d+' г; Ж '+d+' г; У '+d+' г; клетчатка '+d+' г\\.','g');
  const en=new RegExp('per 100 g: '+d+' kcal; P '+d+' g; F '+d+' g; C '+d+' g; fiber '+d+' g\\.','g');
  const found=[...notes.matchAll(ru),...notes.matchAll(en)];if(found.length!==1)invalid();
  const values=found[0].slice(1);if(values.length!==5)invalid();for(const v of values)minor(v);
  return {calories:values[0],protein:values[1],fat:values[2],totalCarbohydrate:values[3],fiber:values[4]};
}

export function readDeclaredApplicabilityReviewRawV1(){return readFileSync(new URL('../../docs/premium/retained-sources/three-food-applicability-20261104/declared-review-v1.json',import.meta.url),'utf8');}

/** Fixed manually reviewed annotations are usable only for their exact row AND recipe-context bytes. */
export function buildThreeFoodApplicabilityReviewV1(inputRaw:string,catalogRaw:string,sources:ProposalSourcesRawV1,primaryRaw:PrimaryRecheckRawV1,reviewRaw:string){
  const prior=buildThreeFoodSourceCandidatesV1(inputRaw,sources,primaryRaw),input=parse(inputRaw),catalog=parse(catalogRaw),review=parse(reviewRaw);
  if(review.contract!=='potok-three-food-declared-applicability-review-v1'||review.reviewKind!=='PINNED_OFFLINE_DECLARED_DATA_REVIEW_NOT_AUTHORITY_EVENT'
    ||review.privateCatalogSha256!==hash(catalogRaw)||review.privatePilotPacketSha256!==prior.provenance.privatePilotPacketSha256
    ||review.primaryRecheckSha256!==prior.provenance.primaryRecheckSha256
    ||[review.sourceApproved,review.runtimePublishable,review.canApply,review.mayActivate].some(v=>v!==false))invalid();
  const annotations=new Map<string,Obj>();
  for(const value of list(review.records)){const r=obj(value),id=String(r.caseId);
    if(!cases.includes(id)||annotations.has(id))invalid();
    const expected=id==='WALNUT'?'UNKNOWN_PROCESSING_AND_EDIBLE_FORM':'DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN';
    if(r.declaredAlignment!==expected||list(r.openConditions).some(v=>typeof v!=='string')||list(r.openConditions).length===0)invalid();
    annotations.set(id,r);
  }
  if(annotations.size!==3)invalid();
  const recipes=list(catalog.recipes).map(obj),inputRows=list(input.rows).map(obj);
  const results=prior.candidates.map(c=>{
    const a=annotations.get(c.caseId);if(!a||a.ingredientRowId!==c.ingredientRowId||a.recipeId!==c.recipeId||a.sourceAuthoringRowSha256!==c.sourceAuthoringRowSha256)invalid();
    const recipeMatches=recipes.filter(r=>r.recipeId===c.recipeId);if(recipeMatches.length!==1)invalid();const recipe=recipeMatches[0];
    if(hash(canonical({sourceRecipe:recipe.sourceRecipe,steps:recipe.steps}))!==a.recipeContextSha256)invalid();
    const ingredients=list(recipe.ingredients).map(obj).filter(r=>r.ingredient_row_id===c.ingredientRowId);
    const original=inputRows.map(r=>obj(r.rawAuthoringRow)).filter(r=>r.ingredient_row_id===c.ingredientRowId);
    if(ingredients.length!==1||original.length!==1||hash(canonical(ingredients[0]))!==c.sourceAuthoringRowSha256
      ||hash(canonical(original[0]))!==c.sourceAuthoringRowSha256)invalid();
    const parsed=reproduceThreeFoodReferenceTextV1(original[0].notes);
    for(const axis of ['calories','protein','fat','totalCarbohydrate','fiber'] as const)if(minor(parsed[axis])!==minor(c.beforeReference[axis]))invalid();
    const matched=a.declaredAlignment==='DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN';
    const grams=c.quantity.recordedGramsReference;
    const massKnown=c.quantity.recordedUnit==='G'&&typeof grams==='number'&&Number.isFinite(grams)&&grams>0;
    const eligible=matched&&massKnown;
    const contribution=eligible?Object.fromEntries(axes.map(axis=>[axis,fixed8(minor(c.completeMappedCandidatePer100GEdible[axis])*minor(String(grams)))])):null;
    return {caseId:c.caseId,ingredientRowId:c.ingredientRowId,recipeId:c.recipeId,sourceAuthoringRowSha256:c.sourceAuthoringRowSha256,
      recipeContextSha256:a.recipeContextSha256,declaredAlignment:a.declaredAlignment,
      openConditions:a.openConditions,transcription:{status:'REPRODUCED_FROM_BOUND_AUTHORING_TEXT_NOT_NUTRIENT_APPROVAL',matchedFields:5,sourceTextSha256:hash(String(original[0].notes)),sourceSemanticsAdmitted:false},
      completeSourceCandidatePer100GEdible:c.completeMappedCandidatePer100GEdible,
      recordedUnit:c.quantity.recordedUnit,recordedGramsReference:grams,
      inputContribution:{status:eligible?'CONDITIONAL_RECORDED_INPUT_ARITHMETIC':matched?'BLOCKED_INPUT_MASS_BASIS':'BLOCKED_UNSPECIFIED_PROCESSING_EDIBLE_FORM',values:contribution,
        scope:'ONE_AUTHORING_INPUT_NOT_FINISHED_RECIPE_OR_APPROVED_NUTRIENTS',measuredMass:false,cookingRetentionAssumed:false},
      beforeAvailableCarbohydrateG:null,carbohydrateDelta:null,existingBlockStatus:c.existingBlockStatus,
      selectedOption:null,ownerDecision:null,sourceApproved:false,foodSpecificMappingApproved:false,canApply:false,runtimePublishable:false};
  });
  return {contract:'potok-three-food-declared-applicability-result-v1',status:'DECLARED_DATA_REVIEW_NOT_ADMISSION',
    provenance:{...prior.provenance,priorCandidatesSha256:hash(JSON.stringify(prior)),declaredReviewSha256:hash(reviewRaw),privateCatalogSha256:hash(catalogRaw),hashesAreNotAuthority:true},
    summary:{reviewedRows:results.length,transcriptionFieldsReproduced:results.reduce((n,r)=>n+r.transcription.matchedFields,0),
      declaredAlignments:results.filter(r=>r.declaredAlignment==='DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN').length,
      openProcessingRows:results.filter(r=>r.declaredAlignment==='UNKNOWN_PROCESSING_AND_EDIBLE_FORM').length,
      conditionalInputContributions:results.filter(r=>r.inputContribution.values!==null).length,sourceApprovals:0,appliedChanges:0},
    results,recipeImpacts:prior.recipeImpacts,sourceApproved:false,canApply:false,runtimePublishable:false,mayActivate:false,
    recipeTotalsRecomputed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: node --import tsx scripts/contracts/three-food-applicability-review-v1.ts PRIVATE_INPUT.json ORIGINAL_PRIVATE_CATALOG.json');
  process.stdout.write(JSON.stringify(buildThreeFoodApplicabilityReviewV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8'),readPinnedProposalSourcesV1(),readPrimaryRecheckRawV1(),readDeclaredApplicabilityReviewRawV1()),null,2)+'\n');
}
