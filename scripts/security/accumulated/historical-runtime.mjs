// Reproduce public inputs of the already accepted immutable browser image, never a new product build.
import assert from 'node:assert/strict';
import {readFile,lstat,mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function materializeHistoricalRuntime(root,parent){
 root=await realpath(root);parent=await realpath(parent);
 const manifest=await readFile(path.join(root,'scripts/security/accumulated/private-browser-runtime-inputs.json'));assert.equal(hash(manifest),'42905c3493a09729229f51aa89e1eccca47c0ca15c993af4462f882256d4de9e');
const snapshots=["src/App.tsx","package-lock.json","package.json","src/server/nutritionIntegrityReviewedEvidenceAdapterV1.ts","src/utils/__tests__/trustedGeneratedWeekValidatorV1.test.ts","src/utils/__tests__/trustedMealWarningEvidenceV1.test.ts","src/utils/adaptiveNutritionAuthoritiesV1.ts","src/utils/adaptiveNutritionGraphV2.ts","src/utils/adaptiveNutritionMealBalanceV1.ts","src/utils/adaptiveNutritionMealCompositionV1.ts","src/utils/foodReviewedEvidenceV1.ts","src/utils/trustedMealWarningEvidenceV1.ts","src/utils/trustedValidationEvidenceV1.ts"];
 const history=new Map([...['programDeliveryService','uiRuntimeAdapter'].map(name=>['src/services/'+name+'.ts',new URL('./runtime-history/'+name+'.ts.source',import.meta.url)]),
  ...snapshots.map(name=>[name,new URL('./runtime-history/input-snapshots/'+name+'.source',import.meta.url)])]);
 const directory=await mkdtemp(path.join(parent,'potok-historical-runtime-'));let changed=0;
 try{for(const e of JSON.parse(manifest)){assert(!e.path.includes('..')&&!e.path.startsWith('/'));const source=path.join(root,e.path),stat=await lstat(source);assert(stat.isFile()&&!stat.isSymbolicLink());let bytes=await readFile(source);
  if(hash(bytes)!==e.sha256){assert(history.has(e.path),'Unexpected source drift outside the retained historical input allowlist');const retained=history.get(e.path),retainedStat=await lstat(retained);assert(retainedStat.isFile()&&!retainedStat.isSymbolicLink());bytes=await readFile(retained);assert.equal(hash(bytes),e.sha256);changed++;}
  const target=path.join(directory,e.path);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await writeFile(target,bytes,{mode:0o600});
 }await writeFile(path.join(directory,'scripts/security/accumulated/private-browser-runtime-inputs.json'),manifest,{mode:0o600});return {directory,changed};
 }catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
