/**
 * Private local input verifier. The retained frozen19 catalog pins every
 * recipe digest; seven row digests also survive. This checker recomputes all
 * ten original row digests without printing recipe contents or writing to DB.
 * It does NOT prove nutrition source applicability or authorize publication.
 */
import { assertRawJsonWithoutDuplicateKeysV1 } from '../../src/utils/adaptiveNutritionWireV1';
import { pilotCanonicalV1, pilotDigestV1 } from './pilot-admission-readiness-v1';
import { recoverFrozen19RetainedReferencesV1 } from './pilot-frozen19-retained-recovery-v1';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
type Obj=Record<string,unknown>;
const bad=():never=>{throw Error('PILOT_ORIGINAL_ROW_RECHECK_FAILED');};
const obj=(v:unknown):Obj=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Obj:bad();
const list=(v:unknown):unknown[]=>Array.isArray(v)&&v.length<=200? v:bad();
export function verifyFrozen19OriginalIngredientRowsV1(raw:string){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)bad();
 assertRawJsonWithoutDuplicateKeysV1(raw);
 const p=obj(JSON.parse(raw)),freeze=JSON.parse(readFileSync(new URL(
  '../../docs/premium/retained-sources/pilot19-admission-20261105/pilot-input-freeze-content-v4-20261106.json',import.meta.url),'utf8'
 ));
 if(freeze.contract!=='potok-pilot-input-freeze-v1'||pilotDigestV1(raw)!==freeze.candidateBytesSha256)bad();
 const recipes=list(obj(p.originalAuthoringCatalog).recipes).map(obj);
 const r=recoverFrozen19RetainedReferencesV1();
 if(r.retainedRowDigestsAvailable!==7||r.positionsRequiringOriginalRowRecheck!==3)bad();
 const refs=[...r.exactRowReferences,...r.conditionalPositionRefs];
 if(refs.length!==10||new Set(refs.map(x=>x.recipeId+'#'+x.rowId)).size!==10)bad();
 const proofs=refs.map(ref=>{
  const recipe=recipes.filter(x=>x.recipeId===ref.recipeId);
  const pinned=freeze.recipes.filter((x:{recipeId:string})=>x.recipeId===ref.recipeId);
  if(recipe.length!==1||pinned.length!==1||pilotDigestV1(pilotCanonicalV1(recipe[0]))!==pinned[0].authoringRecipeSha256)bad();
  const ingredient=list(recipe[0].ingredients).map(obj).filter(x=>x.ingredient_row_id===ref.rowId);
  if(ingredient.length!==1)bad();
  const digest=pilotDigestV1(pilotCanonicalV1(ingredient[0]));
  if(ref.originalRowSha256!==null && digest!==ref.originalRowSha256)bad();
  return {recipeId:ref.recipeId,rowId:ref.rowId,sourceRecord:ref.sourceRecord,
   originalRowSha256:digest,proofBasis:ref.originalRowSha256===null?'RECOMPUTED_FROM_EXACT_PINNED_CANDIDATE':'RETAINED_ROW_DIGEST_MATCH',
   identityApproved:false,sourceApproved:false,canApply:false};
 });
 if(proofs.filter(x=>x.proofBasis==='RECOMPUTED_FROM_EXACT_PINNED_CANDIDATE').length!==3)bad();
 return {contract:'potok-frozen19-original-row-recheck-v1',candidateSha256:freeze.candidateBytesSha256,
  proofs,provenRowCount:10,sourceApprovals:0,catalogWrites:0,
  readyForServerSubmission:false,canApply:false,mayActivate:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('Usage: node --import tsx scripts/contracts/pilot-frozen19-original-row-recheck-v1.ts PRIVATE_CANDIDATE.json');
 const proof=verifyFrozen19OriginalIngredientRowsV1(readFileSync(process.argv[2],'utf8'));
 process.stdout.write('PINNED_ORIGINAL_ROWS_VERIFIED: '+proof.provenRowCount+' (no recipe contents or product approvals)\n');
}
