import type { DailyMeals } from '../types';
import type { WorkoutEntry } from '../types/workout';
import type { ProgramTodayDTO, ProgramMyPlanDTO } from '../types/programDelivery';
import type { UserGoal } from './goalService';
import type { Measurement, MeasurementHistory, PhotoHistory } from './measurementsService';
import type {
  BaseExplainabilityDTO,
  HabitsExplainabilityDTO,
  PaywallExplainabilityDTO,
  ProgramExplainabilityDTO,
  ProgressExplainabilityDTO,
  TodayExplainabilityDTO,
} from '../types/explainability';
import { programUxRuntimeService } from './programUxRuntimeService';
import { programDeliveryService, ProgramType } from './programDeliveryService';
import { progressAggregatorService, ProgressSnapshot, TrendSummary } from './progressAggregatorService';
import { habitsService, HabitWithStatus } from './habitsService';
import { entitlementService } from './entitlementService';
import { goalService } from './goalService';
import { profileService, UserProfile } from './profileService';
import type { CoachSettings } from '../types/coachSettings';
import { measurementsService } from './measurementsService';
import { mealService } from './mealService';
import { workoutService } from './workoutService';
import { aggregateWorkoutEntries } from '../utils/workoutMetrics';
import { classifyTrustDecision, TrustDecision } from './trustSafetyService';
import { coachRuntime, type CoachResponse, type CoachScreen, type CoachScreenContext } from './coachRuntime';

export type RuntimeStatus =
  | 'loading'
  | 'active'
  | 'empty'
  | 'error'
  | 'blocked'
  | 'offline'
  | 'recovery'
  | 'partial'
  | 'explainable';

export interface RuntimeContext {
  goal?: UserGoal | null;
  measurements?: Measurement[];
  meals?: DailyMeals | null;
  workouts?: WorkoutEntry[] | null;
  habits?: HabitWithStatus[];
}

export interface TodayState {
  status: RuntimeStatus;
  message?: string;
  program?: ProgramTodayDTO | null;
  context?: RuntimeContext;
  explainability?: TodayExplainabilityDTO;
  trust?: TrustDecision;
}

export interface ProgramState {
  status: RuntimeStatus;
  message?: string;
  program?: ProgramMyPlanDTO | null;
  context?: RuntimeContext;
  explainability?: ProgramExplainabilityDTO;
  trust?: TrustDecision;
}

export interface ProgressState {
  status: RuntimeStatus;
  message?: string;
  snapshot?: ProgressSnapshot | null;
  trends?: TrendSummary | null;
  context?: RuntimeContext;
  explainability?: ProgressExplainabilityDTO;
  trust?: TrustDecision;
}

export interface HabitsState {
  status: RuntimeStatus;
  message?: string;
  habits?: HabitWithStatus[];
  habitStats?: Record<string, { streak: number; adherence: number }>;
  context?: RuntimeContext;
  explainability?: HabitsExplainabilityDTO;
  trust?: TrustDecision;
}

export interface PaywallState {
  status: RuntimeStatus;
  message?: string;
  paywall?: unknown;
  explainability?: PaywallExplainabilityDTO;
  trust?: TrustDecision;
}

export interface GoalState {
  status: RuntimeStatus;
  message?: string;
  goal?: UserGoal | null;
  explainability?: BaseExplainabilityDTO;
  trust?: TrustDecision;
}

export interface MeasurementsState {
  status: RuntimeStatus;
  message?: string;
  measurements?: Measurement[];
  photos?: string[];
  additionalPhotos?: string[];
  history?: MeasurementHistory[];
  photoHistory?: PhotoHistory[];
  explainability?: BaseExplainabilityDTO;
  trust?: TrustDecision;
}

export interface FoodDiaryState {
  status: RuntimeStatus;
  message?: string;
  meals?: DailyMeals | null;
  goal?: UserGoal | null;
  explainability?: BaseExplainabilityDTO;
  trust?: TrustDecision;
}

export interface TrainingDiaryState {
  status: RuntimeStatus;
  message?: string;
  entries?: WorkoutEntry[];
  totals?: ReturnType<typeof aggregateWorkoutEntries> | null;
  explainability?: BaseExplainabilityDTO;
  trust?: TrustDecision;
}

export interface ProfileState {
  status: RuntimeStatus;
  message?: string;
  profile?: UserProfile | null;
  entitlements?: unknown;
  explainability?: BaseExplainabilityDTO;
  trust?: TrustDecision;
}

class UiRuntimeAdapter {
  private readonly LOADING_TIMEOUT_MS = 15000;
  private loadingTimers = new Map<string, number>();

  startLoadingTimer(
    screenName: string,
    options?: {
      pendingSources?: string[];
      authState?: string;
      network?: string;
      onTimeout?: () => void;
    }
  ) {
    this.clearLoadingTimer(screenName);
    const timeoutId = window.setTimeout(() => {
      console.warn('[RuntimeWatchdog] Stuck in loading >15s', {
        screen: screenName,
        pendingSources: options?.pendingSources ?? [],
        authState: options?.authState ?? 'unknown',
        network:
          options?.network ??
          (typeof navigator !== 'undefined' && 'onLine' in navigator
            ? navigator.onLine
              ? 'online'
              : 'offline'
            : 'unknown'),
      });
      options?.onTimeout?.();
    }, this.LOADING_TIMEOUT_MS);
    this.loadingTimers.set(screenName, timeoutId);
  }

  clearLoadingTimer(screenName: string) {
    const timer = this.loadingTimers.get(screenName);
    if (timer) {
      window.clearTimeout(timer);
      this.loadingTimers.delete(screenName);
    }
  }

  private async runWithTimeout<T>(
    screenName: string,
    pendingSources: string[],
    task: () => Promise<T>
  ): Promise<T> {
    this.startLoadingTimer(screenName, { pendingSources });
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error('loading_timeout'));
      }, this.LOADING_TIMEOUT_MS);
    });
    try {
      return await Promise.race([task(), timeoutPromise]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      this.clearLoadingTimer(screenName);
    }
  }
  private async buildContext(userId: string, date: string): Promise<RuntimeContext> {
    const [goal, measurements, meals, workouts, habits] = await Promise.all([
      goalService.getUserGoal(userId).catch(() => null),
      measurementsService.getCurrentMeasurements(userId).catch(() => [] as Measurement[]),
      mealService.getMealsForDate(userId, date).catch(() => null),
      workoutService.getWorkoutEntries(userId, date).catch(() => [] as WorkoutEntry[]),
      habitsService.getHabitsForDate({ userId, date }).catch(() => [] as HabitWithStatus[]),
    ]);

    return { goal, measurements, meals, workouts, habits };
  }

  private toRuntimeStatus(status?: string): RuntimeStatus {
    if (status === 'offline_readonly') return 'offline';
    if (status === 'blocked') return 'error';
    if (status === 'paused') return 'recovery';
    if (status === 'ready') return 'active';
    return 'active';
  }

  private buildBaseExplainability(params: {
    decisionRef: string;
    dataSources: string[];
    confidence: number;
    trustScore?: number;
    safetyNotes?: string[];
  }): BaseExplainabilityDTO {
    return {
      source: 'manual',
      version: '1.0',
      data_sources: params.dataSources,
      confidence: params.confidence,
      trust_score: params.trustScore ?? 50,
      decision_ref: params.decisionRef,
      safety_notes: params.safetyNotes ?? [],
    };
  }

  async getGoalState(userId: string): Promise<GoalState> {
    try {
      const goal = await this.runWithTimeout('Goal', ['user_goals', 'local_cache'], () =>
        goalService.getUserGoal(userId)
      );
      const hasGoal = Boolean(goal && (goal.calories || goal.protein || goal.fat || goal.carbs));
      const explainability = this.buildBaseExplainability({
        decisionRef: hasGoal ? 'goal:loaded' : 'goal:empty',
        dataSources: ['user_goals', 'local_cache'],
        confidence: hasGoal ? 0.9 : 0.3,
        safetyNotes: hasGoal ? [] : ['Цель ещё не задана.'],
      });
      const trust = classifyTrustDecision(undefined, { confidence: explainability.confidence });
      return {
        status: hasGoal ? 'active' : 'empty',
        goal,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить цель.',
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getMeasurementsState(userId: string): Promise<MeasurementsState> {
    try {
      const [measurements, photosPayload, history, photoHistory] = await this.runWithTimeout(
        'Measurements',
        ['user_measurements', 'measurement_history', 'measurement_photo_history'],
        () =>
          Promise.all([
            measurementsService.getCurrentMeasurements(userId),
            measurementsService.getCurrentPhotos(userId),
            measurementsService.getMeasurementHistory(userId),
            measurementsService.getPhotoHistory(userId),
          ])
      );

      const explainability = this.buildBaseExplainability({
        decisionRef: 'measurements:loaded',
        dataSources: ['user_measurements', 'measurement_history', 'measurement_photos'],
        confidence: 0.8,
      });
      const trust = classifyTrustDecision(undefined, { confidence: explainability.confidence });

      return {
        status: 'active',
        measurements,
        photos: photosPayload?.photos ?? [],
        additionalPhotos: photosPayload?.additionalPhotos ?? [],
        history,
        photoHistory,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить замеры.',
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getFoodDiaryState(userId: string, date: string): Promise<FoodDiaryState> {
    try {
      const [meals, goal] = await this.runWithTimeout(
        'FoodDiary',
        ['food_diary_entries', 'user_goals', 'local_cache'],
        () =>
          Promise.all([
            mealService.getMealsForDate(userId, date),
            goalService.getUserGoal(userId).catch(() => null),
          ])
      );

      const isEmpty =
        !meals ||
        ((meals.breakfast?.length ?? 0) +
          (meals.lunch?.length ?? 0) +
          (meals.dinner?.length ?? 0) +
          (meals.snack?.length ?? 0)) === 0;

      const explainability = this.buildBaseExplainability({
        decisionRef: isEmpty ? 'food_diary:empty' : 'food_diary:loaded',
        dataSources: ['food_diary_entries', 'local_cache', 'user_goals'],
        confidence: isEmpty ? 0.4 : 0.9,
        safetyNotes: isEmpty ? ['День пока пустой.'] : [],
      });

      const trust = classifyTrustDecision(undefined, { confidence: explainability.confidence });

      return {
        status: isEmpty ? 'empty' : 'active',
        meals,
        goal,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить дневник питания.',
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getTodayState(userId: string, programType: ProgramType = 'nutrition'): Promise<TodayState> {
    const date = new Date().toISOString().split('T')[0];
    const context = await this.buildContext(userId, date);

    try {
      const { program } = await this.runWithTimeout('Today', ['programs'], () =>
        programDeliveryService.getActiveProgram(programType)
      );
      const programId = program?.id ?? program?.program_id ?? program?.programId;
      if (!programId) {
        return { status: 'empty', context };
      }

      const [today, explainability] = await this.runWithTimeout(
        'Today',
        ['program_sessions', 'program_explainability'],
        () => Promise.all([
          programUxRuntimeService.getToday(programId, programType),
          programUxRuntimeService.explain(),
        ])
      );
      const trust = classifyTrustDecision(undefined, {
        confidence: explainability.confidence,
        safetyFlags: explainability.safety_flags,
      });

      return {
        status: this.toRuntimeStatus(today.state.status),
        message: today.state.message,
        program: today.data ?? null,
        context,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить Today.',
        context,
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getProgramState(userId: string, programType: ProgramType = 'nutrition'): Promise<ProgramState> {
    const date = new Date().toISOString().split('T')[0];
    const context = await this.buildContext(userId, date);

    try {
      const { program } = await this.runWithTimeout('MyProgram', ['programs'], () =>
        programDeliveryService.getActiveProgram(programType)
      );
      const programId = program?.id ?? program?.program_id ?? program?.programId;
      if (!programId) {
        return { status: 'empty', context };
      }

      const [plan, explainability] = await this.runWithTimeout(
        'MyProgram',
        ['program_days', 'program_explainability'],
        () => Promise.all([
          programUxRuntimeService.getMyProgram(programId, programType),
          programDeliveryService.explain(),
        ])
      );
      const trust = classifyTrustDecision(undefined, {
        confidence: explainability.confidence,
        safetyFlags: explainability.safety_flags,
      });

      return {
        status: 'active',
        program: plan,
        context,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить программу.',
        context,
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getProgressState(userId: string, date: string): Promise<ProgressState> {
    const context = await this.buildContext(userId, date);
    const fromDate = new Date(new Date(date).getTime() - 29 * 86400000).toISOString().split('T')[0];

    try {
      const [snapshot, trends, explainability] = await this.runWithTimeout(
        'Progress',
        ['measurement_history', 'food_diary_entries', 'workout_entries', 'user_goals'],
        () =>
          Promise.all([
            progressAggregatorService.progressSnapshot(userId, date),
            progressAggregatorService.trendSummary(userId, fromDate, date),
            progressAggregatorService.explain(),
          ])
      );

      const trust = classifyTrustDecision(undefined, {
        confidence: explainability.confidence,
        safetyFlags: explainability.safety_flags,
      });

      return {
        status: snapshot && trends ? 'active' : 'partial',
        snapshot,
        trends,
        context,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить прогресс.',
        context,
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getHabitsState(userId: string, date: string): Promise<HabitsState> {
    const context = await this.buildContext(userId, date);

    try {
      const [habits, explainability] = await this.runWithTimeout(
        'Habits',
        ['habits', 'habit_logs'],
        () =>
          Promise.all([
            habitsService.getHabitsForDate({ userId, date }),
            habitsService.explain(),
          ])
      );
      const fromDate = new Date(new Date(date).getTime() - 6 * 86400000).toISOString().split('T')[0];
      const statsEntries = await Promise.all(
        habits.map(async (habit) => ({
          habitId: habit.id,
          stats: await habitsService.getHabitStats({ userId, habitId: habit.id, fromDate, toDate: date }),
        }))
      );
      const habitStats = statsEntries.reduce<Record<string, { streak: number; adherence: number }>>((acc, item) => {
        acc[item.habitId] = item.stats;
        return acc;
      }, {});

      const trust = classifyTrustDecision(undefined, {
        confidence: explainability.confidence,
        safetyFlags: explainability.safety_flags,
      });

      return {
        status: 'active',
        habits,
        habitStats,
        context,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить привычки.',
        context,
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getPaywallState(feature: 'adaptation' | 'explainability' | 'spatial'): Promise<PaywallState> {
    try {
      const [paywall, explainability] = await this.runWithTimeout(
        'Paywall',
        ['entitlements', 'paywall_state'],
        () =>
          Promise.all([
            entitlementService.getPaywallState(feature),
            entitlementService.explain(),
          ])
      );
      const trust = classifyTrustDecision(undefined, {
        confidence: explainability.confidence,
        safetyFlags: explainability.safety_flags,
      });
      return { status: 'active', paywall, explainability, trust };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить paywall.',
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getTrainingDiaryState(userId: string, date: string): Promise<TrainingDiaryState> {
    try {
      const entries = await this.runWithTimeout(
        'TrainingDiary',
        ['workout_entries', 'local_cache'],
        () => workoutService.getWorkoutEntries(userId, date)
      );
      const totals = aggregateWorkoutEntries(entries || []);
      const explainability = this.buildBaseExplainability({
        decisionRef: entries.length ? 'training:loaded' : 'training:empty',
        dataSources: ['workout_entries', 'local_cache'],
        confidence: entries.length ? 0.8 : 0.4,
        safetyNotes: entries.length ? [] : ['Тренировок за день пока нет.'],
      });
      const trust = classifyTrustDecision(undefined, { confidence: explainability.confidence });
      return {
        status: entries.length ? 'active' : 'empty',
        entries,
        totals,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить тренировку.',
        trust: classifyTrustDecision(error),
      };
    }
  }

  async getProfileState(userId: string): Promise<ProfileState> {
    try {
      const [profile, entitlements] = await this.runWithTimeout(
        'Profile',
        ['user_profiles', 'entitlements'],
        () =>
          Promise.all([
            profileService.getProfile(userId).catch(() => null),
            entitlementService.getEntitlements(userId).catch(() => null),
          ])
      );

      const isPartial = !profile || !entitlements;
      const explainability = this.buildBaseExplainability({
        decisionRef: isPartial ? 'profile:partial' : 'profile:loaded',
        dataSources: ['user_profiles', 'entitlements'],
        confidence: isPartial ? 0.5 : 0.9,
        safetyNotes: isPartial ? ['Часть данных профиля недоступна.'] : [],
      });
      const trust = classifyTrustDecision(undefined, { confidence: explainability.confidence });

      return {
        status: isPartial ? 'partial' : 'active',
        profile,
        entitlements,
        explainability,
        trust,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Не удалось загрузить профиль.',
        trust: classifyTrustDecision(error),
      };
    }
  }
  async offlineSnapshot(): Promise<void> {
    await Promise.all([
      programUxRuntimeService.offlineSnapshot(),
      programDeliveryService.offlineSnapshot(),
      progressAggregatorService.offlineSnapshot(),
      habitsService.offlineSnapshot(),
      entitlementService.offlineSnapshot(),
    ]);
  }

  async revalidate(): Promise<void> {
    await Promise.all([
      programUxRuntimeService.revalidate(),
      programDeliveryService.revalidate(),
      progressAggregatorService.revalidate(),
      habitsService.revalidate(),
      entitlementService.revalidate(),
    ]);
  }

  async recover(): Promise<void> {
    await Promise.all([
      programUxRuntimeService.recover(),
      programDeliveryService.recover(),
      progressAggregatorService.recover(),
      habitsService.recover(),
      entitlementService.recover(),
    ]);
  }

  private buildCoachContext(screen: CoachScreen, context: Partial<CoachScreenContext> = {}): CoachScreenContext {
    const confidenceLevel = context.confidenceLevel ?? (context.trustLevel ? context.trustLevel / 100 : undefined);

    return {
      screen,
      userMode: context.userMode ?? 'Manual',
      subscriptionState: context.subscriptionState ?? 'Free',
      trustLevel: context.trustLevel,
      confidenceLevel,
      fatigueLevel: context.fatigueLevel,
      relapseRisk: context.relapseRisk,
      motivationLevel: context.motivationLevel,
      safetyFlags: context.safetyFlags ?? [],
      adherence: context.adherence,
      streak: context.streak,
      timeGapDays: context.timeGapDays,
    };
  }

  private readCoachSettings(): CoachSettings {
    try {
      const raw = localStorage.getItem('potok_coach_settings');
      if (!raw) return { coach_enabled: true, coach_mode: 'support' };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as CoachSettings)
        : { coach_enabled: true, coach_mode: 'support' };
    } catch {
      return { coach_enabled: true, coach_mode: 'support' };
    }
  }

  async getCoachOverlay(
    screen: CoachScreen,
    context: Partial<CoachScreenContext> = {}
  ): Promise<CoachResponse | null> {
    const settings = this.readCoachSettings();
    const mode = settings.coach_enabled ? settings.coach_mode : 'off';
    if (mode === 'off' || mode === 'on_request') return null;
    if (mode === 'risk_only') {
      const hasRisk =
        (context.safetyFlags?.length ?? 0) > 0 ||
        (context.fatigueLevel ?? 0) > 0.6 ||
        (context.relapseRisk ?? 0) > 0.6;
      if (!hasRisk) return null;
    }
    const coachContext = this.buildCoachContext(screen, context);
    return coachRuntime.getCoachOverlay(coachContext);
  }

  getCoachNudge(type: 'morning' | 'evening' | 'recovery' | 'motivation'): CoachResponse {
    return coachRuntime.getCoachNudge(type);
  }

  async getCoachExplainability(decisionId: string, context?: Partial<CoachScreenContext>) {
    return coachRuntime.getExplainability(decisionId, {
      subscriptionState: context?.subscriptionState,
    });
  }
}

export const uiRuntimeAdapter = new UiRuntimeAdapter();
