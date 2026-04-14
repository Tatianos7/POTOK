import test from 'node:test';
import assert from 'node:assert/strict';

import {
  USER_EXERCISE_MEDIA_ALLOWED_IMAGE_TYPES,
  USER_EXERCISE_MEDIA_ALLOWED_VIDEO_TYPES,
  USER_EXERCISE_MEDIA_IMAGE_UPLOAD_TIMEOUT_MS,
  USER_EXERCISE_MEDIA_MAX_IMAGE_BYTES,
  USER_EXERCISE_MEDIA_MAX_VIDEO_BYTES,
  USER_EXERCISE_MEDIA_VIDEO_UPLOAD_TIMEOUT_MS,
  UserExerciseMediaService,
  buildUserExerciseMediaStoragePath,
  getUserExerciseMediaFileKind,
  mapPersistedWorkoutExerciseMediaItems,
  toUserExerciseMediaErrorMessage,
  validateMediaFile,
  type UserExerciseMediaGateway,
} from '../userExerciseMediaService';
import type { UserExerciseMedia } from '../../types/workout';

class FakeUserExerciseMediaGateway implements UserExerciseMediaGateway {
  rows: UserExerciseMedia[] = [];
  uploadedPaths: string[] = [];
  insertedRows: Array<{ user_id: string; exercise_id: string; workout_entry_id?: string | null; workout_date?: string | null; file_path: string; file_type: 'image' | 'video' }> = [];
  uploadShouldHang = false;
  uploadShouldFail = false;
  insertShouldFail = false;
  listShouldFail = false;
  failReloadOnly = false;
  removeShouldFail = false;
  restoredRows: UserExerciseMedia[] = [];
  listCalls = 0;

  async getSessionUserId(): Promise<string> {
    return 'user-1';
  }

  async listMediaRows(userId: string, workoutEntryId: string): Promise<UserExerciseMedia[]> {
    this.listCalls += 1;
    if (this.listShouldFail) {
      throw new Error('raw list error');
    }
    if (this.failReloadOnly && this.listCalls > 1) {
      throw new Error('raw reload error');
    }
    return this.rows.filter((row) => row.user_id === userId && row.workout_entry_id === workoutEntryId);
  }

  async uploadFile(path: string): Promise<void> {
    if (this.uploadShouldHang) {
      return new Promise(() => undefined);
    }
    if (this.uploadShouldFail) {
      throw new Error('storage upload failed');
    }
    this.uploadedPaths.push(path);
  }

  async insertMediaRows(rows: Array<{ user_id: string; exercise_id: string; workout_entry_id?: string | null; workout_date?: string | null; file_path: string; file_type: 'image' | 'video' }>): Promise<void> {
    if (this.insertShouldFail) {
      throw new Error('raw insert error');
    }
    this.insertedRows.push(...rows);
    const now = '2026-04-13T10:00:00.000Z';
    this.rows.unshift(
      ...rows.map((row, index) => ({
        id: `media-${this.insertedRows.length}-${index}`,
        user_id: row.user_id,
        exercise_id: row.exercise_id,
        workout_entry_id: row.workout_entry_id ?? null,
        workout_date: row.workout_date ?? null,
        file_path: row.file_path,
        file_type: row.file_type,
        created_at: now,
      })),
    );
  }

  async deleteMediaRow(mediaId: string): Promise<void> {
    this.rows = this.rows.filter((row) => row.id !== mediaId);
  }

  async restoreMediaRow(row: UserExerciseMedia): Promise<void> {
    this.restoredRows.push(row);
    this.rows.unshift(row);
  }

  async createSignedUrl(path: string): Promise<string> {
    return `https://signed.example/${path}`;
  }

  async removeFiles(): Promise<void> {
    if (this.removeShouldFail) {
      throw new Error('storage remove failed');
    }
  }
}

test('saving draft media uploads files and creates user media records', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  const service = new UserExerciseMediaService(gateway);
  const files = [
    new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 }),
    new File(['vid'], 'video.mp4', { type: 'video/mp4', lastModified: 2 }),
  ];

  const items = await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-1',
    workoutDate: '2026-04-13',
    files,
  });

  assert.equal(gateway.uploadedPaths.length, 2);
  assert.equal(gateway.insertedRows.length, 2);
  assert.equal(gateway.insertedRows[0].exercise_id, 'exercise-1');
  assert.equal(items.length, 2);
  assert.match(items[0].previewUrl, /^https:\/\/signed\.example\//);
});

test('persisted workout exercise media is loaded when card opens', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.rows = [
    {
      id: 'media-1',
      user_id: 'user-1',
      exercise_id: 'exercise-1',
      workout_entry_id: 'entry-1',
      workout_date: '2026-04-13',
      file_path: 'user-1/exercise-1/file-1.jpg',
      file_type: 'image',
      created_at: '2026-04-13T10:00:00.000Z',
    },
  ];
  const service = new UserExerciseMediaService(gateway);

  const items = await service.listWorkoutExerciseMedia('entry-1');

  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'image');
  assert.equal(items[0].previewUrl, 'https://signed.example/user-1/exercise-1/file-1.jpg');
});

test('saved media remains after closing and reopening workout exercise card', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  const service = new UserExerciseMediaService(gateway);
  await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-1',
    workoutDate: '2026-04-13',
    files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })],
  });

  const reopenedItems = await service.listWorkoutExerciseMedia('entry-1');

  assert.equal(reopenedItems.length, 1);
  assert.equal(reopenedItems[0].exercise_id, 'exercise-1');
});

test('saving state always resolves no infinite pending', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.uploadShouldHang = true;
  const service = new UserExerciseMediaService(gateway);

  const startedAt = Date.now();
  await assert.rejects(
    () => service.saveWorkoutExerciseMediaDrafts({
      exerciseId: 'exercise-1',
      workoutEntryId: 'entry-1',
      workoutDate: '2026-04-13',
      files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })],
    }),
    new Error(toUserExerciseMediaErrorMessage('save')),
  );
  assert.ok(Date.now() - startedAt < USER_EXERCISE_MEDIA_IMAGE_UPLOAD_TIMEOUT_MS * 2);
});

test('video upload gets longer timeout and remains reopen-safe after save', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  const service = new UserExerciseMediaService(gateway);

  const saved = await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-1',
    workoutDate: '2026-04-13',
    files: [new File(['vid'], 'video.mp4', { type: 'video/mp4', lastModified: 1 })],
  });

  const reopened = await service.listWorkoutExerciseMedia('entry-1');

  assert.equal(saved.length, 1);
  assert.equal(saved[0].kind, 'video');
  assert.equal(reopened.length, 1);
  assert.equal(reopened[0].kind, 'video');
  assert.equal(USER_EXERCISE_MEDIA_IMAGE_UPLOAD_TIMEOUT_MS, 10000);
  assert.equal(USER_EXERCISE_MEDIA_VIDEO_UPLOAD_TIMEOUT_MS, 45000);
});

test('failed save does not clear draft contract and returns controlled error instead of raw backend text', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.insertShouldFail = true;
  const service = new UserExerciseMediaService(gateway);

  await assert.rejects(
    () => service.saveWorkoutExerciseMediaDrafts({
      exerciseId: 'exercise-1',
      workoutEntryId: 'entry-1',
      workoutDate: '2026-04-13',
      files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })],
    }),
    new Error('Не удалось сохранить файлы'),
  );
});

test('oversized video returns controlled size error before upload starts', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  const service = new UserExerciseMediaService(gateway);
  const file = new File(['vid'], 'video.mp4', { type: 'video/mp4', lastModified: 1 });
  Object.defineProperty(file, 'size', { configurable: true, value: USER_EXERCISE_MEDIA_MAX_VIDEO_BYTES + 1 });

  await assert.rejects(
    () => service.saveWorkoutExerciseMediaDrafts({
      exerciseId: 'exercise-1',
      workoutEntryId: 'entry-1',
      workoutDate: '2026-04-13',
      files: [file],
    }),
    new Error('Файл слишком большой'),
  );

  assert.equal(gateway.uploadedPaths.length, 0);
  assert.equal(gateway.insertedRows.length, 0);
});

test('validateMediaFile enforces supported image and video contracts', () => {
  assert.deepEqual(USER_EXERCISE_MEDIA_ALLOWED_IMAGE_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
  assert.deepEqual(USER_EXERCISE_MEDIA_ALLOWED_VIDEO_TYPES, ['video/mp4', 'video/quicktime']);

  assert.doesNotThrow(() => validateMediaFile({ type: 'image/jpeg', size: USER_EXERCISE_MEDIA_MAX_IMAGE_BYTES }));
  assert.doesNotThrow(() => validateMediaFile({ type: 'video/mp4', size: USER_EXERCISE_MEDIA_MAX_VIDEO_BYTES }));

  assert.throws(() => validateMediaFile({ type: 'image/gif', size: 1024 }), new Error('Неподдерживаемый формат файла'));
  assert.throws(() => validateMediaFile({ type: 'video/webm', size: 1024 }), new Error('Неподдерживаемый формат файла'));
  assert.throws(() => validateMediaFile({ type: 'image/png', size: USER_EXERCISE_MEDIA_MAX_IMAGE_BYTES + 1 }), new Error('Файл слишком большой'));
});

test('persisted media reload after save returns saved items immediately', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.failReloadOnly = true;
  const service = new UserExerciseMediaService(gateway);

  const items = await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-1',
    workoutDate: '2026-04-13',
    files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })],
  });

  assert.equal(items.length, 1);
  assert.match(items[0].previewUrl, /^https:\/\/signed\.example\//);
});

test('user exercise media helpers keep storage and signed mapping contract stable', async () => {
  const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 });
  const path = buildUserExerciseMediaStoragePath('user-1', 'exercise-1', file);

  assert.match(path, /^user-1\/exercise-1\/.+\.jpg$/);
  assert.equal(getUserExerciseMediaFileKind(file), 'image');

  const mapped = await mapPersistedWorkoutExerciseMediaItems(
    [{
      id: 'media-1',
      user_id: 'user-1',
      exercise_id: 'exercise-1',
      workout_entry_id: 'entry-1',
      workout_date: '2026-04-13',
      file_path: 'user-1/exercise-1/file-1.jpg',
      file_type: 'image',
      created_at: '2026-04-13T10:00:00.000Z',
    }],
    async () => 'https://signed.example/file-1.jpg',
  );

  assert.equal(mapped[0].previewUrl, 'https://signed.example/file-1.jpg');
});

test('persisted media is available on first reopen after successful save', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  const service = new UserExerciseMediaService(gateway);

  await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-1',
    workoutDate: '2026-04-13',
    files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })],
  });

  gateway.listShouldFail = true;

  const reopenedItems = await service.listWorkoutExerciseMedia('entry-1');

  assert.equal(reopenedItems.length, 1);
  assert.match(reopenedItems[0].previewUrl, /^https:\/\/signed\.example\//);
});


test('newly saved media stays scoped to its workout entry and does not merge older entry media', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.rows = [{
    id: 'media-old',
    user_id: 'user-1',
    exercise_id: 'exercise-1',
    workout_entry_id: 'entry-old',
    workout_date: '2026-04-12',
    file_path: 'user-1/exercise-1/old.jpg',
    file_type: 'image',
    created_at: '2026-04-12T10:00:00.000Z',
  }];
  const service = new UserExerciseMediaService(gateway);

  const saved = await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-new',
    workoutDate: '2026-04-13',
    files: [new File(['img'], 'new.jpg', { type: 'image/jpeg', lastModified: 1 })],
  });

  assert.equal(saved.length, 1);
  assert.match(saved[0].file_path, /new\.|exercise-1\//);

  const reopened = await service.listWorkoutExerciseMedia('entry-new');
  const oldEntry = await service.listWorkoutExerciseMedia('entry-old');
  assert.equal(reopened.length, 1);
  assert.equal(reopened[0].file_path, saved[0].file_path);
  assert.equal(oldEntry.length, 1);
  assert.equal(oldEntry[0].id, 'media-old');
});

test('console-noise-causing load failures are handled safely with cached persisted items', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  const service = new UserExerciseMediaService(gateway);
  await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-1',
    workoutDate: '2026-04-13',
    files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg', lastModified: 1 })],
  });

  gateway.listShouldFail = true;
  const items = await service.listWorkoutExerciseMedia('entry-1');
  assert.equal(items.length, 1);
});

test('multi-file save keeps both new files inside the same workout entry only', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.rows = [{
    id: 'media-old',
    user_id: 'user-1',
    exercise_id: 'exercise-1',
    workout_entry_id: 'entry-old',
    workout_date: '2026-04-12',
    file_path: 'user-1/exercise-1/old.jpg',
    file_type: 'image',
    created_at: '2026-04-12T10:00:00.000Z',
  }];
  const service = new UserExerciseMediaService(gateway);

  await service.saveWorkoutExerciseMediaDrafts({
    exerciseId: 'exercise-1',
    workoutEntryId: 'entry-new',
    workoutDate: '2026-04-13',
    files: [
      new File(['img-1'], 'new-1.jpg', { type: 'image/jpeg', lastModified: 1 }),
      new File(['img-2'], 'new-2.jpg', { type: 'image/jpeg', lastModified: 2 }),
    ],
  });

  const reopened = await service.listWorkoutExerciseMedia('entry-new');
  const oldEntry = await service.listWorkoutExerciseMedia('entry-old');

  assert.equal(reopened.length, 2);
  assert.equal(oldEntry.length, 1);
  assert.equal(oldEntry[0].id, 'media-old');
});

test('successful persisted delete removes media and it does not return after reopen', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.rows = [{
    id: 'media-1',
    user_id: 'user-1',
    exercise_id: 'exercise-1',
    workout_entry_id: 'entry-1',
    workout_date: '2026-04-13',
    file_path: 'user-1/exercise-1/file-1.jpg',
    file_type: 'image',
    created_at: '2026-04-13T10:00:00.000Z',
  }];
  const service = new UserExerciseMediaService(gateway);

  await service.listWorkoutExerciseMedia('entry-1');
  const next = await service.deleteWorkoutExerciseMedia(gateway.rows[0]);
  const reopened = await service.listWorkoutExerciseMedia('entry-1');

  assert.equal(next.length, 0);
  assert.equal(reopened.length, 0);
});

test('failed persisted delete restores db row when storage delete fails', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.rows = [{
    id: 'media-1',
    user_id: 'user-1',
    exercise_id: 'exercise-1',
    workout_entry_id: 'entry-1',
    workout_date: '2026-04-13',
    file_path: 'user-1/exercise-1/file-1.jpg',
    file_type: 'image',
    created_at: '2026-04-13T10:00:00.000Z',
  }];
  gateway.removeShouldFail = true;
  const service = new UserExerciseMediaService(gateway);

  await service.listWorkoutExerciseMedia('entry-1');

  await assert.rejects(
    () => service.deleteWorkoutExerciseMedia(gateway.rows[0]),
    new Error('Не удалось удалить файл'),
  );

  assert.equal(gateway.restoredRows.length, 1);
  assert.equal(gateway.rows.length, 1);
  assert.equal(gateway.rows[0].id, 'media-1');
});

test('old legacy media without workout_entry_id is ignored by the new read path', async () => {
  const gateway = new FakeUserExerciseMediaGateway();
  gateway.rows = [{
    id: 'media-legacy',
    user_id: 'user-1',
    exercise_id: 'exercise-1',
    workout_entry_id: null,
    workout_date: '2026-04-12',
    file_path: 'user-1/exercise-1/legacy.jpg',
    file_type: 'image',
    created_at: '2026-04-12T10:00:00.000Z',
  }];
  const service = new UserExerciseMediaService(gateway);

  const items = await service.listWorkoutExerciseMedia('entry-new');

  assert.equal(items.length, 0);
});
