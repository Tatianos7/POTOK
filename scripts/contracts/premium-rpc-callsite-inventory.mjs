// Read-only full tracked-source inventory. Runs on exact checked-out PR HEAD.
// No secrets or source lines are printed; only paths and matching line numbers.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const relevant=files.filter(p=>/^(src|supabase\/functions|api|server|scripts)\//.test(p)&&/\.(tsx?|jsx?|mjs|cjs|sql)$/.test(p)&&!/(node_modules|dist|coverage|\.test\.|__tests__|fixtures?)/.test(p));
const terms={
 rpc_get_entitlements:/\bget_entitlements\b/g,
 rpc_get_paywall_state:/\bget_paywall_state\b/g,
 rpc_start_purchase:/\bstart_purchase\b/g,
 rpc_restore_purchase:/\brestore_purchase\b/g,
 rpc_generic:/\.rpc\s*\(/g,
 edge_invoke:/functions\.invoke\s*\(/g,
 profile_write:/\buser_profiles\b/g,
 finance_tables:/\b(subscriptions|entitlements|billing_events)\b/g,
 privilege_flags:/\b(has_premium|is_admin|coach_settings|voice_settings)\b/g
};
const findings={};
for(const [name,pattern] of Object.entries(terms)) findings[name]=[];
for(const path of relevant){
 let data;try{data=readFileSync(path,'utf8')}catch{continue}
 for(const [name,pattern] of Object.entries(terms)){
  const hits=[...data.matchAll(pattern)].map(m=>data.slice(0,m.index).split('\n').length);
  if(hits.length) findings[name].push({path,lines:hits});
 }
}
const output={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tracked_source_files:relevant.length,findings};
writeFileSync('premium-rpc-callsite-inventory.json',JSON.stringify(output,null,2)+'\n');
for(const [name,hits] of Object.entries(findings)) console.log(name+': '+hits.length+' files / '+hits.reduce((n,h)=>n+h.lines.length,0)+' matches');
console.log('Full file/line inventory: premium-rpc-callsite-inventory.json');
