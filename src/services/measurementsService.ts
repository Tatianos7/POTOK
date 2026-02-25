import { supabase } from '../lib/supabaseClient';
import { formatUiDay, parseLegacyDay, toIsoDay } from '../utils/dateKey';

export interface Measurement {
  id: string;
  name: string;
  value: string;
}

export interface MeasurementHistory {
  id: string;
  date: string; // ISO day key: YYYY-MM-DD
  measurements: Measurement[];
  photos: string[];
  additionalPhotos: string[];
}

export interface PhotoHistory {
  id: string;
  date: string; // ISO day key: YYYY-MM-DD
  photos: string[];
  additionalPhotos: string[];
  _pending?: boolean; // UI-only flag, never persisted
  _uploadError?: boolean; // UI-only flag, never persisted
}

type PhotoUploadStatus = 'idle' | 'uploading' | 'done' | 'error';

type PhotoUploadTask = {
  key: string;
  payload: {
    userId: string;
    day: string;
    id: string;
    photos: string[];
    additionalPhotos: string[];
  };
  status: PhotoUploadStatus;
  promise: Promise<void> | null;
};

type MeasurementPhotoSlot = 'main_1' | 'main_2' | 'main_3' | 'extra_1' | 'extra_2' | 'extra_3';
type MeasurementPhotoAssetRow = {
  id: string;
  day: string;
  slot: MeasurementPhotoSlot;
  storage_path: string;
  thumb_path: string | null;
};
type PhotoReadResult = {
  rows: PhotoHistory[];
  failed: boolean;
};
type LegacyProbeCacheEntry = {
  days: string[];
  ts: number;
};
type DeletedPhotoDaysCacheEntry = {
  set: Set<string>;
  ts: number;
};
type LegacyCleanupQueueItem = {
  day: string;
  attempts: number;
  nextTs: number;
};

class MeasurementsService {
  private readonly MEASUREMENTS_STORAGE_KEY = 'potok_measurements';
  private readonly HISTORY_STORAGE_KEY = 'potok_measurement_history';
  private readonly HISTORY_DAY_SUPPORT_KEY = 'potok_measurements_day_support';
  private readonly LOCAL_PHOTO_TOMBSTONES_KEY = 'potok_photo_local_tombstones';
  private readonly LEGACY_CLEANUP_QUEUE_KEY = 'potok_photo_legacy_cleanup';
  private readonly CROSS_TAB_EVENT_KEY = 'potok_cross_tab_event';
  private readonly CROSS_TAB_CHANNEL = 'potok';
  private readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private readonly measurementHistoryCache = new Map<string, MeasurementHistory[]>();
  private readonly photoHistoryCache = new Map<string, PhotoHistory[]>();
  private readonly currentPhotosCache = new Map<string, { photos: string[]; additionalPhotos: string[] }>();
  private readonly blockedLocalStorageBuckets = new Set<string>();
  private readonly photoUploadTasks = new Map<string, PhotoUploadTask>();
  private readonly cancelledPhotoUploadKeys = new Set<string>();
  private readonly legacyPhotoProbeCache = new Map<string, LegacyProbeCacheEntry>();
  private readonly deletedPhotoDaysCache = new Map<string, DeletedPhotoDaysCacheEntry>();
  private readonly PHOTO_BUCKET = 'measurements-photos';
  private readonly PHOTO_SIGNED_TTL_SECONDS = 60 * 60;
  private readonly LEGACY_PROBE_TTL_MS = 5 * 60 * 1000;
  private readonly DELETED_DAYS_TTL_MS = 5 * 60 * 1000;
  private deletionsFeatureUnsupported = false;
  private deletionsFeatureWarned = false;

  private toSafeError(error: unknown): { code: string; name: string; message: string } {
    if (!error || typeof error !== 'object') {
      return {
        code: '',
        name: '',
        message: String(error ?? 'unknown_error').slice(0, 180),
      };
    }
    const code = String((error as { code?: unknown }).code ?? '').slice(0, 40);
    const name = String((error as { name?: unknown }).name ?? '').slice(0, 40);
    const message = String((error as { message?: unknown }).message ?? '').slice(0, 180);
    return { code, name, message };
  }

  private logWarn(message: string, error?: unknown): void {
    if (error === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, this.toSafeError(error));
  }

  private logError(message: string, error?: unknown): void {
    if (error === undefined) {
      console.error(message);
      return;
    }
    console.error(message, this.toSafeError(error));
  }

  private async getSessionUserId(userId?: string): Promise<string | null> {
    if (userId && userId.trim().length > 0) {
      return userId;
    }

    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      return null;
    }

    return data.user.id;
  }

  private normalizeHistoryDay(value: unknown): string {
    if (typeof value !== 'string') return '';
    const parsed = parseLegacyDay(value);
    return parsed ?? '';
  }

  private getDaySupportCacheKey(
    table: 'measurement_history' | 'measurement_photo_history',
    userId: string
  ): string {
    return `${this.HISTORY_DAY_SUPPORT_KEY}_${table}_${userId}`;
  }

  private readDaySupport(
    table: 'measurement_history' | 'measurement_photo_history',
    userId: string
  ): boolean | null {
    try {
      const raw = localStorage.getItem(this.getDaySupportCacheKey(table, userId));
      if (raw === '1') return true;
      if (raw === '0') return false;
      return null;
    } catch {
      return null;
    }
  }

  private safeSetLocalStorage(key: string, value: string, bucket: string): void {
    if (this.blockedLocalStorageBuckets.has(bucket)) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      this.blockedLocalStorageBuckets.add(bucket);
      const reason = error instanceof Error ? error.name : 'storage_error';
      console.warn(`[measurementsService] localStorage disabled for "${bucket}" (${reason})`);
    }
  }

  private writeDaySupport(
    table: 'measurement_history' | 'measurement_photo_history',
    userId: string,
    supported: boolean
  ): void {
    this.safeSetLocalStorage(
      this.getDaySupportCacheKey(table, userId),
      supported ? '1' : '0',
      'day-support'
    );
  }

  private isDaySchemaError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = String((error as { code?: string }).code ?? '');
    const message = String((error as { message?: string }).message ?? '').toLowerCase();
    const details = String((error as { details?: string }).details ?? '').toLowerCase();
    const hint = String((error as { hint?: string }).hint ?? '').toLowerCase();
    if (code === '42703' || code === '42P10' || code === 'PGRST204') return true;
    return (
      message.includes('day') ||
      details.includes('day') ||
      hint.includes('day') ||
      message.includes('on conflict')
    );
  }

  private isMissingTableError(error: unknown, tableName: string): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = String((error as { code?: string }).code ?? '');
    const message = String((error as { message?: string }).message ?? '').toLowerCase();
    const details = String((error as { details?: string }).details ?? '').toLowerCase();
    return (
      code === 'PGRST205' ||
      code === 'PGRST204' ||
      message.includes('does not exist') ||
      message.includes('not found') ||
      message.includes(tableName.toLowerCase()) ||
      details.includes(tableName.toLowerCase())
    );
  }

  private invalidatePhotoReadCaches(userId: string): void {
    this.legacyPhotoProbeCache.delete(userId);
    this.deletedPhotoDaysCache.delete(userId);
  }

  private getLocalPhotoTombstonesKey(userId: string): string {
    return `${this.LOCAL_PHOTO_TOMBSTONES_KEY}_${userId}`;
  }

  private readLocalPhotoTombstones(userId: string): Set<string> {
    try {
      const raw = localStorage.getItem(this.getLocalPhotoTombstonesKey(userId));
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return new Set<string>();
      return new Set(
        parsed
          .map((value) => this.normalizeHistoryDay(value))
          .filter((day): day is string => day.length > 0)
      );
    } catch {
      return new Set<string>();
    }
  }

  private writeLocalPhotoTombstones(userId: string, tombstones: Set<string>): void {
    this.safeSetLocalStorage(
      this.getLocalPhotoTombstonesKey(userId),
      JSON.stringify(Array.from(tombstones).sort()),
      'photo-local-tombstones'
    );
  }

  private addLocalPhotoTombstone(userId: string, day: string): void {
    const isoDay = this.normalizeHistoryDay(day) || day;
    if (!isoDay) return;
    const tombstones = this.readLocalPhotoTombstones(userId);
    tombstones.add(isoDay);
    this.writeLocalPhotoTombstones(userId, tombstones);
  }

  private removeLocalPhotoTombstone(userId: string, day: string): void {
    const isoDay = this.normalizeHistoryDay(day) || day;
    if (!isoDay) return;
    const tombstones = this.readLocalPhotoTombstones(userId);
    if (!tombstones.delete(isoDay)) return;
    this.writeLocalPhotoTombstones(userId, tombstones);
  }

  private getLegacyCleanupQueueKey(userId: string): string {
    return `${this.LEGACY_CLEANUP_QUEUE_KEY}_${userId}`;
  }

  private readLegacyCleanupQueue(userId: string): LegacyCleanupQueueItem[] {
    try {
      const raw = localStorage.getItem(this.getLegacyCleanupQueueKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          const day = this.normalizeHistoryDay((item as { day?: unknown }).day);
          const attempts = Number((item as { attempts?: unknown }).attempts ?? 0);
          const nextTs = Number((item as { nextTs?: unknown }).nextTs ?? 0);
          if (!day) return null;
          return {
            day,
            attempts: Number.isFinite(attempts) ? Math.max(0, Math.floor(attempts)) : 0,
            nextTs: Number.isFinite(nextTs) ? Math.max(0, Math.floor(nextTs)) : 0,
          } as LegacyCleanupQueueItem;
        })
        .filter((item): item is LegacyCleanupQueueItem => item !== null);
    } catch {
      return [];
    }
  }

  private writeLegacyCleanupQueue(userId: string, queue: LegacyCleanupQueueItem[]): void {
    this.safeSetLocalStorage(
      this.getLegacyCleanupQueueKey(userId),
      JSON.stringify(queue),
      'photo-legacy-cleanup'
    );
  }

  private nextLegacyCleanupDelayMs(attempts: number): number {
    const schedule = [5_000, 30_000, 120_000, 600_000];
    const index = Math.min(Math.max(attempts, 0), schedule.length - 1);
    return schedule[index];
  }

  private enqueueLegacyCleanup(userId: string, day: string): void {
    const isoDay = this.normalizeHistoryDay(day) || day;
    if (!isoDay) return;
    const queue = this.readLegacyCleanupQueue(userId);
    const now = Date.now();
    const existing = queue.find((item) => item.day === isoDay);
    if (existing) {
      existing.nextTs = Math.min(existing.nextTs, now);
    } else {
      queue.push({ day: isoDay, attempts: 0, nextTs: now });
    }
    this.writeLegacyCleanupQueue(userId, queue);
  }

  private removeLegacyCleanupQueueEntry(userId: string, day: string): void {
    const isoDay = this.normalizeHistoryDay(day) || day;
    if (!isoDay) return;
    const queue = this.readLegacyCleanupQueue(userId);
    const next = queue.filter((item) => item.day !== isoDay);
    if (next.length === queue.length) return;
    this.writeLegacyCleanupQueue(userId, next);
  }

  private async processLegacyCleanupQueue(userId: string): Promise<void> {
    if (!supabase) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    const queue = this.readLegacyCleanupQueue(sessionUserId);
    if (queue.length === 0) return;

    const now = Date.now();
    const nextQueue: LegacyCleanupQueueItem[] = [];

    for (const item of queue) {
      if (item.nextTs > now) {
        nextQueue.push(item);
        continue;
      }

      try {
        await this.deleteLegacyPhotoHistoryDay(sessionUserId, item.day);
      } catch (error) {
        const attempts = item.attempts + 1;
        const delayMs = this.nextLegacyCleanupDelayMs(item.attempts);
        nextQueue.push({
          day: item.day,
          attempts,
          nextTs: now + delayMs,
        });
        if (import.meta.env.DEV) {
          this.logWarn('[measurementsService] legacy cleanup retry deferred', {
            ...this.toSafeError(error),
            attempts,
            nextInMs: delayMs,
            day: item.day,
          });
        }
      }
    }

    this.writeLegacyCleanupQueue(sessionUserId, nextQueue);
  }

  private publishPhotoDayDeleted(userId: string, day: string): void {
    const payload = {
      type: 'photo_day_deleted',
      userId,
      day,
      ts: Date.now(),
    };

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(this.CROSS_TAB_CHANNEL);
        channel.postMessage(payload);
        channel.close();
      } catch {
        // no-op fallback below
      }
    }

    this.safeSetLocalStorage(
      this.CROSS_TAB_EVENT_KEY,
      JSON.stringify(payload),
      'cross-tab'
    );
  }

  private disableDeletionsFeature(): void {
    this.deletionsFeatureUnsupported = true;
    if (!this.deletionsFeatureWarned && import.meta.env.DEV) {
      console.warn('[measurementsService] photo deletions feature unavailable, continuing without tombstones');
    }
    this.deletionsFeatureWarned = true;
  }

  private getEntryIsoDay(entry: Pick<MeasurementHistory, 'date'> | Pick<PhotoHistory, 'date'>): string {
    return this.normalizeHistoryDay(entry.date) || toIsoDay(new Date());
  }

  private makeUuid(value?: string): string {
    if (value && this.UUID_RE.test(value)) return value;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    const a = hex();
    const b = hex().slice(0, 4);
    const c = `4${hex().slice(1, 4)}`;
    const d = `${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex().slice(1, 4)}`;
    const e = `${hex()}${hex().slice(0, 4)}`;
    return `${a}-${b}-${c}-${d}-${e}`;
  }

  getMeasurementHistoryCache(userId: string): MeasurementHistory[] | null {
    const cached = this.measurementHistoryCache.get(userId);
    return cached ? [...cached] : null;
  }

  getMeasurementsHistoryCache(userId: string): MeasurementHistory[] | null {
    return this.getMeasurementHistoryCache(userId);
  }

  setMeasurementHistoryCache(userId: string, history: MeasurementHistory[]): void {
    this.measurementHistoryCache.set(userId, [...history]);
  }

  setMeasurementsHistoryCache(userId: string, history: MeasurementHistory[]): void {
    this.setMeasurementHistoryCache(userId, history);
  }

  getPhotoHistoryCache(userId: string): PhotoHistory[] | null {
    const cached = this.photoHistoryCache.get(userId);
    return cached ? [...cached] : null;
  }

  setPhotoHistoryCache(userId: string, history: PhotoHistory[]): void {
    this.photoHistoryCache.set(userId, [...history]);
  }

  protectPendingDaysFromServer(serverRows: PhotoHistory[], cachedRows: PhotoHistory[]): PhotoHistory[] {
    const pendingByDay = new Map<string, PhotoHistory>();
    for (const row of cachedRows) {
      const day = this.normalizeHistoryDay(row.date) || row.date;
      if (row._pending) {
        pendingByDay.set(day, row);
      }
    }

    if (pendingByDay.size === 0) {
      return serverRows;
    }

    const merged = serverRows.map((row) => {
      const day = this.normalizeHistoryDay(row.date) || row.date;
      return pendingByDay.get(day) ?? row;
    });

    for (const [day, pendingRow] of pendingByDay.entries()) {
      if (!merged.some((row) => (this.normalizeHistoryDay(row.date) || row.date) === day)) {
        merged.push(pendingRow);
      }
    }

    return merged;
  }

  private makePhotoUploadTaskKey(userId: string, day: string): string {
    return `${userId}:${this.normalizeHistoryDay(day) || day}`;
  }

  private getSlotForIndex(group: 'main' | 'extra', index: number): MeasurementPhotoSlot {
    if (group === 'main') {
      return (`main_${Math.min(index + 1, 3)}`) as MeasurementPhotoSlot;
    }
    return (`extra_${Math.min(index + 1, 3)}`) as MeasurementPhotoSlot;
  }

  private getSlotSortIndex(slot: MeasurementPhotoSlot): number {
    const order: MeasurementPhotoSlot[] = ['main_1', 'main_2', 'main_3', 'extra_1', 'extra_2', 'extra_3'];
    return order.indexOf(slot);
  }

  private async sourceToBlob(source: string): Promise<Blob> {
    const response = await fetch(source);
    return response.blob();
  }

  private async compressImageBlob(source: Blob, maxSide: number, quality: number): Promise<Blob> {
    if (typeof document === 'undefined') return source;

    const objectUrl = URL.createObjectURL(source);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image_decode_failed'));
        img.src = objectUrl;
      });

      const longSide = Math.max(image.width, image.height) || 1;
      const scale = Math.min(1, maxSide / longSide);
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return source;
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
      });
      return blob ?? source;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private async uploadAssetForSlot(params: {
    sessionUserId: string;
    day: string;
    slot: MeasurementPhotoSlot;
    source: string;
  }): Promise<{ storagePath: string; thumbPath: string }> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const originalBlob = await this.sourceToBlob(params.source);
    const mainBlob = await this.compressImageBlob(originalBlob, 1280, 0.8);
    const thumbBlob = await this.compressImageBlob(originalBlob, 320, 0.7);
    const basePath = `user/${params.sessionUserId}/measurements/${params.day}`;
    const storagePath = `${basePath}/${params.slot}.jpg`;
    const thumbPath = `${basePath}/thumb_${params.slot}.jpg`;

    const storageApi = supabase.storage.from(this.PHOTO_BUCKET);
    const [mainUpload, thumbUpload] = await Promise.all([
      storageApi.upload(storagePath, mainBlob, {
        upsert: true,
        contentType: 'image/jpeg',
      }),
      storageApi.upload(thumbPath, thumbBlob, {
        upsert: true,
        contentType: 'image/jpeg',
      }),
    ]);

    if (mainUpload.error) throw mainUpload.error;
    if (thumbUpload.error) throw thumbUpload.error;

    return { storagePath, thumbPath };
  }

  private async upsertPhotoAssetsForDay(params: {
    sessionUserId: string;
    day: string;
    photos: string[];
    additionalPhotos: string[];
  }): Promise<void> {
    if (!supabase) return;

    const mainEntries = params.photos
      .slice(0, 3)
      .filter((source) => source !== '')
      .map((source, index) => ({
        slot: this.getSlotForIndex('main', index),
        source,
      }));
    const extraEntries = params.additionalPhotos
      .slice(0, 3)
      .filter((source) => source !== '')
      .map((source, index) => ({
        slot: this.getSlotForIndex('extra', index),
        source,
      }));
    const entries = [...mainEntries, ...extraEntries];

    const uploaded = await Promise.all(
      entries.map(async (entry) => {
        const { storagePath, thumbPath } = await this.uploadAssetForSlot({
          sessionUserId: params.sessionUserId,
          day: params.day,
          slot: entry.slot,
          source: entry.source,
        });
        return {
          user_id: params.sessionUserId,
          day: params.day,
          slot: entry.slot,
          storage_path: storagePath,
          thumb_path: thumbPath,
          updated_at: new Date().toISOString(),
        };
      })
    );

    if (uploaded.length > 0) {
      const { error: upsertError } = await supabase
        .from('measurement_photo_assets')
        .upsert(uploaded, { onConflict: 'user_id,day,slot' });
      if (upsertError) throw upsertError;
    }

    const keepSlots = uploaded.map((row) => row.slot);
    const { data: existingRows, error: existingError } = await supabase
      .from('measurement_photo_assets')
      .select('id, slot')
      .eq('user_id', params.sessionUserId)
      .eq('day', params.day);
    if (existingError) throw existingError;

    const removeIds =
      (existingRows ?? [])
        .filter((row) => !keepSlots.includes(row.slot as MeasurementPhotoSlot))
        .map((row) => row.id);

    if (removeIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('measurement_photo_assets')
        .delete()
        .in('id', removeIds);
      if (deleteError) throw deleteError;
    }
  }

  replacePhotoHistoryDay(
    history: PhotoHistory[],
    day: string,
    patch: Partial<PhotoHistory> & Pick<PhotoHistory, 'id' | 'date'>
  ): PhotoHistory[] {
    const isoDay = this.normalizeHistoryDay(day);
    const normalizedDay = isoDay || day;
    const nextEntry: PhotoHistory = {
      id: patch.id,
      date: this.normalizeHistoryDay(patch.date) || normalizedDay,
      photos: patch.photos ?? [],
      additionalPhotos: patch.additionalPhotos ?? [],
      _pending: patch._pending,
      _uploadError: patch._uploadError,
    };

    return [nextEntry, ...history.filter((entry) => this.normalizeHistoryDay(entry.date) !== normalizedDay)];
  }

  private async fetchHistoryRows(
    table: 'measurement_history' | 'measurement_photo_history',
    sessionUserId: string,
    limit: number
  ): Promise<{ data: any[] | null; error: unknown | null }> {
    const client = supabase;
    if (!client) {
      return { data: null, error: new Error('Supabase не инициализирован') };
    }

    const daySupport = this.readDaySupport(table, sessionUserId);
    if (daySupport !== false) {
      const byDay = await client
        .from(table)
        .select('*')
        .eq('user_id', sessionUserId)
        .order('day', { ascending: false })
        .limit(limit);

      if (!byDay.error) {
        this.writeDaySupport(table, sessionUserId, true);
        return { data: byDay.data as any[], error: null };
      }

      if (this.isDaySchemaError(byDay.error)) {
        this.writeDaySupport(table, sessionUserId, false);
      } else {
        return { data: null, error: byDay.error };
      }
    }

    const byLegacyDate = await client
      .from(table)
      .select('*')
      .eq('user_id', sessionUserId)
      .order('date', { ascending: false })
      .limit(limit);

    if (!byLegacyDate.error) {
      this.writeDaySupport(table, sessionUserId, false);
    }

    return { data: byLegacyDate.data as any[], error: byLegacyDate.error };
  }

  async getCurrentMeasurements(userId: string): Promise<Measurement[]> {
    const emptyMeasurements: Measurement[] = [
      { id: 'weight', name: 'ВЕС', value: '0' },
      { id: 'neck', name: 'ШЕЯ', value: '0' },
      { id: 'shoulders', name: 'ПЛЕЧИ', value: '0' },
      { id: 'chest', name: 'ГРУДЬ', value: '0' },
      { id: 'back', name: 'СПИНА', value: '0' },
    ];

    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) {
      return emptyMeasurements;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_measurements')
          .select('measurements')
          .eq('user_id', sessionUserId)
          .maybeSingle();

        if (error) {
          if (error.code !== 'PGRST116') {
            this.logError('[measurementsService] Supabase error', error);
          }
        } else if (data && data.measurements) {
          const measurements: Measurement[] = data.measurements as Measurement[];
          this.saveMeasurementsToLocalStorage(sessionUserId, measurements);
          return measurements;
        }
      } catch (err) {
        this.logError('[measurementsService] Supabase connection error', err);
      }
    }

    try {
      const stored = localStorage.getItem(`${this.MEASUREMENTS_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      this.logError('[measurementsService] Error loading from localStorage', error);
    }

    return emptyMeasurements;
  }

  async saveCurrentMeasurements(
    userId: string,
    measurements: Measurement[],
    photos: string[],
    additionalPhotos: string[]
  ): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    if (supabase) {
      try {
        const preparedPhotos = photos.filter((p) => p !== '');
        const preparedAdditional = additionalPhotos.filter((p) => p !== '');
        const { error } = await supabase.from('user_measurements').upsert(
          {
            user_id: sessionUserId,
            measurements,
            photos: preparedPhotos,
            additional_photos: preparedAdditional,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

        if (error) {
          this.logError('[measurementsService] Supabase save error', error);
        }

        this.currentPhotosCache.set(sessionUserId, {
          photos: preparedPhotos,
          additionalPhotos: preparedAdditional,
        });
        this.saveMeasurementsToLocalStorage(sessionUserId, measurements);
      } catch (err) {
        this.logError('[measurementsService] Supabase save connection error', err);
      }
    }
  }

  async saveCurrentPhotos(
    userId: string,
    photos: string[],
    additionalPhotos: string[]
  ): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    if (!supabase) return;
    try {
      const preparedPhotos = photos.filter((p) => p !== '');
      const preparedAdditional = additionalPhotos.filter((p) => p !== '');

      const { error } = await supabase
        .from('user_measurements')
        .upsert(
          {
            user_id: sessionUserId,
            photos: preparedPhotos,
            additional_photos: preparedAdditional,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        this.logError('[measurementsService] Supabase save photos error', error);
      }

      this.currentPhotosCache.set(sessionUserId, {
        photos: preparedPhotos,
        additionalPhotos: preparedAdditional,
      });
    } catch (err) {
      this.logError('[measurementsService] Supabase save photos connection error', err);
    }
  }

  async saveCurrentMeasurementsValues(userId: string, measurements: Measurement[]): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    if (!supabase) return;
    try {
      const { error } = await supabase.from('user_measurements').upsert(
        {
          user_id: sessionUserId,
          measurements,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

      if (error) {
        this.logError('[measurementsService] Supabase save values error', error);
      }
      this.saveMeasurementsToLocalStorage(sessionUserId, measurements);
    } catch (err) {
      this.logError('[measurementsService] Supabase save values connection error', err);
    }
  }

  async getCurrentPhotos(userId: string): Promise<{ photos: string[]; additionalPhotos: string[] }> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) {
      return { photos: ['', '', ''], additionalPhotos: [] };
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_measurements')
          .select('photos, additional_photos')
          .eq('user_id', sessionUserId)
          .maybeSingle();

        if (error) {
          if (error.code !== 'PGRST116') {
            this.logError('[measurementsService] Supabase error', error);
          }
        } else if (data) {
          const photos = (data.photos as string[]) || [];
          const additionalPhotos = (data.additional_photos as string[]) || [];
          this.currentPhotosCache.set(sessionUserId, { photos, additionalPhotos });
          return { photos, additionalPhotos };
        }
      } catch (err) {
        this.logError('[measurementsService] Supabase connection error', err);
      }
    }

    return this.currentPhotosCache.get(sessionUserId) ?? { photos: ['', '', ''], additionalPhotos: [] };
  }

  async getMeasurementHistory(userId: string): Promise<MeasurementHistory[]> {
    const limit = 365;
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) {
      return this.getMeasurementHistoryCache(userId) ?? [];
    }

    if (supabase) {
      try {
        const { data, error } = await this.fetchHistoryRows('measurement_history', sessionUserId, limit);

        if (error) {
          this.logError('[measurementsService] Supabase error', error);
        } else if (data) {
          const history: MeasurementHistory[] = data
            .map((entry) => ({
              id: String(entry.id ?? entry.id_uuid ?? this.makeUuid()),
              date: this.normalizeHistoryDay(entry.day) || this.normalizeHistoryDay(entry.date),
              measurements: (entry.measurements as Measurement[]) || [],
              photos: (entry.photos as string[]) || [],
              additionalPhotos: (entry.additional_photos as string[]) || [],
            }))
            .filter((entry) => entry.date.length > 0);

          this.saveHistoryToLocalStorage(sessionUserId, history);
          this.setMeasurementHistoryCache(sessionUserId, history);
          return history;
        }
      } catch (err) {
        this.logError('[measurementsService] Supabase connection error', err);
      }
    }

    try {
      const stored = localStorage.getItem(`${this.HISTORY_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as MeasurementHistory[];
        const normalized = parsed
          .map((entry) => ({
            ...entry,
            id: this.makeUuid(entry.id),
            date: this.normalizeHistoryDay(entry.date),
          }))
          .filter((entry) => entry.date.length > 0);
        this.setMeasurementHistoryCache(sessionUserId, normalized);
        return normalized;
      }
    } catch (error) {
      this.logError('[measurementsService] Error loading history from localStorage', error);
    }

    return this.getMeasurementHistoryCache(userId) ?? [];
  }

  async saveMeasurementHistory(userId: string, entry: MeasurementHistory): Promise<void> {
    const isoDay = this.getEntryIsoDay(entry);
    const normalizedId = this.makeUuid(entry.id);
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    if (supabase) {
      try {
        const dayPayload = {
          id: normalizedId,
          user_id: sessionUserId,
          day: isoDay,
          date: formatUiDay(isoDay),
          measurements: entry.measurements,
          photos: entry.photos,
          additional_photos: entry.additionalPhotos,
        };
        const legacyPayload = {
          id: normalizedId,
          user_id: sessionUserId,
          date: formatUiDay(isoDay),
          measurements: entry.measurements,
          photos: entry.photos,
          additional_photos: entry.additionalPhotos,
        };

        const daySupport = this.readDaySupport('measurement_history', sessionUserId);
        let error: unknown = null;

        if (daySupport !== false) {
          const dayUpsert = await supabase
            .from('measurement_history')
            .upsert(dayPayload, { onConflict: 'user_id,day' });
          error = dayUpsert.error;
          if (!error) {
            this.writeDaySupport('measurement_history', sessionUserId, true);
          } else if (this.isDaySchemaError(error)) {
            this.writeDaySupport('measurement_history', sessionUserId, false);
          }
        }

        if (daySupport === false || (error && this.isDaySchemaError(error))) {
          const legacyUpsert = await supabase
            .from('measurement_history')
            .upsert(legacyPayload, { onConflict: 'user_id,date' });
          error = legacyUpsert.error;
        }

        if (error) {
          this.logError('[measurementsService] Supabase history upsert error', error);
        }
      } catch (err) {
        this.logError('[measurementsService] Supabase history save connection error', err);
      }
    }

    const normalizedEntry: MeasurementHistory = {
      ...entry,
      id: normalizedId,
      date: isoDay,
    };
    const cachedHistory = this.getMeasurementHistoryCache(userId) ?? [];
    const updatedHistory = [normalizedEntry, ...cachedHistory.filter((h) => h.date !== isoDay)];
    this.saveHistoryToLocalStorage(sessionUserId, updatedHistory);
    this.setMeasurementHistoryCache(sessionUserId, updatedHistory);
  }

  async getPhotoHistory(userId: string): Promise<PhotoHistory[]> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) {
      return this.getPhotoHistoryCache(userId) ?? [];
    }

    void this.processLegacyCleanupQueue(sessionUserId);
    const localDeletedDaysSet = this.readLocalPhotoTombstones(sessionUserId);
    const serverDeletedDaysSet = this.deletionsFeatureUnsupported
      ? new Set<string>()
      : await this.getDeletedPhotoDays(sessionUserId);
    const deletedDaysSet = new Set<string>([...localDeletedDaysSet, ...serverDeletedDaysSet]);
    const assetsResult = await this.readPhotoHistoryFromAssets(sessionUserId);
    const legacyProbeDays = await this.readLegacyPhotoDaysProbe(sessionUserId);
    const filteredAssetsRows = assetsResult.rows.filter(
      (row) => !deletedDaysSet.has(this.normalizeHistoryDay(row.date) || row.date)
    );
    const assetDays = new Set(filteredAssetsRows.map((row) => this.normalizeHistoryDay(row.date) || row.date));
    const shouldReadLegacy = legacyProbeDays.some((day) => !deletedDaysSet.has(day) && !assetDays.has(day));
    if (import.meta.env.DEV) {
      console.debug('[measurementsService] photo dual-read decision', {
        assetDays: assetDays.size,
        legacyProbeDays: legacyProbeDays.length,
        deletedDaysCount: deletedDaysSet.size,
        shouldReadLegacy,
      });
    }
    const legacyResult = shouldReadLegacy
      ? await this.readPhotoHistoryFromLegacy(sessionUserId)
      : { rows: [], failed: false };
    const filteredLegacyRows = legacyResult.rows.filter(
      (row) => !deletedDaysSet.has(this.normalizeHistoryDay(row.date) || row.date)
    );
    const cached = this.getPhotoHistoryCache(sessionUserId) ?? [];

    const byDay = new Map<string, PhotoHistory>();
    for (const row of filteredLegacyRows) {
      byDay.set(row.date, row);
    }
    for (const row of filteredAssetsRows) {
      byDay.set(row.date, row);
    }
    for (const row of cached) {
      const day = this.normalizeHistoryDay(row.date) || row.date;
      if (row._pending && !deletedDaysSet.has(day)) {
        byDay.set(row.date, row);
      }
    }

    const merged = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date));
    if (
      merged.length === 0 &&
      cached.length === 0 &&
      assetsResult.failed &&
      (!shouldReadLegacy || legacyResult.failed)
    ) {
      throw new Error('photo_history_unavailable');
    }

    const protectedHistory = this.protectPendingDaysFromServer(merged, cached);
    this.setPhotoHistoryCache(sessionUserId, protectedHistory);
    return protectedHistory;
  }

  async markPhotoDayDeleted(userId: string, day: string): Promise<void> {
    if (this.deletionsFeatureUnsupported) return;
    if (!supabase) return;
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;
    const isoDay = this.normalizeHistoryDay(day) || day;

    const { error } = await supabase
      .from('measurement_photo_deletions')
      .upsert(
        {
          user_id: sessionUserId,
          day: isoDay,
          deleted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,day' }
      );
    if (error) {
      if (this.isMissingTableError(error, 'measurement_photo_deletions')) {
        this.disableDeletionsFeature();
        return;
      }
      throw error;
    }

    const current = this.deletedPhotoDaysCache.get(sessionUserId)?.set ?? new Set<string>();
    current.add(isoDay);
    this.deletedPhotoDaysCache.set(sessionUserId, { set: current, ts: Date.now() });
  }

  async clearPhotoDayDeleted(userId: string, day: string): Promise<void> {
    if (this.deletionsFeatureUnsupported) return;
    if (!supabase) return;
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;
    const isoDay = this.normalizeHistoryDay(day) || day;

    const { error } = await supabase
      .from('measurement_photo_deletions')
      .delete()
      .eq('user_id', sessionUserId)
      .eq('day', isoDay);
    if (error) {
      if (this.isMissingTableError(error, 'measurement_photo_deletions')) {
        this.disableDeletionsFeature();
        return;
      }
      throw error;
    }

    const current = this.deletedPhotoDaysCache.get(sessionUserId)?.set;
    if (current) {
      current.delete(isoDay);
      this.deletedPhotoDaysCache.set(sessionUserId, { set: current, ts: Date.now() });
    }
  }

  async getDeletedPhotoDays(userId: string): Promise<Set<string>> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId || !supabase) return new Set<string>();
    if (this.deletionsFeatureUnsupported) return new Set<string>();

    const now = Date.now();
    const cached = this.deletedPhotoDaysCache.get(sessionUserId);
    if (cached && now - cached.ts < this.DELETED_DAYS_TTL_MS) {
      return new Set(cached.set);
    }

    const { data, error } = await supabase
      .from('measurement_photo_deletions')
      .select('day')
      .eq('user_id', sessionUserId)
      .order('day', { ascending: false })
      .limit(3650);

    if (error) {
      if (this.isMissingTableError(error, 'measurement_photo_deletions')) {
        this.disableDeletionsFeature();
        return new Set(cached?.set ?? []);
      }
      return new Set(cached?.set ?? []);
    }

    const set = new Set(
      (data ?? [])
        .map((row) => this.normalizeHistoryDay((row as { day?: string }).day ?? ''))
        .filter((day) => day.length > 0)
    );
    this.deletedPhotoDaysCache.set(sessionUserId, { set, ts: now });
    if (import.meta.env.DEV) {
      console.debug('[measurementsService] deleted photo days loaded', {
        deletedDaysCount: set.size,
      });
    }
    return new Set(set);
  }

  private async cleanupPhotoAssetsOnly(sessionUserId: string, isoDay: string): Promise<void> {
    if (!supabase) return;

    const { data: assets, error: selectError } = await supabase
      .from('measurement_photo_assets')
      .select('storage_path, thumb_path')
      .eq('user_id', sessionUserId)
      .eq('day', isoDay);
    if (selectError) throw selectError;

    const paths = Array.from(
      new Set(
        (assets ?? [])
          .flatMap((row) => [row.storage_path, row.thumb_path])
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(this.PHOTO_BUCKET).remove(paths);
      if (storageError) throw storageError;
    }

    const { error: deleteError } = await supabase
      .from('measurement_photo_assets')
      .delete()
      .eq('user_id', sessionUserId)
      .eq('day', isoDay);
    if (deleteError) throw deleteError;
  }

  private async deleteLegacyPhotoHistoryDay(sessionUserId: string, isoDay: string): Promise<void> {
    if (!supabase) return;

    let error: unknown = null;
    const daySupport = this.readDaySupport('measurement_photo_history', sessionUserId);

    if (daySupport !== false) {
      const byDay = await supabase
        .from('measurement_photo_history')
        .delete()
        .eq('user_id', sessionUserId)
        .eq('day', isoDay);
      error = byDay.error;
      if (!error) {
        this.writeDaySupport('measurement_photo_history', sessionUserId, true);
      } else if (this.isDaySchemaError(error)) {
        this.writeDaySupport('measurement_photo_history', sessionUserId, false);
      }
    }

    if (daySupport === false || (error && this.isDaySchemaError(error))) {
      const byLegacyDate = await supabase
        .from('measurement_photo_history')
        .delete()
        .eq('user_id', sessionUserId)
        .eq('date', formatUiDay(isoDay));
      error = byLegacyDate.error;
    }

    if (error) {
      throw error;
    }
  }

  private async readLegacyPhotoDaysProbe(userId: string): Promise<string[]> {
    const now = Date.now();
    const cached = this.legacyPhotoProbeCache.get(userId);
    if (cached && now - cached.ts < this.LEGACY_PROBE_TTL_MS) {
      return cached.days;
    }

    if (!supabase) return [];

    const uniqDays = (rows: Array<{ day?: string | null; date?: string | null }>) =>
      Array.from(
        new Set(
          rows
            .map((row) => this.normalizeHistoryDay(row.day ?? row.date ?? ''))
            .filter((day) => day.length > 0)
        )
      );

    try {
      const daySupport = this.readDaySupport('measurement_photo_history', userId);
      if (daySupport !== false) {
        const byDay = await supabase
          .from('measurement_photo_history')
          .select('day')
          .eq('user_id', userId)
          .order('day', { ascending: false })
          .limit(60);

        if (!byDay.error) {
          const days = uniqDays((byDay.data ?? []) as Array<{ day?: string | null }>);
          this.writeDaySupport('measurement_photo_history', userId, true);
          this.legacyPhotoProbeCache.set(userId, { days, ts: now });
          return days;
        }

        if (this.isDaySchemaError(byDay.error)) {
          this.writeDaySupport('measurement_photo_history', userId, false);
        } else {
          this.legacyPhotoProbeCache.set(userId, { days: [], ts: now });
          return [];
        }
      }

      const byDate = await supabase
        .from('measurement_photo_history')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(60);

      if (byDate.error) {
        this.legacyPhotoProbeCache.set(userId, { days: [], ts: now });
        return [];
      }

      const days = uniqDays((byDate.data ?? []) as Array<{ date?: string | null }>);
      this.legacyPhotoProbeCache.set(userId, { days, ts: now });
      return days;
    } catch {
      this.legacyPhotoProbeCache.set(userId, { days: [], ts: now });
      return [];
    }
  }

  private async readPhotoHistoryFromAssets(userId: string): Promise<PhotoReadResult> {
    if (!supabase) {
      return { rows: [], failed: true };
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      if (!sessionUserId) {
        return { rows: [], failed: false };
      }
      const { data, error } = await supabase
        .from('measurement_photo_assets')
        .select('id, day, slot, storage_path, thumb_path')
        .eq('user_id', sessionUserId)
        .order('day', { ascending: false });

      if (error) {
        this.logError('[measurementsService] Supabase photo assets error', error);
        return { rows: [], failed: true };
      }

      const rows = (data ?? []) as MeasurementPhotoAssetRow[];
      if (rows.length === 0) {
        return { rows: [], failed: false };
      }

      const paths = rows.map((row) => row.thumb_path || row.storage_path).filter((path) => Boolean(path));
      const { data: signedData, error: signedError } = await supabase.storage
        .from(this.PHOTO_BUCKET)
        .createSignedUrls(paths, this.PHOTO_SIGNED_TTL_SECONDS);

      if (signedError) {
        this.logError('[measurementsService] Supabase signed URL error', signedError);
        return { rows: [], failed: true };
      }

      const signedByPath = new Map<string, string>();
      for (const signed of signedData ?? []) {
        if (signed.path && signed.signedUrl) {
          signedByPath.set(signed.path, signed.signedUrl);
        }
      }

      const byDay = new Map<string, { id: string; photos: Array<{ slot: MeasurementPhotoSlot; url: string }>; extras: Array<{ slot: MeasurementPhotoSlot; url: string }> }>();
      for (const row of rows) {
        const day = this.normalizeHistoryDay(row.day);
        if (!day) continue;
        const previewPath = row.thumb_path || row.storage_path;
        const previewUrl = signedByPath.get(previewPath);
        if (!previewUrl) continue;

        const current = byDay.get(day) ?? { id: String(row.id ?? this.makeUuid()), photos: [], extras: [] };
        if (row.slot.startsWith('main_')) {
          current.photos.push({ slot: row.slot, url: previewUrl });
        } else {
          current.extras.push({ slot: row.slot, url: previewUrl });
        }
        byDay.set(day, current);
      }

      const fromAssets: PhotoHistory[] = Array.from(byDay.entries())
        .map(([day, value]) => ({
          id: value.id,
          date: day,
          photos: value.photos.sort((a, b) => this.getSlotSortIndex(a.slot) - this.getSlotSortIndex(b.slot)).map((item) => item.url),
          additionalPhotos: value.extras.sort((a, b) => this.getSlotSortIndex(a.slot) - this.getSlotSortIndex(b.slot)).map((item) => item.url),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return { rows: fromAssets, failed: false };
    } catch (err) {
      this.logError('[measurementsService] Supabase photo assets connection error', err);
      return { rows: [], failed: true };
    }
  }

  private async readPhotoHistoryFromLegacy(userId: string): Promise<PhotoReadResult> {
    const limit = 365;
    if (!supabase) return { rows: [], failed: true };

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      if (!sessionUserId) {
        return { rows: [], failed: false };
      }
      const { data, error } = await this.fetchHistoryRows('measurement_photo_history', sessionUserId, limit);

      if (error) {
        this.logError('[measurementsService] Supabase legacy photo history read error', error);
        return { rows: [], failed: true };
      }

      const historyFromServer: PhotoHistory[] = (data ?? [])
        .map((entry) => ({
          id: String(entry.id ?? entry.id_uuid ?? this.makeUuid()),
          date: this.normalizeHistoryDay(entry.day) || this.normalizeHistoryDay(entry.date),
          photos: (entry.photos as string[]) || [],
          additionalPhotos: (entry.additional_photos as string[]) || [],
        }))
        .filter((entry) => entry.date.length > 0);

      return { rows: historyFromServer, failed: false };
    } catch (err) {
      this.logError('[measurementsService] Supabase legacy photo history connection error', err);
      return { rows: [], failed: true };
    }
  }

  async getPhotoHistoryFromAssets(userId: string): Promise<PhotoHistory[]> {
    const result = await this.readPhotoHistoryFromAssets(userId);
    return result.rows;
  }

  async getPhotoHistoryFromLegacy(userId: string): Promise<PhotoHistory[]> {
    const result = await this.readPhotoHistoryFromLegacy(userId);
    return result.rows;
  }

  enqueuePhotoUpload(taskPayload: {
    userId: string;
    day: string;
    id: string;
    photos: string[];
    additionalPhotos: string[];
  }): Promise<void> {
    const key = this.makePhotoUploadTaskKey(taskPayload.userId, taskPayload.day);
    this.cancelledPhotoUploadKeys.delete(key);
    const existing = this.photoUploadTasks.get(key);
    if (existing?.status === 'uploading' && existing.promise) {
      return existing.promise;
    }

    const task: PhotoUploadTask = {
      key,
      payload: taskPayload,
      status: 'uploading',
      promise: null,
    };
    this.photoUploadTasks.set(key, task);

    const run = async () => {
      const sessionUserId = await this.getSessionUserId(taskPayload.userId);
      if (!sessionUserId) {
        task.status = 'error';
        throw new Error('photo_upload_auth_required');
      }
      const day = this.normalizeHistoryDay(taskPayload.day) || taskPayload.day;
      const taskKey = this.makePhotoUploadTaskKey(sessionUserId, day);
      if (this.cancelledPhotoUploadKeys.has(taskKey)) {
        task.status = 'done';
        return;
      }

      const withPending = this.replacePhotoHistoryDay(
        this.getPhotoHistoryCache(sessionUserId) ?? [],
        day,
        {
          id: taskPayload.id,
          date: day,
          photos: taskPayload.photos,
          additionalPhotos: taskPayload.additionalPhotos,
          _pending: true,
          _uploadError: false,
        }
      );
      this.setPhotoHistoryCache(sessionUserId, withPending);
      window.dispatchEvent(
        new CustomEvent('potok:measurements:saved', {
          detail: { userId: sessionUserId, day, phase: 'photos_pending' },
        })
      );

      try {
        await this.upsertPhotoAssetsForDay({
          sessionUserId,
          day,
          photos: taskPayload.photos,
          additionalPhotos: taskPayload.additionalPhotos,
        });
        if (this.cancelledPhotoUploadKeys.has(taskKey)) {
          try {
            await this.cleanupPhotoAssetsOnly(sessionUserId, day);
          } catch (error) {
            if (import.meta.env.DEV) {
              this.logWarn('[measurementsService] cleanup after cancelled upload failed', error);
            }
          }
          task.status = 'done';
          return;
        }
        this.removeLocalPhotoTombstone(sessionUserId, day);
        this.removeLegacyCleanupQueueEntry(sessionUserId, day);
        await this.clearPhotoDayDeleted(sessionUserId, day);
        if (this.cancelledPhotoUploadKeys.has(taskKey)) {
          task.status = 'done';
          return;
        }
        const finalized = this.replacePhotoHistoryDay(
          this.getPhotoHistoryCache(sessionUserId) ?? [],
          day,
          {
          id: taskPayload.id,
          date: day,
          photos: taskPayload.photos,
          additionalPhotos: taskPayload.additionalPhotos,
          _pending: false,
          _uploadError: false,
          }
        );
        this.setPhotoHistoryCache(sessionUserId, finalized);
        task.status = 'done';
        window.dispatchEvent(
          new CustomEvent('potok:measurements:saved', {
            detail: { userId: sessionUserId, day, phase: 'photos_finalized', finalized: true },
          })
        );
      } catch {
        task.status = 'error';
        const withError = this.replacePhotoHistoryDay(
          this.getPhotoHistoryCache(sessionUserId) ?? [],
          day,
          {
            id: taskPayload.id,
            date: day,
            photos: taskPayload.photos,
            additionalPhotos: taskPayload.additionalPhotos,
            _pending: false,
            _uploadError: true,
          }
        );
        this.setPhotoHistoryCache(sessionUserId, withError);
        window.dispatchEvent(
          new CustomEvent('potok:measurements:saved', {
            detail: { userId: sessionUserId, day, phase: 'photos_finalized', finalized: false, error: true },
          })
        );
        throw new Error('photo_upload_failed');
      }
    };

    task.promise = run().finally(() => {
      if (task.status !== 'error') {
        this.photoUploadTasks.delete(key);
      }
    });

    return task.promise;
  }

  retryPhotoUpload(userId: string, day: string): Promise<void> | null {
    const key = this.makePhotoUploadTaskKey(userId, day);
    const task = this.photoUploadTasks.get(key);
    if (!task || task.status !== 'error') {
      return null;
    }
    return this.enqueuePhotoUpload(task.payload);
  }

  async flushPhotoUploads(timeoutMs = 4000): Promise<void> {
    const active = Array.from(this.photoUploadTasks.values())
      .filter((task) => task.status === 'uploading' && task.promise)
      .map((task) => task.promise as Promise<void>);

    if (active.length === 0) return;

    await Promise.race([
      Promise.allSettled(active).then(() => undefined),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, timeoutMs);
      }),
    ]);
  }

  async deleteMeasurementHistoryDay(userId: string, day: string): Promise<void> {
    const isoDay = this.normalizeHistoryDay(day) || day;
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    if (supabase) {
      let error: unknown = null;
      const daySupport = this.readDaySupport('measurement_history', sessionUserId);

      if (daySupport !== false) {
        const byDay = await supabase
          .from('measurement_history')
          .delete()
          .eq('user_id', sessionUserId)
          .eq('day', isoDay);
        error = byDay.error;
        if (!error) {
          this.writeDaySupport('measurement_history', sessionUserId, true);
        } else if (this.isDaySchemaError(error)) {
          this.writeDaySupport('measurement_history', sessionUserId, false);
        }
      }

      if (daySupport === false || (error && this.isDaySchemaError(error))) {
        const byLegacyDate = await supabase
          .from('measurement_history')
          .delete()
          .eq('user_id', sessionUserId)
          .eq('date', formatUiDay(isoDay));
        error = byLegacyDate.error;
      }

      if (error) {
        throw error;
      }
    }

    const current = this.getMeasurementHistoryCache(sessionUserId) ?? [];
    const updated = current.filter((row) => (this.normalizeHistoryDay(row.date) || row.date) !== isoDay);
    this.setMeasurementHistoryCache(sessionUserId, updated);
    this.saveHistoryToLocalStorage(sessionUserId, updated);
  }

  async deletePhotoAssetsDay(userId: string, day: string): Promise<void> {
    if (!supabase) return;
    const isoDay = this.normalizeHistoryDay(day) || day;
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;
    const taskKey = this.makePhotoUploadTaskKey(sessionUserId, isoDay);
    const inFlightTask = this.photoUploadTasks.get(taskKey);
    if (inFlightTask?.status === 'uploading' && inFlightTask.promise) {
      await Promise.race([
        inFlightTask.promise.catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 5000)),
      ]);
    }

    this.cancelledPhotoUploadKeys.add(taskKey);
    this.photoUploadTasks.delete(taskKey);

    await this.cleanupPhotoAssetsOnly(sessionUserId, isoDay);
    this.addLocalPhotoTombstone(sessionUserId, isoDay);
    this.publishPhotoDayDeleted(sessionUserId, isoDay);

    try {
      await this.markPhotoDayDeleted(sessionUserId, isoDay);
    } catch {
      if (import.meta.env.DEV && !this.deletionsFeatureUnsupported) {
        console.warn('[measurementsService] failed to persist tombstone for photo day deletion');
      }
    }

    try {
      await this.deleteLegacyPhotoHistoryDay(sessionUserId, isoDay);
    } catch (error) {
      this.enqueueLegacyCleanup(sessionUserId, isoDay);
      if (import.meta.env.DEV) {
        this.logWarn('[measurementsService] legacy photo cleanup failed (non-fatal)', error);
      }
    }

    const current = this.getPhotoHistoryCache(sessionUserId) ?? [];
    const updated = current.filter((row) => (this.normalizeHistoryDay(row.date) || row.date) !== isoDay);
    this.setPhotoHistoryCache(sessionUserId, updated);
    this.invalidatePhotoReadCaches(sessionUserId);
  }

  async deleteMeasurementHistory(userId: string, entryId: string): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    const history = this.getMeasurementHistoryCache(userId) ?? [];
    const updatedHistory = history.filter((h) => h.id !== entryId);
    this.saveHistoryToLocalStorage(sessionUserId, updatedHistory);
    this.setMeasurementHistoryCache(sessionUserId, updatedHistory);

    if (supabase) {
      try {
        const { error } = await supabase.from('measurement_history').delete().eq('id', entryId);

        if (error) {
          this.logError('[measurementsService] Supabase delete error', error);
        }
      } catch (err) {
        this.logError('[measurementsService] Supabase delete connection error', err);
      }
    }
  }

  async deletePhotoHistory(userId: string, entryId: string): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    if (!sessionUserId) return;

    const history = this.getPhotoHistoryCache(userId) ?? [];
    const target = history.find((h) => h.id === entryId);
    const updatedHistory = history.filter((h) => h.id !== entryId);
    this.setPhotoHistoryCache(sessionUserId, updatedHistory);

    if (supabase && target?.date) {
      try {
        const day = this.normalizeHistoryDay(target.date) || target.date;
        const { error } = await supabase
          .from('measurement_photo_assets')
          .delete()
          .eq('user_id', sessionUserId)
          .eq('day', day);

        if (error) {
          this.logError('[measurementsService] Supabase photo assets delete error', error);
        }
      } catch (err) {
        this.logError('[measurementsService] Supabase photo assets delete connection error', err);
      }
    }
  }

  private saveMeasurementsToLocalStorage(userId: string, measurements: Measurement[]): void {
    this.safeSetLocalStorage(
      `${this.MEASUREMENTS_STORAGE_KEY}_${userId}`,
      JSON.stringify(measurements),
      'measurements'
    );
  }

  private saveHistoryToLocalStorage(userId: string, history: MeasurementHistory[]): void {
    this.safeSetLocalStorage(
      `${this.HISTORY_STORAGE_KEY}_${userId}`,
      JSON.stringify(history),
      'history'
    );
  }
}

export const measurementsService = new MeasurementsService();
