import process from 'node:process';
import {runGenerationNodeConnectionPreflightV1,stagingNodeConnectionProbeContractV1} from './generationNodeConnectionPreflightV1';

/** Operator-only Staging probe, never runs a generation request or modifies SQL. */
void(async()=>{
 try{
  const result=await runGenerationNodeConnectionPreflightV1(process.argv[2],{
   enabled:process.env.POTOK_GENERATION_CONNECTION_PREFLIGHT_ENABLED==='true',dnsMode:process.env.POTOK_GENERATION_CONNECTION_DNS_MODE
  });
  process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=result.status==='PASS'?0:1;
 }catch{
  process.stdout.write(JSON.stringify({
   contract:stagingNodeConnectionProbeContractV1,status:'FAIL',
   readerVerified:false,gatewayVerified:false,workerEnabled:false,writes:0
  })+'\n');
  process.exitCode=1;
 }
})();
