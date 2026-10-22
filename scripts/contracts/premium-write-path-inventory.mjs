#!/usr/bin/env node
/**
 * Read-only repository write-path inventory. Runs against the checked-out tree,
 * not GitHub's default-branch search index. Does not contact Supabase.
 * Usage: node scripts/contracts/premium-write-path-inventory.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, join } from 'node:path';

const root = process.cwd();
const skip = new Set(['.git','node_modules','.next','dist','build','coverage','.expo','.turbo','android','docs','supabase','scripts','public']);
const extensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.sql']);
const targets = ['program_generation_jobs','program_guard_events','training_programs','ai_trust_scores','entitlements','nutrition_programs','program_days','program_sessions','program_versions','program_adaptations','program_explainability','user_goals','food_diary_entries','program_phases','program_blocks','program_feedback'];
const tableRegex = new RegExp('\\b('+targets.join('|')+')\\b','g');
const writes = /\.(?:insert|update|upsert|delete)\s*\(|\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\b|\.rpc\s*\(/i;
const entries = [];
async function walk(dir) {
 for (const d of await readdir(dir,{withFileTypes:true})) {
  if (d.isDirectory()) { if(!skip.has(d.name)) await walk(join(dir,d.name)); continue; }
  if(!d.isFile() || !extensions.has(extname(d.name)) || /(?:__tests__|\.test\.|\.spec\.|\.d\.ts$)/.test(join(dir,d.name))) continue;
  const file=join(dir,d.name), path=relative(root,file);
  const lines=(await readFile(file,'utf8')).split(/\r?\n/);
  for(let i=0;i<lines.length;i++){
   const line=lines[i], matches=[...line.matchAll(tableRegex)].map(m=>m[0]);
   if(!matches.length) continue;
   const context=lines.slice(Math.max(0,i-8),Math.min(lines.length,i+13)).join('\n');
   const kinds=[...new Set([...context.matchAll(/\.(insert|update|upsert|delete|rpc)\s*\(|\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\b/gi)].map(m=>(m[1]||m[2]).toLowerCase()))];
   entries.push({file:path,line:i+1,tables:[...new Set(matches)],classification:writes.test(context)?'candidate_write':'reference_only',operations:kinds});
  }
 }
}
await walk(join(root,'src'));
entries.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
const candidates=entries.filter(x=>x.classification==='candidate_write');
console.log(JSON.stringify({version:1,scope:'src runtime only; excludes tests, docs, SQL, compiled Android',filesWithMatches:new Set(entries.map(x=>x.file)).size,candidateWriteReferences:candidates.length,results:entries},null,2));
if(candidates.length===0) console.error('WARNING: no candidate writes found; do not interpret as proof of no writers.');
