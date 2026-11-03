import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
import {previewRecipeAuthoringWeekV1} from '../../src/dev/authoringWeekSearchV1';
export {previewRecipeAuthoringWeekV1, type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: node --import tsx scripts/contracts/recipe-authoring-week-preview-v1.ts MASTER.xlsx SCENARIO.json');
  console.log(JSON.stringify(previewRecipeAuthoringWeekV1(readRecipeAuthoringTestCatalogV1(process.argv[2]),JSON.parse(readFileSync(process.argv[3],'utf8'))),null,2));
}
