import { supabase } from '../lib/supabaseClient';
import type { UserExerciseMedia } from '../types/workout';

const USER_EXERCISE_MEDIA_BUCKET = 'user-exercise-media';
const USER_EXERCISE_MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;
export const USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS = 4000;
export const USER_EXERCISE_MEDIA_IMAGE_UPLOAD_TIMEOUT_MS = 10000;
export const USER_EXERCISE_MEDIA_VIDEO_UPLOAD_TIMEOUT_MS = 45000;
export const USER_EXERCISE_MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const USER_EXERCISE_MEDIA_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const USER_EXERCISE_MEDIA_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const USER_EXERCISE_MEDIA_ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'] as const;

export interface PersistedWorkoutExerciseMediaItem extends UserExerciseMedia {
  kind: 'image' | 'video';
  previewUrl: string;
}

export interface SaveWorkoutExerciseMediaDraftsInput {
  exerciseId: string;
  workoutEntryId?: string | null;
  workoutDate?: string | null;
  files: File[];
}

export interface UserExerciseMediaGateway {
  getSessionUserId(): Promise<string>;
  listMediaRows(userId: string, workoutEntryId: string): Promise<UserExerciseMedia[]>;
  uploadFile(path: string, file: File): Promise<void>;
  insertMediaRows(rows: Array<{
    user_id: string;
    exercise_id: string;
    workout_entry_id?: string | null;
    workout_date?: string | null;
    file_path: string;
    file_type: 'image' | 'video';
  }>): Promise<void>;
  deleteMediaRow(mediaId: string): Promise<void>;
  restoreMediaRow(row: UserExerciseMedia): Promise<void>;
  createSignedUrl(path: string, expiresIn: number): Promise<string>;
  removeFiles(paths: string[]): Promise<void>;
}

export function getUserExerciseMediaFileKind(file: Pick<File, 'type'>): 'image' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'image';
}

export function buildUserExerciseMediaStoragePath(userId: string, exerciseId: string, file: Pick<File, 'name'>): string {
  const safeExtension = (() => {
    const raw = file.name.split('.').pop()?.trim().toLowerCase();
    return raw ? `.${raw.replace(/[^a-z0-9]/g, '')}` : '';
  })();

  return `${userId}/${exerciseId}/${crypto.randomUUID()}${safeExtension}`;
}

export async function mapPersistedWorkoutExerciseMediaItems(
  rows: UserExerciseMedia[],
  createSignedUrl: (path: string) => Promise<string>,
): Promise<PersistedWorkoutExerciseMediaItem[]> {
  const signed = await Promise.all(
    rows.map(async (row) => ({
      row,
      signedUrl: await createSignedUrl(row.file_path),
    })),
  );

  return signed
    .map(({ row, signedUrl }) => ({
      ...row,
      kind: row.file_type,
      previewUrl: signedUrl,
    }))
    .filter((item) => item.previewUrl !== '');
}

export function toUserExerciseMediaErrorMessage(mode: 'save' | 'load'): string {
  return mode === 'save' ? 'Не удалось сохранить файлы' : 'Не удалось загрузить сохранённые файлы';
}

export function validateMediaFile(file: Pick<File, 'type' | 'size'>): void {
  if (file.type.startsWith('image/')) {
    if (!USER_EXERCISE_MEDIA_ALLOWED_IMAGE_TYPES.includes(file.type as (typeof USER_EXERCISE_MEDIA_ALLOWED_IMAGE_TYPES)[number])) {
      throw new Error('Неподдерживаемый формат файла');
    }

    if (file.size > USER_EXERCISE_MEDIA_MAX_IMAGE_BYTES) {
      throw new Error('Файл слишком большой');
    }

    return;
  }

  if (file.type.startsWith('video/')) {
    if (!USER_EXERCISE_MEDIA_ALLOWED_VIDEO_TYPES.includes(file.type as (typeof USER_EXERCISE_MEDIA_ALLOWED_VIDEO_TYPES)[number])) {
      throw new Error('Неподдерживаемый формат файла');
    }

    if (file.size > USER_EXERCISE_MEDIA_MAX_VIDEO_BYTES) {
      throw new Error('Файл слишком большой');
    }

    return;
  }

  throw new Error('Неподдерживаемый формат файла');
}

function getUploadTimeoutMs(file: Pick<File, 'type'>): number {
  return file.type.startsWith('video/')
    ? USER_EXERCISE_MEDIA_VIDEO_UPLOAD_TIMEOUT_MS
    : USER_EXERCISE_MEDIA_IMAGE_UPLOAD_TIMEOUT_MS;
}

function isPreservedUserExerciseMediaErrorMessage(message: string): boolean {
  return message === 'Файл слишком большой'
    || message === 'Неподдерживаемый формат файла'
    || message.includes('не более 9');
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sortPersistedItems(items: PersistedWorkoutExerciseMediaItem[]): PersistedWorkoutExerciseMediaItem[] {
  return items.slice().sort((a, b) => {
    const byDate = b.created_at.localeCompare(a.created_at);
    if (byDate !== 0) return byDate;
    return b.file_path.localeCompare(a.file_path);
  });
}

function mergePersistedItems(
  existing: PersistedWorkoutExerciseMediaItem[],
  added: PersistedWorkoutExerciseMediaItem[],
): PersistedWorkoutExerciseMediaItem[] {
  const byPath = new Map<string, PersistedWorkoutExerciseMediaItem>();
  [...existing, ...added].forEach((item) => byPath.set(item.file_path, item));
  return sortPersistedItems(Array.from(byPath.values()));
}

class SupabaseUserExerciseMediaGateway implements UserExerciseMediaGateway {
  async getSessionUserId(): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    return data.user.id;
  }

  async listMediaRows(_userId: string, workoutEntryId: string): Promise<UserExerciseMedia[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase
      .from('user_exercise_media')
      .select('id, user_id, exercise_id, workout_entry_id, workout_date, file_path, file_type, created_at')
      .eq('workout_entry_id', workoutEntryId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Не удалось загрузить медиа упражнения');
    }

    return (data ?? []) as UserExerciseMedia[];
  }

  async uploadFile(path: string, file: File): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase.storage
      .from(USER_EXERCISE_MEDIA_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (error) {
      throw new Error(error.message || 'Не удалось загрузить файл');
    }
  }

  async insertMediaRows(rows: Array<{
    user_id: string;
    exercise_id: string;
    workout_entry_id?: string | null;
    workout_date?: string | null;
    file_path: string;
    file_type: 'image' | 'video';
  }>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase.from('user_exercise_media').insert(rows);
    if (error) {
      throw new Error(error.message || 'Не удалось сохранить медиа упражнения');
    }
  }

  async deleteMediaRow(mediaId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase.from('user_exercise_media').delete().eq('id', mediaId);
    if (error) {
      throw new Error(error.message || 'Не удалось удалить медиа упражнения');
    }
  }

  async restoreMediaRow(row: UserExerciseMedia): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase.from('user_exercise_media').insert({
      id: row.id,
      user_id: row.user_id,
      exercise_id: row.exercise_id,
      workout_entry_id: row.workout_entry_id ?? null,
      workout_date: row.workout_date ?? null,
      file_path: row.file_path,
      file_type: row.file_type,
      created_at: row.created_at,
    });

    if (error) {
      throw new Error(error.message || 'Не удалось восстановить запись медиа');
    }
  }

  async createSignedUrl(path: string, expiresIn: number): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.storage
      .from(USER_EXERCISE_MEDIA_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Не удалось подписать ссылку на медиа');
    }

    return data.signedUrl;
  }

  async removeFiles(paths: string[]): Promise<void> {
    if (!supabase || paths.length === 0) {
      return;
    }

    const { error } = await supabase.storage.from(USER_EXERCISE_MEDIA_BUCKET).remove(paths);
    if (error) {
      throw new Error(error.message || 'Не удалось удалить медиа из storage');
    }
  }
}

export class UserExerciseMediaService {
  private readonly persistedCache = new Map<string, PersistedWorkoutExerciseMediaItem[]>();

  constructor(private readonly gateway: UserExerciseMediaGateway) {}

  getCachedWorkoutExerciseMedia(workoutEntryId: string): PersistedWorkoutExerciseMediaItem[] {
    return this.getCachedItems(workoutEntryId);
  }

  private getCachedItems(workoutEntryId: string): PersistedWorkoutExerciseMediaItem[] {
    return this.persistedCache.get(workoutEntryId) ?? [];
  }

  private setCachedItems(workoutEntryId: string, items: PersistedWorkoutExerciseMediaItem[]): PersistedWorkoutExerciseMediaItem[] {
    const merged = mergePersistedItems(this.getCachedItems(workoutEntryId), items);
    this.persistedCache.set(workoutEntryId, merged);
    return merged;
  }

  async listWorkoutExerciseMedia(workoutEntryId: string): Promise<PersistedWorkoutExerciseMediaItem[]> {
    try {
      const userId = await withTimeout(
        this.gateway.getSessionUserId(),
        USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
        'user media session timeout',
      );
      const rows = await withTimeout(
        this.gateway.listMediaRows(userId, workoutEntryId),
        USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
        'user media list timeout',
      );
      const mapped = await withTimeout(
        mapPersistedWorkoutExerciseMediaItems(
          rows,
          (path) => this.gateway.createSignedUrl(path, USER_EXERCISE_MEDIA_SIGNED_URL_TTL_SECONDS),
        ),
        USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
        'user media signed urls timeout',
      );
      if (mapped.length === 0) {
        return this.getCachedItems(workoutEntryId);
      }
      return this.setCachedItems(workoutEntryId, sortPersistedItems(mapped));
    } catch {
      const cached = this.getCachedItems(workoutEntryId);
      if (cached.length > 0) {
        return cached;
      }
      throw new Error(toUserExerciseMediaErrorMessage('load'));
    }
  }



  async deleteWorkoutExerciseMedia(
    item: Pick<UserExerciseMedia, 'id' | 'user_id' | 'exercise_id' | 'workout_entry_id' | 'workout_date' | 'file_path' | 'file_type' | 'created_at'>,
  ): Promise<PersistedWorkoutExerciseMediaItem[]> {
    try {
      await withTimeout(this.gateway.deleteMediaRow(item.id), USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS, 'user media delete row timeout');

      try {
        await withTimeout(this.gateway.removeFiles([item.file_path]), USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS, 'user media delete file timeout');
      } catch (error) {
        console.error('[userExerciseMediaService] persisted media storage delete failed after db delete', {
          mediaId: item.id,
          filePath: item.file_path,
          exerciseId: item.exercise_id,
          error,
        });

        try {
          await withTimeout(this.gateway.restoreMediaRow(item), USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS, 'user media restore row timeout');
        } catch (restoreError) {
          console.error('[userExerciseMediaService] failed to restore media row after storage delete error', {
            mediaId: item.id,
            filePath: item.file_path,
            exerciseId: item.exercise_id,
            restoreError,
          });
        }

        throw new Error('Не удалось удалить файл');
      }

      const cacheKey = item.workout_entry_id ?? item.exercise_id;
      const next = this.getCachedItems(cacheKey).filter((current) => current.id !== item.id);
      this.persistedCache.set(cacheKey, next);
      return next;
    } catch {
      throw new Error('Не удалось удалить файл');
    }
  }

  async saveWorkoutExerciseMediaDrafts(input: SaveWorkoutExerciseMediaDraftsInput): Promise<PersistedWorkoutExerciseMediaItem[]> {
    if (!input.workoutEntryId) {
      throw new Error(toUserExerciseMediaErrorMessage('save'));
    }

    if (input.files.length === 0) {
      return this.listWorkoutExerciseMedia(input.workoutEntryId);
    }

    let userId = '';
    let existing: UserExerciseMedia[] = [];

    try {
      userId = await withTimeout(
        this.gateway.getSessionUserId(),
        USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
        'user media session timeout',
      );
      existing = await withTimeout(
        this.gateway.listMediaRows(userId, input.workoutEntryId),
        USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
        'user media list timeout',
      );

      if (existing.length + input.files.length > 9) {
        throw new Error('Можно сохранить не более 9 фото/видео для одного упражнения');
      }

      const uploadPlan = input.files.map((file) => ({
        file,
        path: buildUserExerciseMediaStoragePath(userId, input.exerciseId, file),
        file_type: getUserExerciseMediaFileKind(file),
      }));

      uploadPlan.forEach((item) => validateMediaFile(item.file));

      const uploadedPaths: string[] = [];
      try {
        for (const item of uploadPlan) {
          try {
            await withTimeout(
              this.gateway.uploadFile(item.path, item.file),
              getUploadTimeoutMs(item.file),
              'user media upload timeout',
            );
          } catch (error) {
            console.error('[userExerciseMediaService] upload failed', {
              exerciseId: input.exerciseId,
              path: item.path,
              fileType: item.file.type,
              fileKind: item.file_type,
              fileSize: item.file.size,
              error,
            });
            throw error;
          }
          uploadedPaths.push(item.path);
        }

        await withTimeout(
          this.gateway.insertMediaRows(
            uploadPlan.map((item) => ({
              user_id: userId,
              exercise_id: input.exerciseId,
              workout_entry_id: input.workoutEntryId ?? null,
              workout_date: input.workoutDate ?? null,
              file_path: item.path,
              file_type: item.file_type,
            })),
          ),
          USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
          'user media insert timeout',
        );
      } catch (error) {
        try {
          await withTimeout(
            this.gateway.removeFiles(uploadedPaths),
            USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
            'user media cleanup timeout',
          );
        } catch {
          // cleanup best-effort only
        }
        throw error;
      }

      const insertedRows: UserExerciseMedia[] = uploadPlan.map((item, index) => ({
        id: `persisted-${index}-${item.path}`,
        user_id: userId,
        exercise_id: input.exerciseId,
        workout_entry_id: input.workoutEntryId ?? null,
        workout_date: input.workoutDate ?? null,
        file_path: item.path,
        file_type: item.file_type,
        created_at: new Date(Date.now() - index).toISOString(),
      }));

      const insertedItems = this.setCachedItems(
        input.workoutEntryId,
        await withTimeout(
          mapPersistedWorkoutExerciseMediaItems(
            insertedRows,
            (path) => this.gateway.createSignedUrl(path, USER_EXERCISE_MEDIA_SIGNED_URL_TTL_SECONDS),
          ),
          USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
          'user media signed urls timeout',
        ),
      );

      try {
        const reloaded = await this.listWorkoutExerciseMedia(input.workoutEntryId);
        return this.setCachedItems(input.workoutEntryId, sortPersistedItems(reloaded));
      } catch {
        return this.setCachedItems(
          input.workoutEntryId,
          mergePersistedItems(
            await withTimeout(
              mapPersistedWorkoutExerciseMediaItems(
                existing,
                (path) => this.gateway.createSignedUrl(path, USER_EXERCISE_MEDIA_SIGNED_URL_TTL_SECONDS),
              ),
              USER_EXERCISE_MEDIA_REQUEST_TIMEOUT_MS,
              'user media signed urls timeout',
            ),
            insertedItems,
          ),
        );
      }
    } catch (error) {
      if (error instanceof Error && isPreservedUserExerciseMediaErrorMessage(error.message)) {
        throw error;
      }
      throw new Error(toUserExerciseMediaErrorMessage('save'));
    }
  }
}

export const userExerciseMediaService = new UserExerciseMediaService(new SupabaseUserExerciseMediaGateway());
