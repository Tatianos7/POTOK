import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Calendar, Edit, Trash2, Clock, Plus, StickyNote } from 'lucide-react';
import InlineCalendar from '../components/InlineCalendar';
import ExerciseCategorySheet from '../components/ExerciseCategorySheet';
import ExerciseListSheet from '../components/ExerciseListSheet';
import SelectedExercisesEditor from '../components/SelectedExercisesEditor';
import CreateExerciseModal from '../components/CreateExerciseModal';
import EditWorkoutEntryModal from '../components/EditWorkoutEntryModal';
import MealNoteModal from '../components/MealNoteModal';
import WorkoutDayNoteBlock from '../components/WorkoutDayNoteBlock';
import WorkoutEntryNoteComposer from '../components/WorkoutEntryNoteComposer';
import WorkoutEntryInlineNote from '../components/WorkoutEntryInlineNote';
import { exerciseService } from '../services/exerciseService';
import { workoutService } from '../services/workoutService';
import { workoutEntryNotesService } from '../services/workoutEntryNotesService';
import { workoutDayNotesService } from '../services/workoutDayNotesService';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import { classifyTrustDecision } from '../services/trustSafetyService';
import { coachRuntime, type CoachScreenContext } from '../services/coachRuntime';
import { ExerciseCategory, Exercise, SelectedExercise, WorkoutEntry } from '../types/workout';
import '../utils/checkExercisesData'; // Импортируем для доступа через window
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import ExerciseRow from '../ui/components/ExerciseRow';
import ExerciseTableHeader from '../ui/components/ExerciseTableHeader';
import { colors, spacing, typography } from '../ui/theme/tokens';
import { clearWorkoutEntriesForDay, removeWorkoutEntryFromList } from '../utils/workoutDiaryMutations';
import {
  buildExclusiveWorkoutFlowState,
  getFlowLayerAfterCategoryExercisesLoad,
  getFlowLayerAfterExerciseSelection,
  shouldReturnToCategorySheetAfterCreateExerciseClose,
  shouldReturnToCategorySheetAfterExerciseListClose,
  type CreateExerciseModalMode,
  type CreateExerciseModalCloseReason,
} from '../utils/workoutAddFlowNavigation';
import { resolveDiarySelectedDateFromState } from '../utils/foodDiaryNavigation';
import {
  WORKOUT_BOTTOM_BAR_CLASS,
  WORKOUT_MAIN_CONTAINER_CLASS,
  WORKOUT_SCREEN_BACKGROUND,
} from '../utils/workoutLayout';
import {
  applyDeletedWorkoutEntryNote,
  applySavedWorkoutEntryNote,
  buildWorkoutEntryNotesById,
  cancelWorkoutEntryNoteComposer,
  openWorkoutEntryNoteComposer,
  pruneWorkoutEntryNoteSet,
  toggleWorkoutEntryNoteExpanded,
} from '../utils/workoutEntryNotesUi';
import { submitModalAction } from '../utils/asyncModalSubmit';

const CUSTOM_EXERCISES_CATEGORY: ExerciseCategory = {
  id: 'custom-exercises',
  name: 'Мои упражнения',
  order: 999,
};

const Workouts = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Получаем сегодняшнюю дату в формате YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(() =>
    resolveDiarySelectedDateFromState(location.state, getTodayDate()),
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isExerciseCategorySheetOpen, setIsExerciseCategorySheetOpen] = useState(false);
  const [isExerciseListSheetOpen, setIsExerciseListSheetOpen] = useState(false);
  const [isSelectedExercisesEditorOpen, setIsSelectedExercisesEditorOpen] = useState(false);
  const [isCreateExerciseModalOpen, setIsCreateExerciseModalOpen] = useState(false);
  const [editingCustomExercise, setEditingCustomExercise] = useState<Exercise | null>(null);
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [editorInitialExercises, setEditorInitialExercises] = useState<SelectedExercise[]>([]);
  const [editorMode, setEditorMode] = useState<'add' | 'editWorkout'>('add');
  const [workoutEntries, setWorkoutEntries] = useState<WorkoutEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkoutEntry | null>(null);
  const [entryNoteDraft, setEntryNoteDraft] = useState('');
  const [isLoadingEntryNote, setIsLoadingEntryNote] = useState(false);
  const [isSavingEntryNote, setIsSavingEntryNote] = useState(false);
  const [isDeletingEntryNote, setIsDeletingEntryNote] = useState(false);
  const [entryNotesById, setEntryNotesById] = useState<Record<string, string>>({});
  const [expandedEntryNotes, setExpandedEntryNotes] = useState<Set<string>>(new Set());
  const [activeNoteEntryId, setActiveNoteEntryId] = useState<string | null>(null);
  const [entryNoteDeleteConfirmEntryId, setEntryNoteDeleteConfirmEntryId] = useState<string | null>(null);
  const [isWorkoutDayNoteOpen, setIsWorkoutDayNoteOpen] = useState(false);
  const [workoutDayNote, setWorkoutDayNote] = useState<string | null>(null);
  const [workoutDayNoteDayId, setWorkoutDayNoteDayId] = useState<string | null>(null);
  const [isLoadingWorkoutDayNote, setIsLoadingWorkoutDayNote] = useState(false);
  const [isDeletingWorkoutDayNote, setIsDeletingWorkoutDayNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const entryNoteSaveLock = useRef({ current: false });
  const entryNoteDeleteLock = useRef({ current: false });
  const buildCoachContext = (): CoachScreenContext => ({
    screen: 'Today',
    userMode: 'Manual',
    subscriptionState: user?.hasPremium ? 'Premium' : 'Free',
    trustLevel: undefined,
    safetyFlags: [],
  });
  const prStorageKey = (userId: string) => `workout_pr_${userId}`;
  const readPrMap = (userId: string): Record<string, number> => {
    try {
      const raw = localStorage.getItem(prStorageKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };
  const writePrMap = (userId: string, map: Record<string, number>) => {
    localStorage.setItem(prStorageKey(userId), JSON.stringify(map));
  };

  // Утилита для добавления дней к дате в формате YYYY-MM-DD
  const addDaysToString = (dateStr: string, days: number): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    return `${newYear}-${newMonth}-${newDay}`;
  };

  // Утилита для получения дня недели из строки YYYY-MM-DD
  const getWeekdayFromString = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return ['В', 'П', 'В', 'С', 'Ч', 'П', 'С'][date.getDay()];
  };

  // Быстрый календарь всегда строится от сегодняшней даты (7 дней вперёд)
  const dates = useMemo(() => {
    const datesList = [];
    const today = getTodayDate();
    
    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysToString(today, i);
      const [, , day] = dateStr.split('-').map(Number);
      
      datesList.push({
        date: dateStr,
        day: day,
        weekday: getWeekdayFromString(dateStr),
      });
    }
    return datesList;
  }, []); // Календарь не зависит от selectedDate, всегда показывает текущую неделю

  const activeWorkoutEntryForNote = useMemo(
    () => workoutEntries.find((entry) => entry.id === activeNoteEntryId) ?? null,
    [activeNoteEntryId, workoutEntries],
  );

  // Форматирование выбранной даты для отображения
  const formatSelectedDate = (): string => {
    // Используем selectedDate напрямую (это уже строка YYYY-MM-DD)
    const dateStr = selectedDate;
    
    // Получаем сегодняшнюю дату в локальном времени
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
    
    // Получаем вчерашнюю дату в локальном времени
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayYear = yesterday.getFullYear();
    const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
    
    // Получаем завтрашнюю дату в локальном времени
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

    // Парсим выбранную дату для форматирования (используем значения напрямую из строки)
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Используем значения напрямую из строки, чтобы избежать проблем с часовыми поясами
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];

    const base = `${day} ${months[month - 1]} ${year}`;
    
    // Сравниваем строки дат напрямую
    if (dateStr === todayStr) return `Сегодня, ${base}`;
    if (dateStr === yesterdayStr) return `Вчера, ${base}`;
    if (dateStr === tomorrowStr) return `Завтра, ${base}`;
    
    // Для дат далеко в прошлом или будущем просто показываем дату
    return base;
  };

  useEffect(() => {
    setSelectedDate(resolveDiarySelectedDateFromState(location.state, getTodayDate()));
  }, [location.state]); // синхронизация с навигацией из истории

  // Загружаем категории при монтировании (с автоматической инициализацией)
  useEffect(() => {
    const loadCategories = async () => {
      try {
        let cats = await exerciseService.getCategories();
        
        // Если категорий нет, пытаемся инициализировать данные
        if (cats.length === 0) {
          console.log('[Workouts] Категории не найдены, запускаем инициализацию...');
          const { initializeExerciseData } = await import('../utils/initializeExerciseData');
          await initializeExerciseData();
          
          // Ждем немного, чтобы данные успели сохраниться
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Повторно загружаем категории после инициализации
          cats = await exerciseService.getCategories();
          console.log(`[Workouts] После инициализации найдено ${cats.length} категорий`);
        }
        
        setCategories(cats);
      } catch (error) {
        console.error('[Workouts] Ошибка загрузки категорий:', error);
      }
    };
    loadCategories();
  }, []);

  const reloadWorkoutEntries = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('TrainingDiary', {
      pendingSources: ['workout_entries', 'local_cache'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка тренировки заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getTrainingDiaryState(user.id, selectedDate);
      setRuntimeStatus(state.status);
      setTrustMessage(state.trust?.message ?? null);
      setWorkoutEntries(state.entries ?? []);
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить тренировку. Проверьте соединение и попробуйте снова.');
      }
    } catch (error) {
      console.error('Ошибка загрузки записей тренировки:', error);
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить тренировку. Проверьте соединение и попробуйте снова.');
      setTrustMessage(decision.message);
      setWorkoutEntries([]);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('TrainingDiary');
      setIsLoading(false);
    }
  }, [user?.id, selectedDate]);

  const reloadWorkoutDayNote = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingWorkoutDayNote(true);
    try {
      const workoutDay = await workoutService.getWorkoutDay(user.id, selectedDate);
      if (!workoutDay?.id) {
        setWorkoutDayNoteDayId(null);
        setWorkoutDayNote(null);
        return;
      }

      const note = await workoutDayNotesService.getNoteByWorkoutDayId(user.id, workoutDay.id);
      setWorkoutDayNoteDayId(workoutDay.id);
      setWorkoutDayNote(note);
    } catch (error) {
      console.error('Ошибка загрузки заметки тренировки:', error);
      setWorkoutDayNoteDayId(null);
      setWorkoutDayNote(null);
    } finally {
      setIsLoadingWorkoutDayNote(false);
    }
  }, [user?.id, selectedDate]);

  // Загружаем упражнения тренировки при изменении даты
  useEffect(() => {
    reloadWorkoutEntries();
  }, [reloadWorkoutEntries]);

  useEffect(() => {
    reloadWorkoutDayNote();
  }, [reloadWorkoutDayNote]);

  useEffect(() => {
    if (!user?.id) {
      setEntryNotesById({});
      setExpandedEntryNotes(new Set());
      setActiveNoteEntryId(null);
      setEntryNoteDeleteConfirmEntryId(null);
      setEntryNoteDraft('');
      return;
    }

    const entryIds = workoutEntries.map((entry) => entry.id);
    if (entryIds.length === 0) {
      setEntryNotesById({});
      setExpandedEntryNotes(new Set());
      setActiveNoteEntryId((current) => (current && entryIds.includes(current) ? current : null));
      setEntryNoteDeleteConfirmEntryId((current) => (current && entryIds.includes(current) ? current : null));
      return;
    }

    let isCancelled = false;
    void (async () => {
      const notesMap = await workoutEntryNotesService.getNotesByEntryIds(user.id, entryIds);
      if (isCancelled) return;

      setEntryNotesById(buildWorkoutEntryNotesById(entryIds, notesMap));
      setExpandedEntryNotes((current) => pruneWorkoutEntryNoteSet(entryIds, current));
      setActiveNoteEntryId((current) => (current && entryIds.includes(current) ? current : null));
      setEntryNoteDeleteConfirmEntryId((current) => (current && entryIds.includes(current) ? current : null));
    })();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, workoutEntries]);

  // Обновляем данные при фоновом sync
  useEffect(() => {
    const handleWorkoutsSynced = (event: CustomEvent) => {
      const { date, entries } = event.detail;
      if (date === selectedDate) {
        setWorkoutEntries(entries);
      }
    };
    window.addEventListener('workouts-synced', handleWorkoutsSynced as EventListener);
    return () => {
      window.removeEventListener('workouts-synced', handleWorkoutsSynced as EventListener);
    };
  }, [selectedDate]);

  // Закрытие календаря при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isCalendarOpen]);


  const handleClose = () => {
    navigate('/');
  };

  const applyFlowLayer = (target: 'root' | 'category' | 'list' | 'editor' | 'create') => {
    const next = buildExclusiveWorkoutFlowState(target);
    setIsExerciseCategorySheetOpen(next.isExerciseCategorySheetOpen);
    setIsExerciseListSheetOpen(next.isExerciseListSheetOpen);
    setIsCreateExerciseModalOpen(next.isCreateExerciseModalOpen);
    setIsSelectedExercisesEditorOpen(next.isSelectedExercisesEditorOpen);
  };

  const handleEditWorkout = () => {
    if (workoutEntries.length === 0) return;

    const initialExercises = workoutEntries
      .filter((entry) => entry.exercise)
      .map((entry) => ({
        exercise: entry.exercise as Exercise,
        sets: entry.sets,
        reps: entry.reps,
        weight: entry.weight,
      }));

    setEditorMode('editWorkout');
    setEditorInitialExercises(initialExercises);
    setSelectedExercises(initialExercises.map((item) => item.exercise));
    applyFlowLayer('editor');
  };

  const handleEditEntry = (entryId: string) => {
    if (isUpdatingEntry || deletingEntryId || isDeletingWorkout) return;
    const entry = workoutEntries.find((item) => item.id === entryId);
    if (!entry) {
      setErrorMessage('Не удалось найти запись упражнения для редактирования');
      return;
    }
    setEditingEntry(entry);
  };

  const handleSaveEditedEntry = async (updates: { sets: number; reps: number; weight: number }) => {
    if (!editingEntry || !user?.id || isUpdatingEntry) return;

    setIsUpdatingEntry(true);
    setErrorMessage(null);
    try {
      const updatedEntry = await workoutService.updateWorkoutEntry(
        editingEntry.id,
        updates,
        editingEntry.updated_at,
        { userId: user.id, date: selectedDate },
      );
      setWorkoutEntries((current) => current.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)));
      setEditingEntry(null);
      setRuntimeStatus('active');
    } catch (error: any) {
      console.error('Ошибка редактирования упражнения:', error);
      const message = error?.message || 'Ошибка при обновлении упражнения';
      setErrorMessage(message);
      await reloadWorkoutEntries();
      alert(message);
    } finally {
      setIsUpdatingEntry(false);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!user?.id || isDeletingWorkout || isSaving || isLoading || workoutEntries.length === 0) return;
    const confirmed = window.confirm('Удалить всю тренировку за выбранный день?');
    if (!confirmed) return;

    setIsDeletingWorkout(true);
    setErrorMessage(null);
    try {
      await workoutService.deleteWorkoutDay(user.id, selectedDate);
      setWorkoutEntries(clearWorkoutEntriesForDay());
      setWorkoutDayNote(null);
      setWorkoutDayNoteDayId(null);
      setIsWorkoutDayNoteOpen(false);
      setRuntimeStatus('empty');
    } catch (error: any) {
      console.error('Ошибка удаления тренировки:', error);
      const message = error?.message || 'Ошибка при удалении тренировки';
      setErrorMessage(message);
      await reloadWorkoutEntries();
      alert(message);
    } finally {
      setIsDeletingWorkout(false);
    }
  };

  const handleOpenWorkoutDayNote = async () => {
    if (!user?.id || isLoadingWorkoutDayNote || isSaving || isUpdatingEntry || deletingEntryId || isDeletingWorkout) return;

    setIsLoadingWorkoutDayNote(true);
    setErrorMessage(null);
    try {
      const workoutDay = await workoutService.getWorkoutDay(user.id, selectedDate);
      const note = workoutDay?.id
        ? await workoutDayNotesService.getNoteByWorkoutDayId(user.id, workoutDay.id)
        : null;

      setWorkoutDayNoteDayId(workoutDay?.id ?? null);
      setWorkoutDayNote(note);
      setIsWorkoutDayNoteOpen(true);
    } catch (error: any) {
      console.error('Ошибка загрузки заметки тренировки:', error);
      const message = error?.message || 'Ошибка при загрузке заметки тренировки';
      setErrorMessage(message);
      alert(message);
    } finally {
      setIsLoadingWorkoutDayNote(false);
    }
  };

  const handleSaveWorkoutDayNote = async (note: string) => {
    if (!user?.id) return;

    let workoutDayId = workoutDayNoteDayId;
    if (!workoutDayId) {
      const workoutDay = await workoutService.getOrCreatePersistedWorkoutDay(user.id, selectedDate);
      workoutDayId = workoutDay.id;
      setWorkoutDayNoteDayId(workoutDayId);
    }

    await workoutDayNotesService.saveNote(user.id, workoutDayId, note);
    setWorkoutDayNote(note);
  };

  const handleDeleteWorkoutDayNote = async () => {
    if (!user?.id || !workoutDayNoteDayId) return;
    await workoutDayNotesService.deleteNote(user.id, workoutDayNoteDayId);
    setWorkoutDayNote(null);
  };

  const handleDeleteWorkoutDayNoteFromBlock = async () => {
    if (!user?.id || !workoutDayNoteDayId || isDeletingWorkoutDayNote) return;
    const confirmed = window.confirm('Удалить заметку ко всей тренировке?');
    if (!confirmed) return;

    setIsDeletingWorkoutDayNote(true);
    setErrorMessage(null);
    try {
      await workoutDayNotesService.deleteNote(user.id, workoutDayNoteDayId);
      setWorkoutDayNote(null);
      setIsWorkoutDayNoteOpen(false);
    } catch (error: any) {
      console.error('Ошибка удаления заметки тренировки:', error);
      const message = error?.message || 'Ошибка при удалении заметки тренировки';
      setErrorMessage(message);
      alert(message);
    } finally {
      setIsDeletingWorkoutDayNote(false);
    }
  };

  const handleOpenEntryNote = async (entryId: string) => {
    if (!user?.id || isLoadingEntryNote || isSavingEntryNote || isDeletingEntryNote || isUpdatingEntry || deletingEntryId || isDeletingWorkout) return;
    const entry = workoutEntries.find((item) => item.id === entryId);
    if (!entry) {
      setErrorMessage('Не удалось найти запись упражнения для заметки');
      return;
    }

    setIsLoadingEntryNote(true);
    setErrorMessage(null);
    setEntryNoteDeleteConfirmEntryId(null);
    const openedState = openWorkoutEntryNoteComposer(entryId, entryNotesById);
    setActiveNoteEntryId(openedState.activeNoteEntryId);
    setEntryNoteDraft(openedState.draft);
    try {
      const note = await workoutEntryNotesService.getNoteByEntryId(user.id, entryId);
      setEntryNoteDraft(note ?? '');
      setEntryNotesById((current) => {
        const next = { ...current };
        if (note && note.trim().length > 0) {
          next[entryId] = note;
        } else {
          delete next[entryId];
        }
        return next;
      });
    } catch (error: any) {
      console.error('Ошибка загрузки заметки:', error);
      const message = error?.message || 'Ошибка при загрузке заметки';
      setErrorMessage(message);
      const cancelledState = cancelWorkoutEntryNoteComposer();
      setActiveNoteEntryId(cancelledState.activeNoteEntryId);
      setEntryNoteDraft(cancelledState.draft);
      alert(message);
    } finally {
      setIsLoadingEntryNote(false);
    }
  };

  const handleCancelEntryNoteComposer = () => {
    if (isLoadingEntryNote || isSavingEntryNote || isDeletingEntryNote) return;
    const cancelledState = cancelWorkoutEntryNoteComposer();
    setActiveNoteEntryId(cancelledState.activeNoteEntryId);
    setEntryNoteDraft(cancelledState.draft);
  };

  const handleSaveEntryNote = async () => {
    if (!user?.id || !activeNoteEntryId) return;

    const trimmedNote = entryNoteDraft.trim();
    if (trimmedNote.length === 0) {
      handleCancelEntryNoteComposer();
      return;
    }

    setIsSavingEntryNote(true);
    try {
      await submitModalAction(
        entryNoteSaveLock.current,
        async () => {
          await workoutEntryNotesService.saveNote(user.id, activeNoteEntryId, trimmedNote);
        },
        () => {
          const nextState = applySavedWorkoutEntryNote(
            activeNoteEntryId,
            trimmedNote,
            entryNotesById,
            expandedEntryNotes,
          );
          setEntryNotesById(nextState.notesById);
          setExpandedEntryNotes(nextState.expandedEntryIds);
          setActiveNoteEntryId(nextState.activeNoteEntryId);
          setEntryNoteDraft(nextState.draft);
        },
      );
    } catch (error: any) {
      console.error('Ошибка сохранения заметки:', error);
      const message = error?.message || 'Не удалось сохранить заметку';
      setErrorMessage(message);
      alert(message);
    } finally {
      setIsSavingEntryNote(false);
    }
  };

  const handleToggleEntryNote = (entryId: string) => {
    setExpandedEntryNotes((current) => toggleWorkoutEntryNoteExpanded(entryId, current));
  };

  const handleRequestDeleteEntryNote = (entryId: string) => {
    if (isDeletingEntryNote) return;
    setEntryNoteDeleteConfirmEntryId(entryId);
  };

  const handleCancelDeleteEntryNote = () => {
    if (isDeletingEntryNote) return;
    setEntryNoteDeleteConfirmEntryId(null);
  };

  const handleDeleteEntryNote = async (entryId: string) => {
    if (!user?.id) return;

    setIsDeletingEntryNote(true);
    try {
      await submitModalAction(
        entryNoteDeleteLock.current,
        async () => {
          await workoutEntryNotesService.deleteNote(user.id, entryId);
        },
        () => {
          const nextState = applyDeletedWorkoutEntryNote(entryId, entryNotesById, expandedEntryNotes);
          setEntryNotesById(nextState.notesById);
          setExpandedEntryNotes(nextState.expandedEntryIds);
          setEntryNoteDeleteConfirmEntryId(null);
          if (activeNoteEntryId === entryId) {
            const cancelledState = cancelWorkoutEntryNoteComposer();
            setActiveNoteEntryId(cancelledState.activeNoteEntryId);
            setEntryNoteDraft(cancelledState.draft);
          }
        },
      );
    } catch (error: any) {
      console.error('Ошибка удаления заметки:', error);
      const message = error?.message || 'Не удалось удалить заметку';
      setErrorMessage(message);
      alert(message);
    } finally {
      setIsDeletingEntryNote(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user?.id || deletingEntryId || isDeletingWorkout || isSaving) return;
    const confirmed = window.confirm('Удалить упражнение из тренировки?');
    if (!confirmed) return;

    setDeletingEntryId(entryId);
    setErrorMessage(null);
    try {
      await workoutService.deleteWorkoutEntry(entryId, user.id, selectedDate);
      const nextEntries = removeWorkoutEntryFromList(workoutEntries, entryId);
      setWorkoutEntries(nextEntries);
      setRuntimeStatus(nextEntries.length > 0 ? 'active' : 'empty');
    } catch (error: any) {
      console.error('Ошибка удаления упражнения:', error);
      const message = error?.message || 'Ошибка при удалении упражнения';
      setErrorMessage(message);
      await reloadWorkoutEntries();
      alert(message);
    } finally {
      setDeletingEntryId(null);
    }
  };


  const handleAdd = () => {
    setSelectedCategory(null);
    setExercises([]);
    setSelectedExercises([]);
    setEditorInitialExercises([]);
    setEditorMode('add');
    applyFlowLayer('category');
  };

  const handleOpenCustomExercises = async () => {
    if (!user?.id) return;

    setSelectedCategory(CUSTOM_EXERCISES_CATEGORY);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const customExercises = await exerciseService.getCustomExercises(user.id);
      setExercises(customExercises);
      applyFlowLayer(getFlowLayerAfterCategoryExercisesLoad(true));
    } catch (error: any) {
      console.error('Ошибка загрузки моих упражнений:', error);
      setErrorMessage(error?.message || 'Не удалось загрузить мои упражнения');
      applyFlowLayer(getFlowLayerAfterCategoryExercisesLoad(false));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseExerciseListSheet = () => {
    setExercises([]);
    setSelectedCategory(null);
    setEditorMode('add');
    setEditorInitialExercises([]);
    if (shouldReturnToCategorySheetAfterExerciseListClose()) {
      applyFlowLayer('category');
    }
  };

  const handleCloseCreateExerciseModal = (reason: CreateExerciseModalCloseReason = 'cancel') => {
    const mode: CreateExerciseModalMode = editingCustomExercise ? 'edit' : 'create';
    setEditingCustomExercise(null);

    if (shouldReturnToCategorySheetAfterCreateExerciseClose(reason, mode)) {
      applyFlowLayer('category');
      return;
    }

    if (mode === 'edit') {
      applyFlowLayer('list');
    } else {
      applyFlowLayer('root');
    }
  };

  const handleEditCustomExercise = (exercise: Exercise) => {
    if (!user?.id) return;
    if (!exercise.is_custom || exercise.created_by_user_id !== user.id) {
      setErrorMessage('Можно редактировать только свои пользовательские упражнения');
      return;
    }

    setEditingCustomExercise(exercise);
    applyFlowLayer('create');
  };


  const handleCategorySelect = async (category: ExerciseCategory) => {
    setSelectedCategory(category);
    setEditorMode('add');
    setEditorInitialExercises([]);
    setIsLoading(true);
    
    try {
      const exs = await exerciseService.getExercisesByCategory(category.id, user?.id);
      setExercises(exs);
      applyFlowLayer(getFlowLayerAfterCategoryExercisesLoad(true));
    } catch (error) {
      console.error('Ошибка загрузки упражнений:', error);
      applyFlowLayer(getFlowLayerAfterCategoryExercisesLoad(false));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExercisesSelect = (selected: Exercise[]) => {
    // Всегда добавляем новые упражнения к существующим, если они есть
    setSelectedExercises(prev => {
      if (prev.length === 0) {
        return selected;
      }
      const existingIds = new Set(prev.map(ex => ex.id));
      const newExercises = selected.filter(ex => !existingIds.has(ex.id));
      return [...prev, ...newExercises];
    });
    setEditorMode('add');
    setEditorInitialExercises([]);
    applyFlowLayer(getFlowLayerAfterExerciseSelection());
  };

  const handleSaveSelectedExercises = async (exercises: SelectedExercise[]) => {
    if (!user?.id) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (editorMode === 'editWorkout') {
        const editableEntries = workoutEntries.filter((entry) => entry.exercise);
        await Promise.all(
          exercises.map((exercise, index) =>
            workoutService.updateWorkoutEntry(
              editableEntries[index].id,
              { sets: exercise.sets, reps: exercise.reps, weight: exercise.weight },
              editableEntries[index].updated_at,
              { userId: user.id, date: selectedDate },
            ),
          ),
        );
      } else {
        await workoutService.addExercisesToWorkout(user.id, selectedDate, exercises);
      }
      
      // Перезагружаем записи тренировки
      const entries = await workoutService.getWorkoutEntries(user.id, selectedDate);
      setWorkoutEntries(entries);

      if (editorMode === 'add') {
        const totalSets = exercises.reduce((sum, item) => sum + item.sets, 0);
        const totalVolume = exercises.reduce((sum, item) => sum + item.sets * item.reps * item.weight, 0);
        void coachRuntime.handleUserEvent(
          {
            type: 'WorkoutCompleted',
            timestamp: new Date().toISOString(),
            payload: {
              date: selectedDate,
              exercise_count: exercises.length,
              total_sets: totalSets,
              total_volume: totalVolume,
              source: 'ui',
            },
            confidence: 0.6,
            safetyClass: 'normal',
            trustImpact: 1,
          },
          buildCoachContext()
        );

        const prMap = readPrMap(user.id);
        const newPrs = exercises.filter((item) => {
          const exerciseId = item.exercise.id;
          const currentMax = prMap[exerciseId] ?? 0;
          if (item.weight > currentMax) {
            prMap[exerciseId] = item.weight;
            return true;
          }
          return false;
        });
        if (newPrs.length > 0) {
          writePrMap(user.id, prMap);
          void coachRuntime.handleUserEvent(
            {
              type: 'StrengthPR',
              timestamp: new Date().toISOString(),
              payload: {
                date: selectedDate,
                exercise_ids: newPrs.map((item) => item.exercise.id),
                exercise_names: newPrs.map((item) => item.exercise.name),
                source: 'ui',
              },
              confidence: 0.55,
              safetyClass: 'normal',
              trustImpact: 1,
            },
            buildCoachContext()
          );
        }
      }
      
      applyFlowLayer('root');
      setSelectedExercises([]);
      setEditorInitialExercises([]);
      setEditorMode('add');
    } catch (error: any) {
      console.error('Ошибка сохранения упражнений:', error);
      const errorMessage = error?.message || 'Ошибка при сохранении упражнений';
      setErrorMessage(errorMessage);
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };


  const handleHistory = () => {
    navigate('/workouts/history');
  };

  return (
    <ScreenContainer
      backgroundColor={WORKOUT_SCREEN_BACKGROUND}
      contentClassName={WORKOUT_MAIN_CONTAINER_CLASS}
    >
        <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
          <div style={{ width: 32 }} />
          <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>
            Дневник тренировок
          </h1>
          <Button variant="ghost" size="sm" onClick={handleClose} aria-label="Закрыть">
            <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0" style={{ paddingBottom: spacing.lg }}>
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              <div className="flex flex-col gap-2 min-[376px]:flex-row min-[376px]:items-center min-[376px]:justify-between">
                <span>{errorMessage}</span>
                {trustMessage && <span className="text-xs text-red-700 dark:text-red-200">{trustMessage}</span>}
                <button
                  onClick={() => {
                    uiRuntimeAdapter.recover().finally(reloadWorkoutEntries);
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/50"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
          {runtimeStatus === 'offline' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Работаем офлайн. Данные могут быть неактуальны.
              <button
                onClick={() => {
                  uiRuntimeAdapter.revalidate().finally(reloadWorkoutEntries);
                }}
                className="ml-3 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Обновить
              </button>
            </div>
          )}
          {runtimeStatus === 'recovery' && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Идёт восстановление данных. Продолжаем безопасно.
            </div>
          )}
          {runtimeStatus === 'partial' && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Данные доступны частично. Мы покажем то, что уже есть.
            </div>
          )}
          {/* Calendar Section */}
          <div className="mb-4 min-[376px]:mb-6 w-full max-w-full">
            {/* Month */}
            <div className="flex items-center justify-between mb-4 min-[376px]:mb-6">
              <div className="relative flex flex-col gap-1 w-full z-10">
                <button 
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity w-fit"
                >
                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatSelectedDate()}
                  </span>
                </button>
                
                {/* Календарь поверх контента */}
                <div
                  ref={calendarRef}
                  className={`absolute top-full left-0 right-0 mt-2 z-50 transition-all duration-300 ease-in-out ${
                    isCalendarOpen 
                      ? 'opacity-100 translate-y-0 pointer-events-auto' 
                      : 'opacity-0 -translate-y-2 pointer-events-none'
                  }`}
                >
                  {isCalendarOpen && (
                    <InlineCalendar
                      selectedDate={selectedDate}
                      onDateSelect={(date) => {
                        setSelectedDate(date);
                        setIsCalendarOpen(false);
                      }}
                      onClose={() => setIsCalendarOpen(false)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Week Calendar */}
            <div className="grid grid-cols-7 gap-1 mb-6 w-full">
              {dates.map((date) => (
                <button
                  key={date.date}
                  onClick={() => setSelectedDate(date.date)}
                  className={`flex flex-col items-center justify-center h-[54px] w-full rounded-full transition-colors ${
                    selectedDate === date.date
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-[13px] font-semibold leading-tight">{date.day}</span>
                  <span className={`text-[11px] leading-tight ${selectedDate === date.date ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {date.weekday}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Workout Section */}
          <div className="mb-4 min-[376px]:mb-6 w-full max-w-full overflow-hidden">
            <div className="flex items-center justify-between mb-3 min-[376px]:mb-4 w-full max-w-full">
              <h2 className="text-sm min-[376px]:text-base font-semibold text-gray-900 dark:text-white">
                Моя тренировка
              </h2>
              <div className="flex items-center gap-2 min-[376px]:gap-3">
                <button
                  onClick={handleHistory}
                  className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="История тренировок"
                >
                  <Clock className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={() => void handleOpenWorkoutDayNote()}
                  disabled={isLoadingWorkoutDayNote || isDeletingWorkout || isSaving || isLoading}
                  className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Заметка к тренировке"
                >
                  <StickyNote className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={handleEditWorkout}
                  className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Редактировать"
                >
                  <Edit className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={handleDeleteWorkout}
                  disabled={isDeletingWorkout || isSaving || isLoading || workoutEntries.length === 0}
                  className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <div className="relative">
              <ExerciseTableHeader />

              {activeWorkoutEntryForNote ? (
                <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 px-2">
                  <div className="pointer-events-auto mx-auto w-full max-w-[372px]">
                    <WorkoutEntryNoteComposer
                      isOpen={activeWorkoutEntryForNote !== null}
                      value={entryNoteDraft}
                      isSaving={isSavingEntryNote}
                      onChange={setEntryNoteDraft}
                      onCancel={handleCancelEntryNoteComposer}
                      onSave={handleSaveEntryNote}
                    />
                  </div>
                </div>
              ) : null}

              {/* Workout Entries */}
              {isLoading || runtimeStatus === 'loading' ? (
                <div className="flex items-center justify-center py-12 min-[376px]:py-16 w-full max-w-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              ) : workoutEntries.length === 0 ? (
                <div className="flex items-center justify-center py-12 min-[376px]:py-16 w-full max-w-full">
                  <p className="text-sm min-[376px]:text-base text-gray-500 dark:text-gray-400 text-center break-words overflow-wrap-anywhere">
                    Здесь будет ваша тренировка....
                  </p>
                </div>
              ) : (
                <div>
                  {workoutEntries.map((entry) => {
                    const note = entryNotesById[entry.id];
                    const isExpanded = expandedEntryNotes.has(entry.id);
                    const isDeleteConfirmOpen = entryNoteDeleteConfirmEntryId === entry.id;

                    return (
                      <div key={entry.id}>
                        <ExerciseRow
                          name={entry.exercise?.name || 'Неизвестное упражнение'}
                          sets={entry.sets}
                          reps={entry.reps}
                          weight={entry.displayAmount ?? entry.weight}
                          unit={entry.displayUnit ?? 'кг'}
                          onEdit={() => handleEditEntry(entry.id)}
                          onDelete={() => void handleDeleteEntry(entry.id)}
                          onNote={() => void handleOpenEntryNote(entry.id)}
                          onMedia={() => console.log('media', entry.id)}
                        />
                        {note ? (
                          <WorkoutEntryInlineNote
                            note={note}
                            isExpanded={isExpanded}
                            isDeleteConfirmOpen={isDeleteConfirmOpen}
                            isDeleting={isDeletingEntryNote}
                            onToggle={() => handleToggleEntryNote(entry.id)}
                            onRequestDelete={() => handleRequestDeleteEntryNote(entry.id)}
                            onConfirmDelete={() => handleDeleteEntryNote(entry.id)}
                            onCancelDelete={handleCancelDeleteEntryNote}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {workoutDayNote?.trim() ? (
              <WorkoutDayNoteBlock
                note={workoutDayNote}
                isDeleting={isDeletingWorkoutDayNote}
                onEdit={() => setIsWorkoutDayNoteOpen(true)}
                onDelete={() => void handleDeleteWorkoutDayNoteFromBlock()}
              />
            ) : null}
          </div>
        </main>

        {/* Bottom Navigation */}
        <div className={WORKOUT_BOTTOM_BAR_CLASS}>
          <div className="flex items-center justify-center px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 w-full max-w-full">
            <button
              onClick={handleAdd}
              className="flex flex-col items-center justify-center gap-1 min-[376px]:gap-1.5 text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-w-0"
            >
              <div className="w-10 h-10 min-[376px]:w-12 min-[376px]:h-12 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center">
                <Plus className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6" />
              </div>
              <span className="text-[10px] min-[376px]:text-xs font-medium uppercase break-words overflow-wrap-anywhere">
                ДОБАВИТЬ
              </span>
            </button>
          </div>
        </div>
      {/* Exercise Category Sheet */}
      <ExerciseCategorySheet
        isOpen={isExerciseCategorySheetOpen}
        onClose={() => applyFlowLayer('root')}
        categories={categories}
        onCategorySelect={handleCategorySelect}
        onMyExercisesSelect={handleOpenCustomExercises}
        onCreateExercise={() => {
          setEditorMode('add');
          setEditingCustomExercise(null);
          applyFlowLayer('create');
        }}
      />

      {/* Create Exercise Modal */}
      {user?.id && (
        <CreateExerciseModal
          isOpen={isCreateExerciseModalOpen}
          onClose={handleCloseCreateExerciseModal}
          onExerciseSaved={async () => {
            const cats = await exerciseService.getCategories();
            setCategories(cats);

            if (editingCustomExercise && selectedCategory?.id === CUSTOM_EXERCISES_CATEGORY.id && user?.id) {
              const customExercises = await exerciseService.getCustomExercises(user.id);
              setExercises(customExercises);
              applyFlowLayer('list');
              return;
            }

            setSelectedCategory(null);
            setExercises([]);
            setSelectedExercises([]);
            setEditorInitialExercises([]);
            setEditorMode('add');
            applyFlowLayer('category');
          }}
          userId={user.id}
          mode={editingCustomExercise ? 'edit' : 'create'}
          initialExercise={editingCustomExercise}
        />
      )}

      {/* Exercise List Sheet */}
      <ExerciseListSheet
        isOpen={isExerciseListSheetOpen}
        onClose={handleCloseExerciseListSheet}
        category={selectedCategory}
        exercises={exercises}
        onExercisesSelect={handleExercisesSelect}
        onEditExercise={selectedCategory?.id === CUSTOM_EXERCISES_CATEGORY.id ? handleEditCustomExercise : undefined}
      />

      {/* Selected Exercises Editor */}
      <SelectedExercisesEditor
        isOpen={isSelectedExercisesEditorOpen}
        onClose={() => {
          applyFlowLayer('root');
          setSelectedExercises([]);
          setEditorInitialExercises([]);
          setEditorMode('add');
        }}
        exercises={selectedExercises}
        initialSelectedExercises={editorInitialExercises}
        onSave={handleSaveSelectedExercises}
        onAddExercise={editorMode === 'add'
          ? () => {
              setEditorInitialExercises([]);
              applyFlowLayer('category');
            }
          : undefined}
        isSaving={isSaving}
        title={editorMode === 'editWorkout' ? 'РЕДАКТИРОВАТЬ ТРЕНИРОВКУ' : 'ВЫБРАННЫЕ УПРАЖНЕНИЯ'}
      />

      <EditWorkoutEntryModal
        isOpen={editingEntry !== null}
        entry={editingEntry}
        isSaving={isUpdatingEntry}
        onClose={() => {
          if (isUpdatingEntry) return;
          setEditingEntry(null);
        }}
        onSave={handleSaveEditedEntry}
      />

      <MealNoteModal
        isOpen={isWorkoutDayNoteOpen}
        onClose={() => {
          if (isLoadingWorkoutDayNote) return;
          setIsWorkoutDayNoteOpen(false);
        }}
        initialNote={workoutDayNote}
        onSave={handleSaveWorkoutDayNote}
        onDelete={workoutDayNoteDayId && workoutDayNote ? handleDeleteWorkoutDayNote : undefined}
        textareaVariant="paleGreen"
      />
    </ScreenContainer>
  );
};

export default Workouts;
