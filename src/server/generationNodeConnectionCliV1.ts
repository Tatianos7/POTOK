import process from 'node:process';
import {checkGenerationNodeConnectionsV1} from './generationNodeConnectionCheckV1';
const controller=new AbortController(),stop=()=>controller.abort();
process.on('SIGTERM',stop);process.on('SIGINT',stop);
void (async()=>{
  try {
    const r=await checkGenerationNodeConnectionsV1({enabled:process.env.POTOK_GENERATION_CONNECTION_CHECK_ENABLED==='true',
      configPath:process.argv[2],signal:controller.signal});
    process.stdout.write(JSON.stringify(r)+'\n');
    process.exitCode=r.outcome==='FAILED'?1:r.outcome==='STOPPED'?130:0;
  } catch {process.stdout.write(JSON.stringify({contract:'potok-node-connection-check-result-v1',outcome:'FAILED',mayActivate:false,checks:[]})+'\n');process.exitCode=1;}
  finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
})();
