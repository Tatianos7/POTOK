import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {buildAuthoringReferenceReviewDraftsV1} from './authoring-reference-review-drafts-v1';
import {readPinnedProposalSourcesV1,type ProposalSourcesRawV1} from './authoring-reference-proposals-v1';
import {buildThreeFoodOwnerInputStateReviewV1,readDeclaredApplicabilityReviewRawV1,readWalnutOwnerInputStateRawV1} from './three-food-applicability-review-v1';
import {readPrimaryRecheckRawV1,type PrimaryRecheckRawV1} from './three-food-source-candidates-v1';

type Obj=Record<string,unknown>;
function invalid():never{throw Error('INVALID_CONSOLIDATED_AUTHORING_CANDIDATE');}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
  if(typeof v==='number'){if(!Number.isFinite(v))invalid();return JSON.stringify(v);}
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const r=obj(v);return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
}
export interface ConsolidationEvidenceRawV1 {
  sources:ProposalSourcesRawV1;primary:PrimaryRecheckRawV1;declaredReviewRaw:string;ownerStateRaw:string;
  materialsRaw:Record<string,string>;ingredientOwnerRulesRaw:string;
}
export function readConsolidationEvidenceRawV1():ConsolidationEvidenceRawV1{
  const materialsRaw:Record<string,string>={},root=new URL('../../docs/premium/retained-sources/',import.meta.url);
  function visit(url:URL,prefix:string){for(const e of readdirSync(url,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(e.isDirectory())visit(new URL(e.name+'/',url),prefix+e.name+'/');
    else if(e.isFile()&&/\.(json|txt)$/.test(e.name))materialsRaw['docs/premium/retained-sources/'+prefix+e.name]=readFileSync(new URL(e.name,url),'utf8');
  }}
  visit(root,'');
  return {sources:readPinnedProposalSourcesV1(),primary:readPrimaryRecheckRawV1(),declaredReviewRaw:readDeclaredApplicabilityReviewRawV1(),
    ownerStateRaw:readWalnutOwnerInputStateRawV1(),materialsRaw,
    ingredientOwnerRulesRaw:readFileSync(new URL('../../docs/premium/ingredient-state-owner-decisions-20261104.md',import.meta.url),'utf8')};
}

/** Consolidation preserves all authoring data. No partial ingredient candidate replaces recipe totals. */
export function buildConsolidatedAuthoringCandidateV1(catalogRaw:string,privateInputRaw:string,e:ConsolidationEvidenceRawV1){
  const original=parse(catalogRaw),decoded=decodeAuthoringRecipeCatalog(original),ledger=parse(e.sources.ledgerRaw);
  if(ledger.authoringCatalogSha256!==hash(catalogRaw)||ledger.runtimePublishable!==false||ledger.mayActivate!==false)invalid();
  const variants=buildAuthoringReferenceReviewDraftsV1(privateInputRaw,e.sources);
  const owner=buildThreeFoodOwnerInputStateReviewV1(privateInputRaw,catalogRaw,e.sources,e.primary,e.declaredReviewRaw,e.ownerStateRaw);
  const indexed=new Map<string,Obj>();
  for(const value of list(ledger.rows)){const row=obj(value),id=String(row.ingredientRowId),path=row.provenancePath;
    if(indexed.has(id)||typeof path!=='string'||!Object.hasOwn(e.materialsRaw,path)||hash(e.materialsRaw[path])!==row.provenanceSha256
      ||row.canonicalStatus!=='UNRESOLVED'||row.stableFoodId!==null||row.runtimePublishable!==false)invalid();indexed.set(id,row);
  }
  if(indexed.size!==obj(ledger.counts).rows)invalid();
  const byVariant=new Map(variants.recommendations.map(r=>[r.ingredientRowId,r]));
  const byOwner=new Map(owner.results.map(r=>[r.ingredientRowId,r]));
  const seen=new Set<string>(),linked=new Set<string>();
  const recipeReviews=list(original.recipes).map(value=>{
    const recipe=obj(value),id=String(recipe.recipeId),view=decoded.recipes.get(id);if(!view)invalid();
    const ingredientReviews=list(recipe.ingredients).map(value=>{
      const raw=obj(value),rowId=String(raw.ingredient_row_id),entry=indexed.get(rowId);
      if(seen.has(rowId)||raw.recipe_id!==id||!['UNRESOLVED','AMBIGUOUS'].includes(String(raw.canonical_status))||raw.food_stable_id!==null)invalid();seen.add(rowId);
      if(entry){if(entry.recipeId!==id||entry.sourceAuthoringRowSha256!==hash(canonical(raw)))invalid();linked.add(rowId);}
      const variant=byVariant.get(rowId),conditional=byOwner.get(rowId);
      return {ingredientRowId:rowId,originalRowSha256:hash(canonical(raw)),originalCanonicalStatus:raw.canonical_status,
        stableFoodId:null,sourceApproved:false,runtimePublishable:false,
        rowReviewStatus:entry?'PINNED_ROW_PREPARATION_OR_REVIEW_NOT_ADMISSION':'NOT_IN_PINNED_PILOT_ROW_INDEX',
        preparation:entry?{reviewOrigin:entry.reviewOrigin,basis:entry.preparationBasis,openFinding:entry.openFinding,
          provenancePath:entry.provenancePath,provenanceSha256:entry.provenanceSha256}:null,
        sourceVariantReview:variant??null,conditionalSourceInputReview:conditional??null,
        recordedUnit:raw.unit,recordedGramsReference:raw.weight_g,
        massBasisStatus:raw.unit==='ML'?'UNREVIEWED_VOLUME_TO_MASS':raw.unit!=='G'?'DISCRETE_OR_OTHER_UNIT_NOT_ADMITTED'
          :typeof raw.weight_g==='number'&&raw.weight_g>0?'RECORDED_REFERENCE_GRAMS_NOT_MEASUREMENT':'UNKNOWN_RECORDED_GRAMS'};
    });
    return {recipeId:id,name:view.name,referenceSearchEligible:view.numericReferenceTestInputAvailable&&view.status!=='BLOCKED',
      originalReferenceNutrition:recipe.referenceNutrition,completeAdmittedRecipeNutrition:null,sourceApproved:false,runtimePublishable:false,
      sourcePendingReview:recipe.pendingReview,referenceTestIssues:recipe.referenceTestIssues,
      runtimeBlockers:['CANONICAL_IDENTITIES_NOT_RESOLVED','COMPLETE_RECIPE_NUTRITION_NOT_ADMITTED','ALLERGEN_DIETARY_ELIGIBILITY_UNREVIEWED','REFERENCE_CARBOHYDRATE_SEMANTICS_UNVERIFIED'],
      deferredPhysicalChecks:{status:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',blocksDevelopment:false,measuredYieldG:null,confirmedServings:null},
      ingredientReviews};
  });
  if(linked.size!==indexed.size||byVariant.size!==variants.summary.rows||[...byVariant.keys()].some(k=>!linked.has(k))||[...byOwner.keys()].some(k=>!linked.has(k)))invalid();
  const materialIndex=Object.entries(e.materialsRaw).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,raw])=>({path,sha256:hash(raw),bytes:Buffer.byteLength(raw),purpose:'RETAINED_MATERIAL_NOT_ADMISSION'}));
  const content={contract:'potok-consolidated-authoring-candidate-catalog-v1',usage:'OFFLINE_SOURCE_AWARE_REFERENCE_SEARCH_ONLY',
    provenance:{originalCatalogBytesSha256:hash(catalogRaw),originalCatalogObjectSha256:hash(canonical(original)),ledgerSha256:hash(e.sources.ledgerRaw),
      variantReviewSha256:hash(JSON.stringify(variants)),ownerStateReviewSha256:hash(JSON.stringify(owner)),
      ingredientOwnerRulesSha256:hash(e.ingredientOwnerRulesRaw),hashesAreNotAuthority:true},
    originalAuthoringCatalog:original,sourceMaterialIndex:materialIndex,
    ingredientOwnerRules:{path:'docs/premium/ingredient-state-owner-decisions-20261104.md',scope:'RECIPE_SPECIFIC_NO_GLOBAL_SUBSTITUTION',unknownStatesRemainUnknown:true},
    summary:{recipes:recipeReviews.length,ingredientRows:seen.size,referenceSearchEligibleRecipes:recipeReviews.filter(r=>r.referenceSearchEligible).length,
      excludedReferenceRecipes:recipeReviews.filter(r=>!r.referenceSearchEligible).length,pinnedReviewedRows:linked.size,
      rowsOutsidePinnedPilotIndex:seen.size-linked.size,sourceVariantRows:byVariant.size,completeConditionalSourceInputRows:byOwner.size,
      retainedSourceMaterials:materialIndex.length,admittedRecipes:0,sourceApprovals:0,appliedChanges:0},
    recipeReviews,sourceApproved:false,runtimePublishable:false,mayActivate:false,canApply:false,recipeTotalsRecomputed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
  return {...content,integritySha256:hash(canonical(content))};
}
type Candidate=ReturnType<typeof buildConsolidatedAuthoringCandidateV1>;
function assertOfflineOnly(v:unknown){
  if(!v||typeof v!=='object')return;
  if(Array.isArray(v)){v.forEach(assertOfflineOnly);return;}
  for(const [key,value] of Object.entries(v)){
    if(['sourceApproved','runtimePublishable','mayActivate','canApply','foodSpecificMappingApproved'].includes(key)&&value!==false)invalid();
    if(['selectedOption','ownerDecision'].includes(key)&&value!==null)invalid();
    assertOfflineOnly(value);
  }
}

/** Only this adapter enters the existing local authoring search; never the trusted generator. */
export function previewConsolidatedAuthoringWeekV1(candidateRaw:string,scenarioRaw:string){
  const parsed=parse(candidateRaw),{integritySha256,...content}=parsed;
  if(parsed.contract!=='potok-consolidated-authoring-candidate-catalog-v1'||parsed.usage!=='OFFLINE_SOURCE_AWARE_REFERENCE_SEARCH_ONLY'
    ||[parsed.sourceApproved,parsed.runtimePublishable,parsed.mayActivate,parsed.canApply].some(v=>v!==false)
    ||integritySha256!==hash(canonical(content))||obj(parsed.provenance).originalCatalogObjectSha256!==hash(canonical(parsed.originalAuthoringCatalog)))invalid();
  const c=parsed as unknown as Candidate,decoded=decodeAuthoringRecipeCatalog(c.originalAuthoringCatalog);
  assertOfflineOnly(c);
  const reviews=new Map(c.recipeReviews.map(r=>[r.recipeId,r]));
  if(c.summary.admittedRecipes!==0||c.summary.sourceApprovals!==0||c.summary.appliedChanges!==0
    ||reviews.size!==decoded.recipes.size||c.recipeReviews.some(r=>!decoded.recipes.has(r.recipeId)||r.completeAdmittedRecipeNutrition!==null||r.sourceApproved!==false||r.runtimePublishable!==false))invalid();
  const preview=previewRecipeAuthoringWeekV1(authoringSearchInput(decoded),parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1);
  const selectedIds=[...new Set(preview.days.flatMap(d=>d.meals.map(m=>m.recipeId)))].sort();
  const selected=selectedIds.map(id=>{const r=reviews.get(id);if(!r)invalid();return r;});
  const selectedRows=selected.flatMap(r=>r.ingredientReviews);
  return {contract:'potok-consolidated-authoring-week-run-v1',status:preview.status,
    usage:'OFFLINE_UNVERIFIED_REFERENCE_WEEK_WITH_SOURCE_REVIEW_CONTEXT',candidateCatalogIntegritySha256:integritySha256,
    searchNutritionBasis:'UNCHANGED_SOURCE_DECLARED_PER_SERVING_REFERENCE_ONLY',partialIngredientCandidatesAppliedToRecipeTotals:false,
    authoringPreview:preview,selectedRecipeReviews:selected,
    selectedCoverage:{distinctRecipes:selected.length,uniqueIngredientRows:selectedRows.length,
      pinnedReviewedRows:selectedRows.filter(r=>r.preparation!==null).length,
      outsidePinnedPilotIndex:selectedRows.filter(r=>r.preparation===null).length,
      conditionalSourceInputRows:selectedRows.filter(r=>r.conditionalSourceInputReview!==null).length},
    sourceApproved:false,runtimePublishable:false,mayActivate:false,canApply:false,recipeTotalsRecomputed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let result:unknown;
  if(process.argv[2]==='build'&&process.argv.length===5)result=buildConsolidatedAuthoringCandidateV1(readFileSync(process.argv[3],'utf8'),readFileSync(process.argv[4],'utf8'),readConsolidationEvidenceRawV1());
  else if(process.argv[2]==='preview'&&process.argv.length===5)result=previewConsolidatedAuthoringWeekV1(readFileSync(process.argv[3],'utf8'),readFileSync(process.argv[4],'utf8'));
  else throw Error('Usage: ... build ORIGINAL_CATALOG.json PRIVATE_INPUT.json | preview CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
