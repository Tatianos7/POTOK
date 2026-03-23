import test from 'node:test';
import assert from 'node:assert/strict';

import { mealEntryNotesService } from '../mealEntryNotesService';

type NoteRow = { text: string; meal_entry_id?: string };

function createClientMock(options: {
  rows?: NoteRow[];
  error?: { code?: string; message?: string } | null;
}) {
  const rows = options.rows ?? [];
  const error = options.error ?? null;

  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        error: null,
      }),
    },
    from(table: string) {
      assert.equal(table, 'meal_entry_notes');
      return {
        select(_fields: string) {
          return {
            eq(_field: string, _value: string) {
              return this;
            },
            in(_field: string, _values: string[]) {
              return Promise.resolve({ data: rows, error });
            },
            limit(_count: number) {
              return Promise.resolve({ data: rows, error });
            },
          };
        },
      };
    },
  };
}

test('getNoteByEntryId returns note text when note exists', async () => {
  const service = mealEntryNotesService as any;
  const originalGetSupabaseClient = service.getSupabaseClient;

  service.getSupabaseClient = () =>
    createClientMock({
      rows: [{ text: 'Белок после тренировки' }],
    });

  try {
    const result = await mealEntryNotesService.getNoteByEntryId(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    );

    assert.equal(result, 'Белок после тренировки');
  } finally {
    service.getSupabaseClient = originalGetSupabaseClient;
  }
});

test('getNoteByEntryId returns null when note is absent without logging error', async () => {
  const service = mealEntryNotesService as any;
  const originalGetSupabaseClient = service.getSupabaseClient;
  const originalConsoleError = console.error;
  const loggedErrors: unknown[] = [];

  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  service.getSupabaseClient = () =>
    createClientMock({
      rows: [],
    });

  try {
    const result = await mealEntryNotesService.getNoteByEntryId(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    );

    assert.equal(result, null);
    assert.equal(loggedErrors.length, 0);
  } finally {
    console.error = originalConsoleError;
    service.getSupabaseClient = originalGetSupabaseClient;
  }
});

test('getNoteByEntryId tolerates duplicate rows and returns the first note', async () => {
  const service = mealEntryNotesService as any;
  const originalGetSupabaseClient = service.getSupabaseClient;
  const originalConsoleWarn = console.warn;
  const warnings: unknown[] = [];

  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  service.getSupabaseClient = () =>
    createClientMock({
      rows: [{ text: 'Первая заметка' }, { text: 'Вторая заметка' }],
    });

  try {
    const result = await mealEntryNotesService.getNoteByEntryId(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    );

    assert.equal(result, 'Первая заметка');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalConsoleWarn;
    service.getSupabaseClient = originalGetSupabaseClient;
  }
});
