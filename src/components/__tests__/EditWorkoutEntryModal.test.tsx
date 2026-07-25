import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

test('edit workout entry modal validates parsed values before save callback', () => {
  const source = readFileSync(resolve(currentDir, '../EditWorkoutEntryModal.tsx'), 'utf8');
  const submitStart = source.indexOf('const handleSubmit = async () => {');
  const submitEnd = source.indexOf('\\n  };', submitStart);
  const submitSource = source.slice(submitStart, submitEnd);

  assert.notEqual(submitStart, -1);
  assert.match(submitSource, /validateSelectedWorkoutExercisesForSave/);
  assert.match(submitSource, /setValidationError\(nextValidationError\)/);
  assert.match(submitSource, /await onSave\(parsed\)/);
});
