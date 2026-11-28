import process from 'node:process';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {assertRawJsonWithoutDuplicateKeysV1} from '../utils/adaptiveNutritionWireV1';

/** Trusted operator path only; returns parser-owned JSON, never authority or logs. */
export async function readPrivateGenerationJsonV1(path: string): Promise<unknown> {
  if (typeof path !== 'string' || !path || path.includes('\0')) throw Error('INVALID_CONFIG');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let raw: string;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid!() || (stat.mode & 0o077) !== 0
      || stat.size < 1 || stat.size > 2 * 1024 * 1024) throw Error('INVALID_CONFIG');
    const buffer = Buffer.alloc(stat.size + 1);let offset = 0;
    while (offset < buffer.length) {
      const {bytesRead} = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;offset += bytesRead;
    }
    if (offset !== stat.size) throw Error('INVALID_CONFIG');
    raw = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buffer.subarray(0, offset));
  } finally {await file.close();}
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw);
}
