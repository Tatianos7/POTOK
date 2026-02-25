import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  measurementsService,
  type MeasurementHistory,
  type PhotoHistory,
} from '../services/measurementsService';
import { formatUiDay } from '../utils/dateKey';
import styles from './ProgressMeasurements.module.css';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

type HistoryColumn = {
  id: string;
  name: string;
};
const PHOTO_DAYS_PAGE_SIZE = 10;
const TABLE_POPOVER_WIDTH = 144;
const TABLE_POPOVER_OFFSET = 44;
const CROSS_TAB_CHANNEL = 'potok';
const CROSS_TAB_EVENT_KEY = 'potok_cross_tab_event';

function devPerfStart(markName: string): void {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return;
  performance.mark(markName);
}

function devPerfEnd(
  startMark: string,
  endMark: string,
  measureName: string,
  meta?: Record<string, number>
): void {
  if (!import.meta.env.DEV || typeof performance === 'undefined') return;
  performance.mark(endMark);
  performance.measure(measureName, startMark, endMark);
  const entries = performance.getEntriesByName(measureName);
  const last = entries[entries.length - 1];
  const durationMs = last ? Number(last.duration.toFixed(1)) : 0;
  const payload = { durationMs, ...(meta ?? {}) };
  console.debug(`[perf] ${measureName}`, payload);
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  performance.clearMeasures(measureName);
}

const BASE_COLUMNS: HistoryColumn[] = [
  { id: 'weight', name: 'Вес' },
  { id: 'waist', name: 'Талия' },
  { id: 'hips', name: 'Бедра' },
];

const BASE_IDS = new Set(BASE_COLUMNS.map((column) => column.id));

function sortByDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

function getHistoryColumns(historyRows: MeasurementHistory[]): HistoryColumn[] {
  const byId = new Map<string, HistoryColumn>();

  for (const row of historyRows) {
    for (const item of row.measurements ?? []) {
      if (!item?.id || !item?.name) continue;
      if (!byId.has(item.id)) {
        byId.set(item.id, { id: item.id, name: item.name });
      }
    }
  }

  const base = BASE_COLUMNS.map((column) => ({
    id: column.id,
    name: byId.get(column.id)?.name ?? column.name,
  }));
  const custom = Array.from(byId.values())
    .filter((column) => !BASE_IDS.has(column.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru-RU'));

  return [...base, ...custom];
}

const ProgressMeasurements: FC = () => {
  const navigate = useNavigate();
  const { user, authStatus } = useAuth();
  const [historyStatus, setHistoryStatus] = useState<LoadStatus>('idle');
  const [photoStatus, setPhotoStatus] = useState<LoadStatus>('idle');
  const [historyRows, setHistoryRows] = useState<MeasurementHistory[]>([]);
  const [photoRows, setPhotoRows] = useState<PhotoHistory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [historyDeletePopover, setHistoryDeletePopover] = useState<{
    day: string;
    top: number;
    left: number;
    place: 'top' | 'bottom';
  } | null>(null);
  const [photoDeleteDay, setPhotoDeleteDay] = useState<string | null>(null);
  const [deletingHistoryDay, setDeletingHistoryDay] = useState<string | null>(null);
  const [deletingPhotoDay, setDeletingPhotoDay] = useState<string | null>(null);
  const [visiblePhotoDays, setVisiblePhotoDays] = useState(PHOTO_DAYS_PAGE_SIZE);
  const [loadedImageKeys, setLoadedImageKeys] = useState<Record<string, boolean>>({});
  const historyReqIdRef = useRef(0);
  const photoReqIdRef = useRef(0);
  const didAutoRetryHistoryRef = useRef(false);
  const didAutoRetryPhotosRef = useRef(false);
  const lastAutoloadUserIdRef = useRef<string | null>(null);
  const lastSavedEventKeyRef = useRef<string | null>(null);
  const refreshCountRef = useRef(0);
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const historyPopoverRef = useRef<HTMLDivElement | null>(null);
  const photoPopoverRef = useRef<HTMLDivElement | null>(null);
  const isAuthReady = authStatus === 'authenticated' && Boolean(user?.id);

  const calcTablePopoverPosition = useCallback((anchorElement: HTMLElement) => {
    const container = tableContainerRef.current;
    if (!container) return null;
    const rect = anchorElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    let top = rect.top - containerRect.top - TABLE_POPOVER_OFFSET;
    let place: 'top' | 'bottom' = 'top';
    if (top < 4) {
      top = rect.bottom - containerRect.top + 6;
      place = 'bottom';
    }
    let left = rect.left - containerRect.left;
    left = Math.max(4, Math.min(left, containerRect.width - TABLE_POPOVER_WIDTH - 4));

    return { top, left, place };
  }, []);

  const refreshBump = useCallback((delta: 1 | -1) => {
    refreshCountRef.current = Math.max(0, refreshCountRef.current + delta);
    setIsRefreshing(refreshCountRef.current > 0);
  }, []);

  useEffect(() => {
    if (isAuthReady) return;
    setHistoryStatus('idle');
    setPhotoStatus('idle');
    setHistoryWarning(null);
    setPhotoWarning(null);
  }, [isAuthReady]);

  useEffect(() => {
    refreshCountRef.current = 0;
    setIsRefreshing(false);
    setHistoryRows([]);
    setPhotoRows([]);
    setHistoryStatus('idle');
    setPhotoStatus('idle');
    setHistoryWarning(null);
    setPhotoWarning(null);
    setDeleteError(null);
    setActionInfo(null);
    setHistoryDeletePopover(null);
    setPhotoDeleteDay(null);
    setDeletingHistoryDay(null);
    setDeletingPhotoDay(null);
    setVisiblePhotoDays(PHOTO_DAYS_PAGE_SIZE);
    setLoadedImageKeys({});
  }, [user?.id]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (historyPopoverRef.current?.contains(target) || target.closest('[data-history-anchor="true"]')) {
        return;
      }
      if (photoPopoverRef.current?.contains(target) || target.closest('[data-photo-anchor="true"]')) {
        return;
      }
      setHistoryDeletePopover(null);
      setPhotoDeleteDay(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const loadHistory = useCallback(async (opts?: { silent?: boolean; allowAutoRetry?: boolean; source?: 'autoload' | 'retry' | 'manual' }) => {
    if (!isAuthReady || !user?.id) {
      return;
    }
    const reqId = ++historyReqIdRef.current;
    const cachedHistory = measurementsService.getMeasurementHistoryCache(user.id);
    const hasCachedHistory = Boolean(cachedHistory && cachedHistory.length > 0);
    let startedRefresh = false;

    if (hasCachedHistory && cachedHistory) {
      setHistoryRows(sortByDateDesc(cachedHistory));
    }

    if (!opts?.silent && !hasCachedHistory) {
      setHistoryStatus('loading');
      setHistoryWarning(null);
    } else {
      if (hasCachedHistory) setHistoryStatus('success');
      refreshBump(1);
      startedRefresh = true;
    }

    devPerfStart('pm:getMeasurementHistory:start');
    const historyResult = await Promise.allSettled([
      measurementsService.getMeasurementHistory(user.id).finally(() => {
        devPerfEnd(
          'pm:getMeasurementHistory:start',
          'pm:getMeasurementHistory:end',
          'ProgressMeasurements:getMeasurementHistory'
        );
      }),
    ]);
    if (reqId !== historyReqIdRef.current) {
      if (startedRefresh) refreshBump(-1);
      return;
    }

    if (historyResult[0].status === 'fulfilled') {
      const nextHistoryRows = sortByDateDesc(historyResult[0].value);
      setHistoryRows(nextHistoryRows);
      if (import.meta.env.DEV) {
        console.debug('[perf] ProgressMeasurements:historyRows', { rows: nextHistoryRows.length });
      }
      setHistoryWarning(null);
      setHistoryStatus('success');
    } else if (!hasCachedHistory) {
      const canAutoRetry =
        opts?.allowAutoRetry &&
        !didAutoRetryHistoryRef.current &&
        typeof navigator !== 'undefined' &&
        navigator.onLine;
      if (canAutoRetry) {
        didAutoRetryHistoryRef.current = true;
        setHistoryStatus('loading');
        setHistoryWarning(null);
        if (import.meta.env.DEV) {
          console.debug('[ProgressMeasurements] one-shot retry history');
        }
        window.setTimeout(() => {
          void loadHistory({ silent: true, allowAutoRetry: false, source: 'retry' });
        }, 400);
      } else {
        setHistoryStatus('error');
        setHistoryWarning(null);
      }
    } else {
      setHistoryStatus('success');
      if (!opts?.silent) {
        setHistoryWarning('Показываем последние сохраненные данные.');
      }
    }

    if (startedRefresh && reqId === historyReqIdRef.current) {
      refreshBump(-1);
    }
  }, [isAuthReady, refreshBump, user?.id]);

  const loadPhotos = useCallback(async (opts?: { silent?: boolean; allowAutoRetry?: boolean; source?: 'autoload' | 'retry' | 'manual' }) => {
    if (!isAuthReady || !user?.id) {
      return;
    }
    const reqId = ++photoReqIdRef.current;
    const cachedPhotos = measurementsService.getPhotoHistoryCache(user.id);
    const hasCachedPhotos = Boolean(cachedPhotos && cachedPhotos.length > 0);
    let startedRefresh = false;

    if (hasCachedPhotos && cachedPhotos) {
      setPhotoRows(sortByDateDesc(cachedPhotos));
    }

    if (!opts?.silent && !hasCachedPhotos) {
      setPhotoStatus('loading');
      setPhotoWarning(null);
    } else if (hasCachedPhotos) {
      setPhotoStatus('success');
      refreshBump(1);
      startedRefresh = true;
    }

    devPerfStart('pm:getPhotoHistory:start');
    const photosResult = await Promise.allSettled([
      measurementsService.getPhotoHistory(user.id).finally(() => {
        devPerfEnd(
          'pm:getPhotoHistory:start',
          'pm:getPhotoHistory:end',
          'ProgressMeasurements:getPhotoHistory'
        );
      }),
    ]);
    if (reqId !== photoReqIdRef.current) {
      if (startedRefresh) refreshBump(-1);
      return;
    }

    if (photosResult[0].status === 'fulfilled') {
      const nextPhotoRows = sortByDateDesc(photosResult[0].value);
      setPhotoRows(nextPhotoRows);
      if (import.meta.env.DEV) {
        const approxBytes = JSON.stringify(nextPhotoRows).length;
        console.debug('[perf] ProgressMeasurements:photoRows', {
          rows: nextPhotoRows.length,
          approxBytes,
        });
      }
      setPhotoWarning(null);
      setPhotoStatus('success');
    } else if (!hasCachedPhotos) {
      const canAutoRetry =
        opts?.allowAutoRetry &&
        !didAutoRetryPhotosRef.current &&
        typeof navigator !== 'undefined' &&
        navigator.onLine;
      if (canAutoRetry) {
        didAutoRetryPhotosRef.current = true;
        setPhotoStatus('loading');
        setPhotoWarning(null);
        if (import.meta.env.DEV) {
          console.debug('[ProgressMeasurements] one-shot retry photos');
        }
        window.setTimeout(() => {
          void loadPhotos({ silent: true, allowAutoRetry: false, source: 'retry' });
        }, 400);
      } else {
        setPhotoStatus('error');
        setPhotoWarning(null);
      }
    } else {
      setPhotoStatus('success');
      if (!opts?.silent) {
        setPhotoWarning('Фото временно недоступны, показываем последние сохраненные данные.');
      }
    }

    if (startedRefresh && reqId === photoReqIdRef.current) {
      refreshBump(-1);
    }
  }, [isAuthReady, refreshBump, user?.id]);

  useEffect(() => {
    if (!isAuthReady || !user?.id) return;

    if (lastAutoloadUserIdRef.current === user.id) return;
    lastAutoloadUserIdRef.current = user.id;
    didAutoRetryHistoryRef.current = false;
    didAutoRetryPhotosRef.current = false;

    if (import.meta.env.DEV) {
      console.debug('[ProgressMeasurements] autoload history/photos');
    }
    void Promise.all([
      loadHistory({ allowAutoRetry: true, source: 'autoload' }),
      loadPhotos({ allowAutoRetry: true, source: 'autoload' }),
    ]);
  }, [isAuthReady, user?.id, loadHistory, loadPhotos]);

  useEffect(() => {
    if (!isAuthReady || !user?.id) return;
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; day?: string; phase?: string }>).detail;
      if (detail?.userId && detail.userId !== user.id) return;
      const day = detail?.day ?? '-';
      const phase = detail?.phase ?? 'unknown';
      const eventKey = `${detail?.userId ?? user.id}:${day}:${phase}`;
      if (lastSavedEventKeyRef.current === eventKey) return;
      lastSavedEventKeyRef.current = eventKey;

      if (phase === 'history_saved') {
        void loadHistory({ silent: true });
        return;
      }
      if (phase === 'photos_pending' || phase === 'photos_finalized') {
        void loadPhotos({ silent: true });
        return;
      }
      void Promise.all([loadHistory({ silent: true }), loadPhotos({ silent: true })]);
    };
    window.addEventListener('potok:measurements:saved', onSaved as EventListener);
    return () => {
      window.removeEventListener('potok:measurements:saved', onSaved as EventListener);
    };
  }, [isAuthReady, loadHistory, loadPhotos, user?.id]);

  useEffect(() => {
    if (!isAuthReady || !user?.id) return;
    const currentUserId = user.id;
    const applyPayload = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const type = String((payload as { type?: unknown }).type ?? '');
      const payloadUserId = String((payload as { userId?: unknown }).userId ?? '');
      if (type !== 'photo_day_deleted') return;
      if (payloadUserId !== currentUserId) return;
      void loadPhotos({ silent: true });
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CROSS_TAB_CHANNEL);
      channel.onmessage = (event) => applyPayload(event.data);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== CROSS_TAB_EVENT_KEY || !event.newValue) return;
      try {
        applyPayload(JSON.parse(event.newValue));
      } catch {
        // ignore malformed payload
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
    };
  }, [isAuthReady, loadPhotos, user?.id]);

  useEffect(() => {
    const nextBlobUrls = new Set<string>();
    for (const row of photoRows) {
      for (const image of [...(row.photos ?? []), ...(row.additionalPhotos ?? [])]) {
        if (typeof image === 'string' && image.startsWith('blob:')) {
          nextBlobUrls.add(image);
        }
      }
    }

    for (const oldUrl of activeBlobUrlsRef.current) {
      if (!nextBlobUrls.has(oldUrl)) {
        URL.revokeObjectURL(oldUrl);
      }
    }
    activeBlobUrlsRef.current = nextBlobUrls;
  }, [photoRows]);

  useEffect(() => {
    return () => {
      for (const url of activeBlobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      activeBlobUrlsRef.current.clear();
    };
  }, []);

  const columns = useMemo(() => getHistoryColumns(historyRows), [historyRows]);
  const visiblePhotoRows = useMemo(() => {
    devPerfStart('pm:buildPhotoList:start');
    const pendingRows = photoRows.filter((row) => row._pending);
    const normalRows = photoRows.filter((row) => !row._pending);
    const rows = [...pendingRows, ...normalRows.slice(0, visiblePhotoDays)];
    devPerfEnd(
      'pm:buildPhotoList:start',
      'pm:buildPhotoList:end',
      'ProgressMeasurements:buildPhotoList',
      { rows: rows.length }
    );
    return rows;
  }, [photoRows, visiblePhotoDays]);

  useEffect(() => {
    const allowed = new Set<string>();
    for (const row of visiblePhotoRows) {
      const images = [...(row.photos ?? []), ...(row.additionalPhotos ?? [])];
      images.forEach((_, idx) => allowed.add(`${row.id}_${idx}`));
    }

    setLoadedImageKeys((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (allowed.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [visiblePhotoRows]);
  const hasMorePhotoDays = useMemo(() => {
    const normalRowsCount = photoRows.filter((row) => !row._pending).length;
    return normalRowsCount > visiblePhotoDays;
  }, [photoRows, visiblePhotoDays]);
  const hasAnyPhotoRows = photoRows.length > 0;
  const tableViewRows = useMemo(() => {
    devPerfStart('pm:buildTable:start');
    const rows = historyRows.map((row) => ({
      id: row.id,
      date: row.date,
      values: columns.map((column) => row.measurements.find((item) => item.id === column.id)?.value || '—'),
    }));
    devPerfEnd(
      'pm:buildTable:start',
      'pm:buildTable:end',
      'ProgressMeasurements:buildTableRows',
      { rows: rows.length, columns: columns.length }
    );
    return rows;
  }, [historyRows, columns]);

  const handleDayDelete = useCallback(async () => {
    if (!isAuthReady || !user?.id || !historyDeletePopover?.day || deletingHistoryDay) return;
    const targetDay = historyDeletePopover.day;

    setDeleteError(null);
    setActionInfo(null);
    setDeletingHistoryDay(targetDay);
    const prevHistory = historyRows;
    const nextHistory = prevHistory.filter((row) => row.date !== targetDay);

    setHistoryRows(nextHistory);
    measurementsService.setMeasurementHistoryCache(user.id, nextHistory);

    try {
      await measurementsService.deleteMeasurementHistoryDay(user.id, targetDay);
      setHistoryDeletePopover(null);
      window.dispatchEvent(
        new CustomEvent('potok:measurements:history:deleted', {
          detail: { day: targetDay, type: 'history' },
        })
      );
      setActionInfo('Замеры удалены');
    } catch {
      setHistoryRows(prevHistory);
      measurementsService.setMeasurementHistoryCache(user.id, prevHistory);
      setDeleteError('Не удалось удалить запись. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setDeletingHistoryDay(null);
    }
  }, [deletingHistoryDay, historyDeletePopover?.day, historyRows, isAuthReady, user?.id]);

  const handlePhotoDayDelete = useCallback(async () => {
    if (!isAuthReady || !user?.id || !photoDeleteDay || deletingPhotoDay) return;
    const targetDay = photoDeleteDay;
    setDeleteError(null);
    setActionInfo(null);
    setDeletingPhotoDay(targetDay);

    const prevPhotos = photoRows;
    const nextPhotos = prevPhotos.filter((row) => row.date !== targetDay);
    setPhotoRows(nextPhotos);
    measurementsService.setPhotoHistoryCache(user.id, nextPhotos);

    try {
      await measurementsService.deletePhotoAssetsDay(user.id, targetDay);
      setPhotoDeleteDay(null);
      window.dispatchEvent(
        new CustomEvent('potok:measurements:photos:deleted', {
          detail: { day: targetDay, type: 'photo' },
        })
      );
      setActionInfo('Фото удалены');
    } catch {
      setPhotoRows(prevPhotos);
      measurementsService.setPhotoHistoryCache(user.id, prevPhotos);
      setDeleteError('Не удалось удалить фото. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setDeletingPhotoDay(null);
    }
  }, [deletingPhotoDay, isAuthReady, photoDeleteDay, photoRows, user?.id]);

  return (
    <div className="min-h-screen bg-white px-4 py-5">
      <div className="relative mb-8 flex items-center justify-center">
        <h1 className="text-lg font-semibold tracking-wide text-gray-900">ЗАМЕРЫ</h1>
        <button
          type="button"
          className="absolute right-0 text-gray-500 transition-colors hover:text-gray-800"
          onClick={() => navigate('/progress')}
          aria-label="Закрыть"
        >
          <X size={24} />
        </button>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-center text-lg font-semibold text-gray-900">ИСТОРИЯ ЗАМЕРОВ</h2>
        {deleteError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">
            {deleteError}
          </div>
        )}
        {actionInfo && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-700">
            {actionInfo}
          </div>
        )}
        {!isAuthReady && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Загрузка...
          </div>
        )}
        {isRefreshing && historyStatus === 'success' && (
          <p className="mb-2 text-center text-xs text-gray-500">Обновляем...</p>
        )}
        {isAuthReady && (historyStatus === 'idle' || historyStatus === 'loading') && historyRows.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Загрузка...
          </div>
        )}
        {isAuthReady && historyStatus === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            <p>Не удалось загрузить данные.</p>
            <button
              type="button"
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold"
              disabled={!isAuthReady}
              onClick={() => {
                if (!isAuthReady) return;
                void loadHistory();
              }}
            >
              Повторить
            </button>
          </div>
        )}
        {isAuthReady && historyWarning && historyStatus === 'success' && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
            {historyWarning}
          </div>
        )}
        {isAuthReady && historyStatus === 'success' && (
          <>
            {historyRows.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Нет данных
              </div>
            ) : (
              <div className={styles.tableContainer} ref={tableContainerRef}>
                <div className={styles.tableViewport}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={`${styles.headerCell} ${styles.stickyDate}`}>Дата</th>
                        {columns.map((column) => (
                          <th key={column.id} className={styles.headerCell}>
                            {column.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableViewRows.map((row) => (
                        <tr key={row.id}>
                          <td className={`${styles.dateCell} ${styles.stickyDate}`}>
                            <button
                              type="button"
                              data-history-anchor="true"
                              onClick={(event) => {
                                const button = event.currentTarget;
                                const position = calcTablePopoverPosition(button);
                                if (!position) return;
                                setHistoryDeletePopover((prev) => {
                                  if (prev?.day === row.date) return null;
                                  return { day: row.date, ...position };
                                });
                              }}
                              className={`w-full text-left ${
                                historyDeletePopover?.day === row.date ? 'font-semibold text-red-600' : ''
                              }`}
                            >
                              {formatUiDay(row.date)}
                            </button>
                          </td>
                          {row.values.map((value, index) => (
                            <td key={`${row.id}_${columns[index]?.id ?? index}`} className={styles.valueCell}>
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historyDeletePopover && (
                  <div
                    ref={historyPopoverRef}
                    className={styles.deletePopover}
                    style={{
                      top: historyDeletePopover.top,
                      left: historyDeletePopover.left,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => void handleDayDelete()}
                      disabled={Boolean(deletingHistoryDay)}
                      className={styles.deletePopoverButton}
                    >
                      {deletingHistoryDay === historyDeletePopover.day ? 'Удаляем...' : 'Удалить'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-center text-lg font-semibold text-gray-900">ИСТОРИЯ ФОТО</h2>
        {!isAuthReady && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Загрузка...
          </div>
        )}
        {isAuthReady && (photoStatus === 'idle' || photoStatus === 'loading') && photoRows.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Загрузка...
          </div>
        )}
        {isAuthReady && photoStatus === 'error' && !hasAnyPhotoRows && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            <p>Фото временно недоступны.</p>
            <button
              type="button"
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold"
              disabled={!isAuthReady}
              onClick={() => {
                if (!isAuthReady) return;
                void loadPhotos();
              }}
            >
              Повторить
            </button>
          </div>
        )}
        {isAuthReady && photoWarning && photoStatus === 'success' && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
            {photoWarning}
          </div>
        )}
        {isAuthReady && (photoStatus === 'success' || (photoStatus === 'error' && hasAnyPhotoRows)) && (
          <>
            {photoRows.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Нет данных
              </div>
            ) : (
              <div className="space-y-4">
                {visiblePhotoRows.map((row) => {
                  const images = [...(row.photos ?? []), ...(row.additionalPhotos ?? [])];
                  return (
                    <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          data-photo-anchor="true"
                          onClick={() =>
                            setPhotoDeleteDay((prev) => (prev === row.date ? null : row.date))
                          }
                          className={`text-sm text-gray-700 ${photoDeleteDay === row.date ? 'font-semibold text-red-600' : ''}`}
                        >
                          {formatUiDay(row.date)}
                        </button>
                        {row._pending && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Загружаем...
                          </span>
                        )}
                        {row._uploadError && !row._pending && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!user?.id) return;
                              const retried = measurementsService.retryPhotoUpload(user.id, row.date);
                              if (!retried) {
                                void loadPhotos({ silent: true });
                              }
                            }}
                            className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                          >
                            Не удалось, повторить
                          </button>
                        )}
                      </div>
                      {photoDeleteDay === row.date && (
                        <div ref={photoPopoverRef} className="mb-2 inline-flex rounded-lg border border-red-200 bg-white p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => void handlePhotoDayDelete()}
                            disabled={deletingPhotoDay === row.date}
                            className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingPhotoDay === row.date ? 'Удаляем...' : 'Удалить фото'}
                          </button>
                        </div>
                      )}
                      {images.length === 0 ? (
                        <p className="text-sm text-gray-400">Нет фото</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {images.map((image, index) => {
                            const imageKey = `${row.id}_${index}`;
                            const isLoaded = Boolean(loadedImageKeys[imageKey]);
                            return (
                            <div key={imageKey} className="relative aspect-square overflow-hidden rounded-md bg-gray-100">
                              {!isLoaded && <div className="absolute inset-0 animate-pulse bg-gray-200" />}
                              <img
                                src={image}
                                alt={`Фото ${index + 1}`}
                                loading="lazy"
                                onLoad={() =>
                                  setLoadedImageKeys((prev) => ({ ...prev, [imageKey]: true }))
                                }
                                className={`h-full w-full object-cover transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                              />
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                  );
                })}
                {hasMorePhotoDays && (
                  <button
                    type="button"
                    onClick={() => setVisiblePhotoDays((prev) => prev + PHOTO_DAYS_PAGE_SIZE)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Показать ещё
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default ProgressMeasurements;
