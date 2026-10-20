#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const specifications = [
  {
    file: 'docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql',
    start: 'CREATE FUNCTION public.adaptive_nutrition_mutate_v1(',
  },
  {
    file: 'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql',
    start: 'CREATE OR REPLACE FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(',
  },
];

const drift = process.argv.includes('--drift-internal');
const definitions = specifications.map(({ file, start }, index) => {
  const source = readFileSync(resolve(root, file), 'utf8');
  const first = source.indexOf(start);
  if (first < 0) throw new Error(`effective function start missing: ${file}`);
  const last = source.indexOf('\n$function$;', first);
  if (last < 0) throw new Error(`effective function end missing: ${file}`);
  let definition = source.slice(first, last + '\n$function$;'.length);
  if (drift && index === 1) {
    definition = definition.replace(
      "RAISE EXCEPTION 'goal revision is no longer authoritative' USING ERRCODE = '40001';",
      "RAISE EXCEPTION 'goal revision authority source drift' USING ERRCODE = '40001';",
    );
  }
  return definition;
});

process.stdout.write(`${definitions.join('\n\n')}\n`);
