#!/usr/bin/env node
/**
 * CI guard: prevent new direct browser/client DML against server-owned Premium tables.
 * Existing legacy writers are explicitly grandfathered only for compatibility.
 * This is not an approval of legacy writes or a security boundary.
 * Run: node scripts/contracts/premium-client-authority-guard.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const owned = new Set([
  'entitlements','nutrition_programs','training_programs','program_days',
  'program_sessions','program_versions','program_adaptations',
  'program_explainability','program_phases','program_blocks',
  'program_generation_jobs','program_guard_events','ai_trust_scores'
]);
const legacy = new Set([
  'src/services/aiTrustService.ts',
  'src/services/programDeliveryService.ts',
  'src/services/programGenerationService.ts'
]);
const ignoreDirs = new Set(['__tests__','node_modules','dist','build','coverage']);
const found = [];
async function walk(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) await walk(join(dir,entry.name));
      continue;
    }
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ||
        /(?:\.test\.|\.spec\.|\.d\.ts$)/.test(entry.name)) continue;
    const path = relative(root,join(dir,entry.name)).replaceAll('\\','/');
    const source = await readFile(join(dir,entry.name),'utf8');
    // Match static Supabase table references followed by DML, across line breaks.
    // A dynamic table expression or RPC must be separately audited.
    const re = /\.from\(\s*(['"`])([a-z_]+)\1\s*\)(?:(?!\.from\().){0,600}?\.(insert|update|upsert|delete)\s*\(/gs;
    for (const m of source.matchAll(re)) {
      if (!owned.has(m[2])) continue;
      const line = source.slice(0,m.index).split('\n').length;
      found.push({path,line,table:m[2],operation:m[3],legacy:legacy.has(path)});
    }
  }
}
await walk(join(root,'src'));
const newWrites = found.filter(x=>!x.legacy);
console.log(JSON.stringify({checked:'src',legacyCount:found.length-newWrites.length,newDirectWrites:newWrites},null,2));
if (newWrites.length) {
  console.error('BLOCKED: new client DML on server-owned Premium tables. Use reviewed server commands.');
  process.exitCode=1;
}
console.error('NOTE: legacy allowlist is temporary. Dynamic table names, RPC bodies and indirect writes require separate review.');
