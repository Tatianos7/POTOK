import test from 'node:test';
import assert from 'node:assert/strict';

import { copyWorkoutDayNoteText } from '../workoutDayNoteClipboard';

test('copy action copies note text correctly', async () => {
  let copiedText = '';

  const result = await copyWorkoutDayNoteText('  Контроль темпа и пауза внизу  ', {
    writeText: async (text: string) => {
      copiedText = text;
    },
  });

  assert.equal(result, true);
  assert.equal(copiedText, 'Контроль темпа и пауза внизу');
});

test('copy action returns false for empty workout day note', async () => {
  const result = await copyWorkoutDayNoteText('   ', {
    writeText: async () => {
      throw new Error('should not be called');
    },
  });

  assert.equal(result, false);
});
