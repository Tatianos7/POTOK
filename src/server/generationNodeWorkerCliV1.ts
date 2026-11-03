import process from 'node:process';
import {runGenerationNodeWorkerOnceV1, generationNodeWorkerResultContractV1} from './generationNodeWorkerHostV1';

// Explicit operator invocation only. Paths/UUID may be arguments; secrets never are.
const controller = new AbortController();
const stop = () => controller.abort();
process.on('SIGTERM', stop);process.on('SIGINT', stop);
void (async () => {
  try {
    const response = await runGenerationNodeWorkerOnceV1({enabled: process.env.POTOK_GENERATION_WORKER_ENABLED === 'true',
      requestOperationId: process.argv[2], configPath: process.argv[3], signal: controller.signal});
    process.stdout.write(JSON.stringify(response) + '\n');
    process.exitCode = response.outcome === 'FAILED' ? 1 : response.outcome === 'STOPPED' ? 130
      : response.outcome === 'RESPONSE' && response.status !== 'ACTIVE' ? 2 : 0;
  } catch {
    process.stdout.write(JSON.stringify({contract: generationNodeWorkerResultContractV1, outcome: 'FAILED', status: null}) + '\n');
    process.exitCode = 1;
  } finally {process.removeListener('SIGTERM', stop);process.removeListener('SIGINT', stop);}
})();
