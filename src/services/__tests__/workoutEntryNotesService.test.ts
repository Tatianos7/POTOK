import test from 'node:test';
import assert from 'node:assert/strict';

import { workoutEntryNotesService } from '../workoutEntryNotesService';

type NoteRow = { text: string; workout_entry_id?: string };

function createSelectClientMock(options: {
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
      assert.equal(table, 'workout_entry_notes');
      return {
        select(_fields: string) {
          return {
            eq(_field: string, _value: string) {
              return this;
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

function createMutationClientMock(options?: {
  upsertError?: { code?: string; message?: string } | null;
  deleteError?: { code?: string; message?: string } | null;
}) {
  const upsertError = options?.upsertError ?? null;
  const deleteError = options?.deleteError ?? null;
  const calls: Array<{ type: 'upsert' | 'delete'; payload?: Record<string, unknown> }> = [];

  return {
    calls,
    auth: {
      getUser: async () => ({
        data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        error: null,
      }),
    },
    from(table: string) {
      assert.equal(table, 'workout_entry_notes');
      return {
        upsert(payload: Record<string, unknown>) {
          calls.push({ type: 'upsert', payload });
          return Promise.resolve({ error: upsertError });
        },
        delete() {
          calls.push({ type: 'delete' });
          return {
            eq(_field: string, _value: string) {
              return {
                eq(_field2: string, _value2: string) {
                  return Promise.resolve({ error: deleteError });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('entry note save works for WorkoutEntry', async () => {
  const service = workoutEntryNotesService as any;
  const originalGetSupabaseClient = service.getSupabaseClient;
  const client = createMutationClientMock();

  service.getSupabaseClient = () => client;

  try {
    await workoutEntryNotesService.saveNote(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '   Локоть не разгибать до конца   ',
    );

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].type, 'upsert');
    assert.equal(client.calls[0].payload?.text, 'Локоть не разгибать до конца');
    assert.equal(client.calls[0].payload?.workout_entry_id, '22222222-2222-4222-8222-222222222222');
  } finally {
    service.getSupabaseClient = originalGetSupabaseClient;
  }
});

test('entry note delete works for WorkoutEntry', async () => {
  const service = workoutEntryNotesService as any;
  const originalGetSupabaseClient = service.getSupabaseClient;
  const client = createMutationClientMock();

  service.getSupabaseClient = () => client;

  try {
    await workoutEntryNotesService.deleteNote(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].type, 'delete');
  } finally {
    service.getSupabaseClient = originalGetSupabaseClient;
  }
});

test('no-note read path is safe and does not surface false errors', async () => {
  const service = workoutEntryNotesService as any;
  const originalGetSupabaseClient = service.getSupabaseClient;
  const originalConsoleError = console.error;
  const loggedErrors: unknown[] = [];

  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  service.getSupabaseClient = () => createSelectClientMock({ rows: [] });

  try {
    const result = await workoutEntryNotesService.getNoteByEntryId(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );

    assert.equal(result, null);
    assert.equal(loggedErrors.length, 0);
  } finally {
    console.error = originalConsoleError;
    service.getSupabaseClient = originalGetSupabaseClient;
  }
});
