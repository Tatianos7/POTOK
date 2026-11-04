import {Resolver} from 'node:dns/promises';
import {isIP} from 'node:net';
import type {PoolConfig} from 'pg';
import {generationStagingPgHostV1} from './generationNodePgPoolV1';

interface ResolverPort {resolve6(host: string): Promise<string[]>; cancel(): void}
/** Explicit DNS-AAAA transport selection for the fixed Staging identity only.
 * No custom DNS server, global lookup patch, cached/stored IP or automatic fallback.
 */
export async function resolveGenerationStagingIpv6V1(signal: AbortSignal,
  createResolver: () => ResolverPort = () => new Resolver({timeout: 3000, tries: 1}), deadlineMs = 5000): Promise<string> {
  if (signal.aborted || !Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 5000) throw Error('GENERATION_DNS_UNAVAILABLE');
  const resolver = createResolver();
  return new Promise<string>((resolve,reject)=>{
    let settled=false;
    const finish=(address?:string)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',stop);
      if(address)resolve(address);else{try{resolver.cancel();}catch{/* Still fail closed. */}reject(Error('GENERATION_DNS_UNAVAILABLE'));}
    };
    const stop=()=>finish();
    const timer=setTimeout(stop,deadlineMs);
    signal.addEventListener('abort',stop,{once:true});
    if(signal.aborted){stop();return;}
    Promise.resolve().then(()=>{
      if(signal.aborted)throw Error('STOPPED');return resolver.resolve6(generationStagingPgHostV1);
    }).then(addresses=>{
      if(!Array.isArray(addresses)||addresses.length<1||addresses.length>16
        ||!addresses.every(a=>typeof a==='string'&&!a.includes('%')&&isIP(a)===6)){finish();return;}
      finish(addresses[0]);
    },()=>finish());
  });
}
/** Transport address comes only from the fixed-host resolver. The authenticated
 * TLS name and trust remain the original Supabase hostname, never the numeric IP.
 */
export function generationStagingIpv6ConfigV1(config: PoolConfig, address: string): PoolConfig {
  if(typeof address!=='string'||address.includes('%')||isIP(address)!==6
    ||config.host!==generationStagingPgHostV1||!config.ssl||typeof config.ssl!=='object'
    ||config.ssl.servername!==generationStagingPgHostV1||config.ssl.rejectUnauthorized!==true
    ||config.ssl.minVersion!=='TLSv1.2')throw Error('GENERATION_DNS_CONFIGURATION_INVALID');
  return {...config,host:address,ssl:{...config.ssl}};
}
