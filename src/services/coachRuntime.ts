import type { CoachExplainabilityBinding, CoachMemoryEvent } from '../types/coachMemory';
import { createCoachMemoryFacade, type CoachMemoryFacade } from './coachMemoryFacade';

export type CoachScreen = 'Today' | 'Progress' | 'Habits' | 'Program' | 'Paywall';

export type CoachEmotionalState =
  | 'neutral'
  | 'motivated'
  | 'cautious'
  | 'fatigued'
  | 'discouraged'
  | 'recovering'
  | 'confident'
  | 'trust_building'
  | 'trust_repair';

export type CoachUiSurface = 'card' | 'nudge' | 'dialog' | 'banner' | 'timeline_comment';

export type CoachUiMode =
  | 'support'
  | 'motivate'
  | 'stabilize'
  | 'protect'
  | 'celebrate'
  | 'guide'
  | 'reframe';

export interface CoachScreenContext {
  screen: CoachScreen;
  userMode: 'Manual' | 'Follow Plan';
  subscriptionState: 'Free' | 'Premium' | 'Trial' | 'Grace' | 'Expired';
  trustLevel?: number;
  confidenceLevel?: number;
  fatigueLevel?: number;
  relapseRisk?: number;
  motivationLevel?: number;
  safetyFlags?: string[];
  adherence?: number;
  streak?: number;
  timeGapDays?: number;
}

export interface CoachResponse {
  decision_id?: string;
  coach_message: string;
  emotional_state: CoachEmotionalState;
  ui_surface: CoachUiSurface;
  ui_mode: CoachUiMode;
  reasoning?: string;
  memory_refs?: string[];
  trust_state?: string;
  trust_reason?: string;
  safety_flags?: string[];
  safety_reason?: string;
  confidence?: number;
  personalization_basis?: string;
  data_sources?: string[];
  cta?: { label: string; action: string };
  explainability?: CoachExplainabilityBinding;
}

const emotionalStateToMode: Record<CoachEmotionalState, CoachUiMode> = {
  neutral: 'support',
  motivated: 'motivate',
  cautious: 'protect',
  fatigued: 'stabilize',
  discouraged: 'reframe',
  recovering: 'support',
  confident: 'celebrate',
  trust_building: 'guide',
  trust_repair: 'support',
};

const responseByEvent: Partial<Record<CoachMemoryEvent['type'], { message: string; surface: CoachUiSurface }>> = {
  DayCompleted: { message: 'Ты завершил день. Это укрепляет доверие к себе.', surface: 'card' },
  DaySkipped: { message: 'Ничего страшного. Давай мягко вернемся к ритму.', surface: 'dialog' },
  HabitCompleted: { message: 'Отличный шаг. Ритм становится устойчивее.', surface: 'card' },
  HabitBroken: { message: 'Срыв — часть пути. Сделаем маленький шаг возвращения.', surface: 'dialog' },
  StreakRecovered: { message: 'Ты вернулся в ритм. Это важнее идеальности.', surface: 'card' },
  PlateauDetected: { message: 'Плато — это фаза. Давай настроим микро‑фокус.', surface: 'card' },
  RegressionDetected: { message: 'Регресс — часть пути. Поддержим восстановление.', surface: 'card' },
  Breakthrough: { message: 'Это прорыв. Зафиксируем ритм и бережно усилим план.', surface: 'timeline_comment' },
  StrengthPR: { message: 'Сильный шаг. Я вижу рост и устойчивость.', surface: 'timeline_comment' },
  MealLogged: { message: 'Запись питания сделана. Это поддерживает фокус.', surface: 'nudge' },
  CalorieOverTarget: { message: 'Есть перебор по калориям. Без давления — просто скорректируем.', surface: 'card' },
  ProteinBelowTarget: { message: 'Белка сегодня мало. Мягко добавим опору для восстановления.', surface: 'card' },
  WorkoutCompleted: { message: 'Тренировка завершена. Хороший вклад в устойчивость.', surface: 'card' },
  TrainingSkipped: { message: 'Пропуск тренировки — сигнал. Поддержим восстановление.', surface: 'card' },
  PainReported: { message: 'Остановимся и сохраним безопасность. Нагрузка будет снижена.', surface: 'banner' },
  FatigueReported: { message: 'Твой ресурс сейчас важнее. Давай выберем восстановление.', surface: 'banner' },
  ProgressImproved: { message: 'Это заметный шаг вперед. Я вижу твою устойчивость.', surface: 'timeline_comment' },
  ReturnAfterPause: { message: 'Рад твоему возвращению. Начнем мягко.', surface: 'card' },
  PlanAdapted: { message: 'План изменен, чтобы поддержать твое состояние и цель.', surface: 'card' },
};

class CoachRuntime {
  constructor(private readonly facade: CoachMemoryFacade = createCoachMemoryFacade()) {}

  async handleUserEvent(event: CoachMemoryEvent, screenContext: CoachScreenContext): Promise<CoachResponse | null> {
    try {
      await this.facade.recordExperience(event, {
        sourceScreen: screenContext.screen,
      });
    } catch (error) {
      console.warn('[coachRuntime] recordExperience failed', error);
    }

    const emotional_state = this.evaluateEmotionalState(screenContext, event);
    const response = this.generateCoachResponse(event, screenContext, emotional_state);
    const trustLevel = screenContext.trustLevel ?? 50;

    const modulated = this.applyTrustModulation(response, trustLevel);
    const decisionId = `${event.type}:${event.timestamp}`;
    const explainability = await this.attachExplainability(modulated, decisionId, screenContext);

    return {
      ...modulated,
      decision_id: decisionId,
      explainability,
    };
  }

  async getCoachOverlay(screenContext: CoachScreenContext): Promise<CoachResponse | null> {
    const emotional_state = this.evaluateEmotionalState(screenContext);
    const baseMessage = screenContext.screen === 'Progress'
      ? 'Я рядом, чтобы помочь увидеть твой путь ясно.'
      : 'Я рядом, чтобы поддержать тебя сегодня.';

    const response: CoachResponse = {
      decision_id: `overlay:${screenContext.screen}:${Date.now()}`,
      coach_message: baseMessage,
      emotional_state,
      ui_surface: 'nudge',
      ui_mode: emotionalStateToMode[emotional_state],
      confidence: screenContext.confidenceLevel,
      safety_flags: screenContext.safetyFlags,
      trust_state: this.describeTrust(screenContext.trustLevel),
      trust_reason: this.describeTrustReason(screenContext.trustLevel),
      safety_reason: screenContext.safetyFlags?.length ? 'safety_flags' : undefined,
    };

    const modulated = this.applyTrustModulation(response, screenContext.trustLevel ?? 50);
    return this.applyEntitlementGate(modulated, screenContext.subscriptionState);
  }

  getCoachNudge(type: 'morning' | 'evening' | 'recovery' | 'motivation'): CoachResponse {
    const messageMap: Record<typeof type, string> = {
      morning: 'Новый день. Давай начнем спокойно и уверенно.',
      evening: 'Хорошая работа сегодня. Завершим день мягко.',
      recovery: 'Восстановление — это тоже прогресс. Я рядом.',
      motivation: 'Ты движешься вперед. Сфокусируемся на главном.',
    };

    return {
      decision_id: `nudge:${type}:${Date.now()}`,
      coach_message: messageMap[type],
      emotional_state: type === 'recovery' ? 'recovering' : 'motivated',
      ui_surface: 'nudge',
      ui_mode: type === 'recovery' ? 'support' : 'motivate',
    };
  }

  async getExplainability(
    decisionId: string,
    context?: Pick<CoachScreenContext, 'subscriptionState'>
  ): Promise<CoachExplainabilityBinding | null> {
    try {
      const trace = await this.facade.getExplainableReasoningTrace(decisionId);
      if (!this.hasPremiumAccess(context?.subscriptionState)) {
        return {
          ...trace,
          memory_refs: [],
          trust_history: [],
          pattern_matches: [],
        };
      }
      return trace;
    } catch (error) {
      console.warn('[coachRuntime] explainability trace not available', error);
      return null;
    }
  }

  generateCoachResponse(
    event: CoachMemoryEvent,
    screenContext: CoachScreenContext,
    emotional_state: CoachEmotionalState
  ): CoachResponse {
    const fallback = responseByEvent[event.type] ?? {
      message: 'Я рядом. Давай двигаться мягко и уверенно.',
      surface: 'card',
    };

    const response: CoachResponse = {
      decision_id: `${event.type}:${event.timestamp}`,
      coach_message: fallback.message,
      emotional_state,
      ui_surface: fallback.surface,
      ui_mode: emotionalStateToMode[emotional_state],
      confidence: event.confidence,
      safety_flags: screenContext.safetyFlags,
      trust_state: this.describeTrust(screenContext.trustLevel),
      trust_reason: this.describeTrustReason(screenContext.trustLevel),
      safety_reason: screenContext.safetyFlags?.length ? 'safety_flags' : undefined,
      personalization_basis: 'history_context',
    };

    return this.applyEntitlementGate(response, screenContext.subscriptionState);
  }

  evaluateEmotionalState(
    context: CoachScreenContext,
    event?: CoachMemoryEvent
  ): CoachEmotionalState {
    if (event?.safetyClass === 'medical_risk' || context.safetyFlags?.length) {
      return 'cautious';
    }

    if (context.fatigueLevel && context.fatigueLevel > 0.7) {
      return 'fatigued';
    }

    if (context.relapseRisk && context.relapseRisk > 0.6) {
      return 'recovering';
    }

    if (context.trustLevel !== undefined && context.trustLevel < 40) {
      return 'trust_repair';
    }

    if (context.trustLevel !== undefined && context.trustLevel >= 70) {
      return 'confident';
    }

    if (context.streak && context.streak >= 5) {
      return 'motivated';
    }

    return 'neutral';
  }

  applyTrustModulation(response: CoachResponse, trustLevel: number): CoachResponse {
    if (trustLevel < 35) {
      return {
        ...response,
        coach_message: `${response.coach_message} Я рядом, даже если сложно. Будем двигаться шаг за шагом.`,
        trust_state: 'trust_repair',
      };
    }

    if (trustLevel > 75) {
      return {
        ...response,
        coach_message: `${response.coach_message} Ты уже много раз показывал устойчивость. Давай без давления.`,
        trust_state: 'stable',
      };
    }

    if (trustLevel >= 35 && trustLevel < 60) {
      return {
        ...response,
        coach_message: `${response.coach_message} Я вижу, ты стараешься.`,
      };
    }

    if (trustLevel >= 60 && trustLevel <= 75) {
      return {
        ...response,
        coach_message: `${response.coach_message} Давай сохраним ритм без давления.`,
      };
    }

    return response;
  }

  async attachExplainability(
    response: CoachResponse,
    decisionId: string,
    context: CoachScreenContext
  ): Promise<CoachExplainabilityBinding | undefined> {
    try {
      const trace = await this.facade.getExplainableReasoningTrace(decisionId);
      const gatedTrace = this.hasPremiumAccess(context.subscriptionState)
        ? trace
        : {
            ...trace,
            memory_refs: [],
            trust_history: [],
            pattern_matches: [],
          };
      response.memory_refs = gatedTrace.memory_refs.map((ref) => ref.summary);
      response.data_sources = gatedTrace.memory_refs.map((ref) => ref.ref);
      return gatedTrace;
    } catch (error) {
      const fallbackTrace: CoachExplainabilityBinding = {
        decisionId,
        memory_refs: [],
        trust_history: [],
        emotional_state: 'calm',
        safety_flags: context.safetyFlags ?? [],
        pattern_matches: [],
      };
      return fallbackTrace;
    }
  }

  private hasPremiumAccess(state?: CoachScreenContext['subscriptionState']): boolean {
    if (!state) return false;
    return state === 'Premium' || state === 'Trial' || state === 'Grace';
  }

  private applyEntitlementGate(
    response: CoachResponse,
    subscriptionState: CoachScreenContext['subscriptionState']
  ): CoachResponse {
    if (this.hasPremiumAccess(subscriptionState)) return response;

    return {
      ...response,
      emotional_state: 'neutral',
      ui_mode: 'support',
      personalization_basis: undefined,
      memory_refs: undefined,
      data_sources: undefined,
      trust_reason: undefined,
    };
  }

  private describeTrust(trustLevel?: number): string | undefined {
    if (trustLevel === undefined) return undefined;
    if (trustLevel < 40) return 'low';
    if (trustLevel < 70) return 'building';
    return 'stable';
  }

  private describeTrustReason(trustLevel?: number): string | undefined {
    if (trustLevel === undefined) return undefined;
    if (trustLevel < 40) return 'trust_low_recent_events';
    if (trustLevel < 70) return 'trust_building_consistency';
    return 'trust_stable_history';
  }
}

export const coachRuntime = new CoachRuntime();
