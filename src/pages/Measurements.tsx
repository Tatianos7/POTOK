import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Minus, ArrowRight } from 'lucide-react';
import {
  measurementsService,
  type Measurement,
  type MeasurementHistory,
} from '../services/measurementsService';
import { toIsoDay } from '../utils/dateKey';

type MeasurementsLoadStatus = 'loading' | 'active' | 'error';
const SAVE_TIMEOUT_MS = 10000;
const MAX_ADDITIONAL_PHOTOS = 3;

const MAX_CUSTOM_MEASUREMENTS = 15;
const MEASUREMENTS_WHITELIST = [
  { id: 'weight', name: 'ВЕС' },
  { id: 'waist', name: 'ТАЛИЯ' },
  { id: 'hips', name: 'БЕДРА' },
] as const;

const EMPTY_MEASUREMENTS: Measurement[] = MEASUREMENTS_WHITELIST.map((item) => ({
  id: item.id,
  name: item.name,
  value: '',
}));

const BASE_MEASUREMENT_IDS = new Set<string>(MEASUREMENTS_WHITELIST.map((item) => item.id));

function normalizeMeasurementName(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, ' ');
  if (!collapsed) return '';
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1).toLowerCase();
}

function normalizedNameForCompare(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function isSupportedMeasurementId(id: string): boolean {
  return BASE_MEASUREMENT_IDS.has(id) || id.startsWith('custom_');
}

function sanitizeMeasurements(input?: Measurement[] | null): Measurement[] {
  const byId = new Map<string, Measurement>(
    (input ?? [])
      .filter((item) => Boolean(item?.id) && isSupportedMeasurementId(item.id))
      .map((item) => [
        item.id,
        {
          id: item.id,
          name: item.name || item.id,
          value: typeof item.value === 'string' ? item.value : String(item.value ?? ''),
        },
      ])
  );

  const baseItems = MEASUREMENTS_WHITELIST.map((item) => {
    const found = byId.get(item.id);
    return {
      id: item.id,
      name: item.name,
      value: found?.value ?? '',
    };
  });

  const customItems = Array.from(byId.values())
    .filter((item) => item.id.startsWith('custom_'))
    .slice(0, MAX_CUSTOM_MEASUREMENTS)
    .map((item) => ({
      id: item.id,
      name: normalizeMeasurementName(item.name || ''),
      value: item.value ?? '',
    }))
    .filter((item) => item.name.length > 0);

  return [...baseItems, ...customItems];
}

function toEmptyDraftMeasurements(input?: Measurement[] | null): Measurement[] {
  return sanitizeMeasurements(input).map((item) => ({
    ...item,
    value: '',
  }));
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('save_timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

function maskUserId(userId: string): string {
  return userId.length <= 6 ? userId : userId.slice(-6);
}

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
  console.debug(`[perf] ${measureName}`, { durationMs, ...(meta ?? {}) });
  performance.clearMarks(startMark);
  performance.clearMarks(endMark);
  performance.clearMeasures(measureName);
}

function toMeasurementMap(entries: Measurement[]): Map<string, Measurement> {
  return new Map(
    entries
      .filter((entry) => Boolean(entry?.id))
      .map((entry) => [entry.id, { ...entry }])
  );
}

function buildNonEmptyPatch(entries: Measurement[]): Measurement[] {
  return entries
    .map((entry) => ({ ...entry, value: (entry.value ?? '').trim() }))
    .filter((entry) => entry.value !== '');
}

function mergeMeasurementsForDay(existing: Measurement[], patch: Measurement[]): Measurement[] {
  const merged = toMeasurementMap(existing);
  for (const next of patch) {
    merged.set(next.id, { ...next });
  }
  return Array.from(merged.values());
}

const Measurements = () => {
  const { user, authStatus } = useAuth();
  const navigate = useNavigate();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const additionalPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [draftMeasurements, setDraftMeasurements] = useState<Measurement[]>(EMPTY_MEASUREMENTS);
  const [customData, setCustomData] = useState('');
  const [photos, setPhotos] = useState<string[]>(['', '', '']); // 3 основных фото
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]); // Дополнительные фото (динамические)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<MeasurementsLoadStatus>('loading');
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavedPrompt, setShowSavedPrompt] = useState(false);
  const [customDataError, setCustomDataError] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const savedPromptOkButtonRef = useRef<HTMLButtonElement | null>(null);
  const initReqIdRef = useRef(0);
  const saveReqIdRef = useRef(0);
  const didAutoRetryRef = useRef(false);
  const lastAutoloadUserIdRef = useRef<string | null>(null);
  const didEditDraftRef = useRef(false);
  const didEditPhotosRef = useRef(false);
  const isAuthReady = authStatus === 'authenticated' && Boolean(user?.id);

  const photoLabels = ['спереди', 'с боку', 'сзади'];
  const customMeasurementsCount = draftMeasurements.filter((m) => m.id.startsWith('custom_')).length;
  const isCustomLimitReached = customMeasurementsCount >= MAX_CUSTOM_MEASUREMENTS;
  const isAdditionalPhotosLimitReached = additionalPhotos.length >= MAX_ADDITIONAL_PHOTOS;

  const resetDraftAfterSave = useCallback(() => {
    setDraftMeasurements(EMPTY_MEASUREMENTS);
    setCustomData('');
    setCustomDataError(null);
    setPhotos(['', '', '']);
    setAdditionalPhotos([]);
    setOpenMenuId(null);
    didEditDraftRef.current = false;
    didEditPhotosRef.current = false;
  }, []);

  const loadMeasurementsState = useCallback(async (opts?: { silent?: boolean; allowAutoRetry?: boolean; source?: 'autoload' | 'retry' | 'manual' }) => {
    if (!isAuthReady || !user?.id) return;
    const reqId = ++initReqIdRef.current;
    setRuntimeStatus('loading');
    setRuntimeMessage(null);
    setSaveMessage(null);
    setSaveError(null);
    setShowSavedPrompt(false);

    try {
      devPerfStart('m:getCurrentMeasurements:start');
      const currentMeasurements = await measurementsService.getCurrentMeasurements(user.id);
      devPerfEnd(
        'm:getCurrentMeasurements:start',
        'm:getCurrentMeasurements:end',
        'Measurements:getCurrentMeasurements',
        { rows: currentMeasurements.length }
      );
      if (reqId !== initReqIdRef.current) return;

      if (!didEditDraftRef.current) {
        setDraftMeasurements(toEmptyDraftMeasurements(currentMeasurements));
        setCustomData('');
        setCustomDataError(null);
      }

      if (!didEditPhotosRef.current) {
        setPhotos(['', '', '']);
        setAdditionalPhotos([]);
      }
      setRuntimeStatus('active');

    } catch (error) {
      if (reqId !== initReqIdRef.current) return;
      const canAutoRetry =
        opts?.allowAutoRetry &&
        !didAutoRetryRef.current &&
        typeof navigator !== 'undefined' &&
        navigator.onLine;
      if (canAutoRetry) {
        didAutoRetryRef.current = true;
        setRuntimeStatus('loading');
        setRuntimeMessage(null);
        if (import.meta.env.DEV) {
          console.debug('[Measurements] one-shot retry', { source: opts?.source ?? 'unknown' });
        }
        window.setTimeout(() => {
          void loadMeasurementsState({ silent: true, allowAutoRetry: false, source: 'retry' });
        }, 400);
        return;
      }
      setRuntimeStatus('error');
      setRuntimeMessage('Не удалось загрузить замеры.');
    } finally {
      if (reqId === initReqIdRef.current) {
        setIsInitialLoad(false);
      }
    }
  }, [isAuthReady, user?.id]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate('/login');
      return;
    }
    if (!isAuthReady || !user?.id) return;
    if (lastAutoloadUserIdRef.current === user.id) return;

    lastAutoloadUserIdRef.current = user.id;
    didAutoRetryRef.current = false;
    setIsInitialLoad(true);
    setRuntimeStatus('loading');
    setRuntimeMessage(null);
    if (import.meta.env.DEV) {
      console.debug('[Measurements] autoload', { source: 'auth-ready' });
    }
    void loadMeasurementsState({ allowAutoRetry: true, source: 'autoload' });
  }, [authStatus, isAuthReady, loadMeasurementsState, navigate, user?.id]);

  useEffect(() => {
    if (!showSavedPrompt) return;
    savedPromptOkButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSavedPrompt(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showSavedPrompt]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void measurementsService.flushPhotoUploads(4000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Проверяем, что клик не внутри меню или кнопки с тремя точками
      if (openMenuId && !target.closest('.measurement-menu') && !target.closest('.menu-trigger')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      // Используем небольшую задержку, чтобы дать время обработать клик на кнопку удаления
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId]);

  const handleIncrement = (id: string) => {
    didEditDraftRef.current = true;
    setDraftMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, value: ((Number.parseFloat(m.value || '0') || 0) + 0.5).toFixed(1) }
          : m
      )
    );
  };

  const handleDecrement = (id: string) => {
    didEditDraftRef.current = true;
    setDraftMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              value: Math.max(0, (Number.parseFloat(m.value || '0') || 0) - 0.5).toFixed(1),
            }
          : m
      )
    );
  };

  const handleInputChange = (id: string, value: string) => {
    // Разрешаем только числа и точку
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      didEditDraftRef.current = true;
      setDraftMeasurements((prev) =>
        prev.map((m) => (m.id === id ? { ...m, value } : m))
      );
    }
  };

  const handleInputBlur = (id: string) => {
    didEditDraftRef.current = true;
    setDraftMeasurements((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const numValue = parseFloat(m.value);
          return {
            ...m,
            value: isNaN(numValue) ? '0' : numValue.toFixed(1),
          };
        }
        return m;
      })
    );
  };

  const handlePhotoClick = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      didEditPhotosRef.current = true;
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotos((prev) => {
          const newPhotos = [...prev];
          newPhotos[index] = result;
          return newPhotos;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCustomMeasurement = () => {
    if (!user?.id) return;
    const normalizedName = normalizeMeasurementName(customData);
    if (!normalizedName) {
      setCustomDataError('Введите название замера');
      return;
    }
    if (isCustomLimitReached) {
      setCustomDataError(`Можно добавить до ${MAX_CUSTOM_MEASUREMENTS} замеров`);
      return;
    }
    const duplicateExists = draftMeasurements.some(
      (item) => normalizedNameForCompare(item.name) === normalizedNameForCompare(normalizedName)
    );
    if (duplicateExists) {
      setCustomDataError('Уже есть такой замер');
      return;
    }

    const newMeasurement: Measurement = {
      id: `custom_${Date.now()}`,
      name: normalizedName,
      value: '',
    };

    const updated = sanitizeMeasurements([...draftMeasurements, newMeasurement]);
    didEditDraftRef.current = true;
    setDraftMeasurements(updated);
    setCustomData('');
    setCustomDataError(null);
    customInputRef.current?.focus();
  };

  const handleAddAdditionalPhoto = () => {
    if (additionalPhotos.length < MAX_ADDITIONAL_PHOTOS) {
      didEditPhotosRef.current = true;
      setAdditionalPhotos((prev) => [...prev, '']);
    }
  };

  const handleAdditionalPhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      didEditPhotosRef.current = true;
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAdditionalPhotos((prev) => {
          const newPhotos = [...prev];
          newPhotos[index] = result;
          return newPhotos;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAdditionalPhoto = (index: number) => {
    didEditPhotosRef.current = true;
    setAdditionalPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user?.id || isSaving) return;
    const reqId = ++saveReqIdRef.current;
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    setShowSavedPrompt(false);

    try {
      if (import.meta.env.DEV) {
        console.debug('[measurements] save:start', { user: maskUserId(user.id) });
      }
      const sanitizedMeasurements = sanitizeMeasurements(draftMeasurements);
      const safeAdditionalPhotosDraft = additionalPhotos.slice(0, MAX_ADDITIONAL_PHOTOS);
      const measurementPatch = buildNonEmptyPatch(sanitizedMeasurements);
      const hasAnyPhoto = photos.some((photo) => photo !== '') || safeAdditionalPhotosDraft.some((photo) => photo !== '');
      if (additionalPhotos.length > MAX_ADDITIONAL_PHOTOS) {
        setSaveError(`Можно добавить максимум ${MAX_ADDITIONAL_PHOTOS} дополнительных фото.`);
        return;
      }
      if (import.meta.env.DEV) {
        console.debug('[measurements] save:build-patch:done', {
          keys: measurementPatch.map((item) => item.id),
          hasPhotos: hasAnyPhoto,
        });
      }
      if (measurementPatch.length === 0 && !hasAnyPhoto) {
        setSaveMessage('Введите хотя бы одно значение');
        return;
      }

      if (import.meta.env.DEV) {
        console.debug('[measurements] save:photos:prepare:start');
      }
      await runWithTimeout(
        measurementsService.saveCurrentMeasurementsValues(user.id, sanitizedMeasurements),
        SAVE_TIMEOUT_MS
      );
      if (import.meta.env.DEV) {
        console.debug('[measurements] save:photos:prepare:done');
      }

      const currentPhotos = photos.filter((photo) => photo !== '');
      const currentAdditionalPhotos = safeAdditionalPhotosDraft.filter((photo) => photo !== '');
      const currentDate = toIsoDay(new Date());
      const cachedHistory = measurementsService.getMeasurementHistoryCache(user.id) ?? [];
      let history = cachedHistory;
      if (cachedHistory.length === 0) {
        if (import.meta.env.DEV) {
          console.debug('[measurements] save:remote:start');
        }
        devPerfStart('m:getMeasurementHistory:start');
        history = await runWithTimeout(measurementsService.getMeasurementHistory(user.id), SAVE_TIMEOUT_MS);
        devPerfEnd(
          'm:getMeasurementHistory:start',
          'm:getMeasurementHistory:end',
          'Measurements:getMeasurementHistory',
          { rows: history.length }
        );
        if (import.meta.env.DEV) {
          console.debug('[measurements] save:remote:done');
        }
      }
      const existingTodayEntry = history.find((entry) => entry.date === currentDate);

      const mergedMeasurements = mergeMeasurementsForDay(existingTodayEntry?.measurements ?? [], measurementPatch);
      const mergedPhotos = existingTodayEntry?.photos ?? [];
      const mergedAdditionalPhotos = existingTodayEntry?.additionalPhotos ?? [];

      const shouldSaveHistory =
        mergedMeasurements.length > 0 || mergedPhotos.length > 0 || mergedAdditionalPhotos.length > 0;

      if (shouldSaveHistory) {
        if (import.meta.env.DEV) {
          console.debug('[measurements] save:history:start');
        }
        const historyEntry = {
          id:
            existingTodayEntry?.id ??
            (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `history_${Date.now()}`),
          date: currentDate,
          measurements: mergedMeasurements,
          photos: mergedPhotos,
          additionalPhotos: mergedAdditionalPhotos,
        };
        await runWithTimeout(measurementsService.saveMeasurementHistory(user.id, historyEntry), SAVE_TIMEOUT_MS);
        const optimisticHistory: MeasurementHistory[] = [
          {
            ...historyEntry,
            date: currentDate,
          },
          ...history.filter((entry) => entry.date !== currentDate),
        ];
        measurementsService.setMeasurementHistoryCache(user.id, optimisticHistory);
        if (import.meta.env.DEV) {
          console.debug('[measurements] save:history:done');
        }
        window.dispatchEvent(
          new CustomEvent('potok:measurements:saved', {
            detail: { userId: user.id, day: currentDate, phase: 'history_saved' },
          })
        );
      }

      // Очищаем форму для следующего ввода только после успешного сохранения.
      if (reqId !== saveReqIdRef.current) return;
      resetDraftAfterSave();
      setShowSavedPrompt(true);
      if (import.meta.env.DEV) {
        console.debug('[measurements] save:done');
      }

      // Фото сохраняем в фоне, чтобы не блокировать UX.
      if (hasAnyPhoto) {
        const cachedPhotoHistory = measurementsService.getPhotoHistoryCache(user.id) ?? [];
        const optimisticPhotoEntryId =
          cachedPhotoHistory.find((entry) => entry.date === currentDate)?.id ??
          (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `photo_history_${Date.now()}`);
        const optimisticPhotoHistory = measurementsService.replacePhotoHistoryDay(
          cachedPhotoHistory,
          currentDate,
          {
            id: optimisticPhotoEntryId,
            date: currentDate,
            photos: currentPhotos,
            additionalPhotos: currentAdditionalPhotos,
            _pending: true,
            _uploadError: false,
          }
        );
        measurementsService.setPhotoHistoryCache(user.id, optimisticPhotoHistory);
        window.dispatchEvent(
          new CustomEvent('potok:measurements:saved', {
            detail: { userId: user.id, day: currentDate, phase: 'photos_pending' },
          })
        );

        void measurementsService
          .enqueuePhotoUpload({
            userId: user.id,
            day: currentDate,
            id: optimisticPhotoEntryId,
            photos: currentPhotos,
            additionalPhotos: currentAdditionalPhotos,
          })
          .catch(() => {
            if (reqId === saveReqIdRef.current) {
              setSaveError('Замеры сохранены, но фото не удалось загрузить. Попробуйте позже.');
            }
          });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug('[measurements] save:error', {
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
      setSaveError('Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      if (reqId === saveReqIdRef.current) {
        setIsSaving(false);
      }
    }
  };

  const handleDelete = (id: string) => {
    if (!user?.id) return;
    
    const updated = draftMeasurements.filter((m) => m.id !== id);
    didEditDraftRef.current = true;
    setDraftMeasurements(updated);
    setOpenMenuId(null);
  };

  const handleClose = () => {
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden min-w-[320px]">
      <div className="max-w-[768px] mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <header className="px-2 sm:px-4 md:px-6 lg:px-8 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="flex-1 text-center px-4 min-w-[250px]">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase whitespace-nowrap">
                ТВОИ ЗАМЕРЫ
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 leading-tight">
                Введите значения там где вам<br/>важно отслеживать прогресс
              </p>
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={handleClose}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 pl-[10px] pr-[10px] sm:px-4 md:px-6 lg:px-8 py-6">
          {(authStatus === 'booting' || !isAuthReady || (runtimeStatus === 'loading' && isInitialLoad)) && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Загрузка замеров...
            </div>
          )}
          {isAuthReady && runtimeStatus === 'error' && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex flex-col gap-2">
                <span>{runtimeMessage || 'Не удалось загрузить данные.'}</span>
                <button
                  onClick={() => void loadMeasurementsState({ allowAutoRetry: false, source: 'manual' })}
                  className="w-fit rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
          {/* Measurements Section */}
          <div className="space-y-4 mb-6">
            {draftMeasurements.map((measurement) => (
              <div key={measurement.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenMenuId(openMenuId === measurement.id ? null : measurement.id);
                    }}
                    className="menu-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  >
                    <svg width="4" height="16" viewBox="0 0 4 16" fill="currentColor">
                      <circle cx="2" cy="2" r="1" />
                      <circle cx="2" cy="8" r="1" />
                      <circle cx="2" cy="14" r="1" />
                    </svg>
                  </button>
                  {openMenuId === measurement.id && (
                    <div 
                      className="measurement-menu absolute left-0 top-6 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[120px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDelete(measurement.id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                    {measurement.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecrement(measurement.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Minus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <input
                    type="text"
                    value={measurement.value}
                    onChange={(e) => handleInputChange(measurement.id, e.target.value)}
                    onBlur={() => handleInputBlur(measurement.id)}
                    className={`w-20 px-3 py-2 rounded-lg border text-center text-sm font-medium ${
                      parseFloat(measurement.value) > 0
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                  />
                  <button
                    onClick={() => handleIncrement(measurement.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Data Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-white uppercase mb-2">
              ДОБАВИТЬ ДАННЫЕ
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={customInputRef}
                type="text"
                value={customData}
                onChange={(e) => {
                  setCustomData(e.target.value);
                  if (customDataError) setCustomDataError(null);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCustomMeasurement();
                  }
                }}
                placeholder="Введите в ручную"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleAddCustomMeasurement}
                disabled={isCustomLimitReached}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            {customDataError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{customDataError}</p>
            )}
            {saveMessage && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{saveMessage}</p>
            )}
            {saveError && (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Повторить
                </button>
              </div>
            )}
            {isCustomLimitReached && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Можно добавить до {MAX_CUSTOM_MEASUREMENTS} замеров
              </p>
            )}
          </div>

          {/* Add Photo Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                ДОБАВИТЬ ФОТО
              </label>
              <button
                onClick={handleAddAdditionalPhoto}
                disabled={isAdditionalPhotosLimitReached}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-white border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Добавить дополнительное фото"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {isAdditionalPhotosLimitReached && (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                Можно добавить ещё 3 фото максимум
              </p>
            )}
            
            {/* Основные фото (первые 3) */}
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <input
                      ref={(el) => (fileInputRefs.current[index] = el)}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoChange(index, e)}
                      className="hidden"
                    />
                    <button
                      onClick={() => handlePhotoClick(index)}
                      className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden"
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={photoLabels[index]}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Plus className="w-8 h-8 text-gray-400" />
                      )}
                    </button>
                    {photo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          didEditPhotosRef.current = true;
                          setPhotos((prev) => {
                            const newPhotos = [...prev];
                            newPhotos[index] = '';
                            return newPhotos;
                          });
                        }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {photoLabels[index] && (
                      <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
                        {photoLabels[index]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Дополнительные фото */}
            {additionalPhotos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white uppercase mb-3">
                  ДОПОЛНИТЕЛЬНЫЕ ФОТО
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {additionalPhotos.map((photo, index) => (
                      <div key={index} className="relative">
                        <input
                          ref={(el) => (additionalPhotoRefs.current[index] = el)}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleAdditionalPhotoChange(index, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => additionalPhotoRefs.current[index]?.click()}
                          className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden"
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt={`Дополнительное фото ${index + 1}`}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Plus className="w-8 h-8 text-gray-400" />
                          )}
                        </button>
                        {photo && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAdditionalPhoto(index);
                            }}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

        </main>

        {/* Save Button */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={isSaving || !user?.id}
            className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
          </button>
        </div>
      </div>

      {showSavedPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowSavedPrompt(false)}
        >
          <div
            className="w-[min(92vw,420px)] rounded-[18px] bg-white p-4 shadow-xl dark:bg-gray-900 sm:p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Сохранено"
          >
            <p className="text-left text-sm font-medium text-gray-900 dark:text-white">Сохранено. Смотри в «Прогресс»</p>
            <div className="mt-4 flex flex-col gap-2 min-[390px]:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowSavedPrompt(false);
                  navigate('/progress/measurements');
                }}
                className="w-full rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                Перейти в Прогресс
              </button>
              <button
                ref={savedPromptOkButtonRef}
                type="button"
                onClick={() => setShowSavedPrompt(false)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Ок
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Measurements;
