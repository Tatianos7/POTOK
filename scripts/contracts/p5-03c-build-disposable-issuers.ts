/**
 * P5-03C: build disposable-only Food/Nonfood issuer SQL variants.
 *
 * This is a strict, fail-closed source transformation for isolated tests.
 * It NEVER modifies the migration drafts and NEVER connects to a database.
 * Output is NOT deployable: it references potok_closure_candidate, whose
 * functions are private and guarded by a disposable-only marker.
 *
 * Usage:
 *   npx tsx scripts/contracts/p5-03c-build-disposable-issuers.ts <output-directory>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const specs = [
  {
    file: 'food_reviewed_evidence_v1_phase2b.sql',
    anchor: '  attestation:=potok_food_evidence.authority_v1();',
    functionName: 'public.food_evidence_review_v1(',
  },
  {
    file: 'nonfood_reviewed_evidence_v1.sql',
    anchor: ' att:=potok_food_evidence.authority_v1();',
    functionName: 'public.nonfood_evidence_review_v1(',
  },
] as const;

export function transformIssuer(sql: string, functionName: string, anchor: string): string {
  const signature = 'CREATE FUNCTION ' + functionName;
  const start = sql.indexOf(signature);
  if (start < 0 || sql.indexOf(signature, start + 1) !== -1) {
    throw new Error('Expected exactly one issuer function: ' + functionName);
  }
  const bodyStart = sql.indexOf('AS $$', start);
  const bodyEnd = sql.indexOf('$$;', bodyStart + 5);
  if (bodyStart < 0 || bodyEnd < 0) throw new Error('Issuer body not found');
  const body = sql.slice(bodyStart + 5, bodyEnd);
  const first = body.indexOf(anchor);
  if (first < 0 || body.indexOf(anchor, first + 1) !== -1) {
    throw new Error('Authority anchor missing or ambiguous: ' + functionName);
  }
  if (/potok_closure_candidate|potok_closure\.assert_active_v1/.test(body)) {
    throw new Error('Issuer already contains a closure integration');
  }
  const actor = 'actor'; // defined as auth.uid() in both original issuer functions
  if (!body.includes('DECLARE actor uuid:=auth.uid();')) {
    throw new Error('Verified actor binding changed: ' + functionName);
  }
  const injected = anchor +
    '\n  -- DISPOSABLE-ONLY candidate; held until transaction end.\n' +
    '  PERFORM potok_closure_candidate.assert_active_v1(' + actor + ');';
  const changedBody = body.slice(0, first) + injected + body.slice(first + anchor.length);
  const changed = sql.slice(0, bodyStart + 5) + changedBody + sql.slice(bodyEnd);
  if (changed === sql) throw new Error('No transformation applied');
  return changed;
}

export function buildDisposableIssuers(outputDirectory: string): string[] {
  mkdirSync(outputDirectory, { recursive: true });
  return specs.map(spec => {
    const original = readFileSync(resolve('supabase/migration_drafts', spec.file), 'utf8');
    const transformed = transformIssuer(original, spec.functionName, spec.anchor);
    const destination = join(outputDirectory, spec.file);
    writeFileSync(destination, transformed, { flag: 'w', mode: 0o600 });
    return destination;
  });
}

if (process.argv[1]?.endsWith('p5-03c-build-disposable-issuers.ts')) {
  const output = process.argv[2];
  if (!output) throw new Error('Explicit output directory required');
  if (resolve(output).startsWith(resolve('supabase') + '/')) {
    throw new Error('Refusing to write disposable variants inside supabase/');
  }
  const files = buildDisposableIssuers(resolve(output));
  for (const file of files) process.stdout.write(file + '\n');
}
