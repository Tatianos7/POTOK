import process from 'node:process';
import {pathToFileURL} from 'node:url';
import {profileGenerationWorkerV1} from './profile';
export {profileGenerationWorkerV1} from './profile';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await profileGenerationWorkerV1(process.argv[2] === undefined ? 3 : Number(process.argv[2])), null, 2));
}
