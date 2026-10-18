import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFoodCore, type CatalogSnapshotV1 } from './food-core-preflight.ts';

function argument(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index < 0 ? undefined : argv[index + 1];
}

export function runFoodCorePreflightCli(
  argv: readonly string[],
  readFile: (path: string) => Uint8Array = readFileSync,
  writeOutput: (json: string) => void = (json) => { process.stdout.write(json); },
): void {
  const file = argument(argv, '--file');
  const snapshotFile = argument(argv, '--catalog-snapshot');
  const snapshotSha256 = argument(argv, '--snapshot-sha256');
  if (!file || Boolean(snapshotFile) !== Boolean(snapshotSha256) ||
    (snapshotSha256 && !/^[a-f0-9]{64}$/.test(snapshotSha256))) {
    throw new Error('Usage: tsx scripts/food-core-preflight-cli.ts --file input.xlsx [--catalog-snapshot offline.json --snapshot-sha256 <independently-verified-sha256>]');
  }
  const input = readFile(resolve(file));
  let snapshot: CatalogSnapshotV1 | undefined;
  if (snapshotFile && snapshotSha256) {
    const raw = readFile(resolve(snapshotFile));
    if (createHash('sha256').update(raw).digest('hex') !== snapshotSha256) {
      throw new Error('Offline catalog snapshot file SHA-256 does not match --snapshot-sha256.');
    }
    const payload = JSON.parse(Buffer.from(raw).toString('utf8')) as Omit<CatalogSnapshotV1, 'expectedSha256'>;
    const { version, capturedAt, coverage, foods, aliases } = payload;
    const expectedSha256 = createHash('sha256').update(JSON.stringify({ version, capturedAt, coverage, foods, aliases })).digest('hex');
    snapshot = { ...payload, expectedSha256 };
  }
  writeOutput(`${JSON.stringify(analyzeFoodCore(input, snapshot), null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    runFoodCorePreflightCli(process.argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Preflight failed.'}\n`);
    process.exitCode = 1;
  }
}
