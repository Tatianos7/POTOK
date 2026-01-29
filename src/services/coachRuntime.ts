import type { CoachExplainabilityBinding, CoachMemoryEvent } from '../types/coachMemory';
import type { CoachMode } from '../types/coachSettings';
import { createCoachMemoryFacade, type CoachMemoryFacade } from './coachMemoryFacade';
import { CircuitBreaker } from './coachCircuitBreaker';
import { coachTelemetry } from './coachTelemetry';

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

export interface CoachInterventionPolicy {
  mode: CoachMode;
  dailyNudgeLimit: number;
  minIntervalMinutes: number;
  cooldownAfterIgnoreHours: number;
  silent: boolean;
  respectUserSilence: boolean;
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

export interface CoachDecisionHistoryItem {
  decisionId: string;
  timestamp: string;
  dateLabel: string;
  screen: CoachScreen;
  decisionType: string;
  summary: string;
  reason?: string;
  data_sources: string[];
  impact?: string;
  trustState?: string;
  uiMode?: CoachUiMode;
}

export interface CoachDecisionHistoryQuery {
  from: string;
  to: string;
  screen?: CoachScreen;
  limit?: number;
}

export type CoachRequestIntent = 'explain' | 'support' | 'motivate' | 'clarify' | 'reflect' | 'reassure';

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
  ProteinOverTarget: { message: 'Белка стало больше нормы. Мягко вернем баланс без давления.', surface: 'card' },
  FatOverTarget: { message: 'Жиров больше нормы. Без давления — просто выровняем день.', surface: 'card' },
  CarbOverTarget: { message: 'Углеводов больше нормы. Сохраним ритм мягко.', surface: 'card' },
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
  private readonly dedupeKeys = new Set<string>();
  private readonly runtimeBreaker = new CircuitBreaker({ name: 'coachRuntime', failureThreshold: 2 });
  private readonly explainabilityBreaker = new CircuitBreaker({ name: 'explainability', failureThreshold: 2 });

  constructor(private readonly facade: CoachMemoryFacade = createCoachMemoryFacade()) {}

  async handleUserEvent(event: CoachMemoryEvent, screenContext: CoachScreenContext): Promise<CoachResponse | null> {
    const policy = this.getInterventionPolicy();
    if (!this.allowsEvent(policy, event)) {
      return null;
    }
    if (!this.runtimeBreaker.canRequest()) {
      return null;
    }
    const dedupeKey = this.buildDedupeKey(event, screenContext);
    if (this.dedupeKeys.has(dedupeKey)) {
      return null;
    }
    this.dedupeKeys.add(dedupeKey);

    const startedAt = performance.now();
    const eventId =
      event.id ??
      (globalThis.crypto?.randomUUID?.() ??
        `${event.type}:${event.timestamp}:${Math.random().toString(36).slice(2)}`);
    const normalizedEvent: CoachMemoryEvent = { ...event, id: eventId };
    const isSilent = Boolean((event.payload as Record<string, unknown>)?.silent);
    if (isSilent) {
      return null;
    }

    let memoryAvailable = true;
    try {
      if (policy.mode === 'off') {
        return null;
      }
      await this.facade.recordExperience(normalizedEvent, {
        sourceScreen: screenContext.screen,
      });
    } catch (error) {
      console.warn('[coachRuntime] recordExperience failed', error);
      memoryAvailable = false;
    }

    let emotional_state: CoachEmotionalState = 'neutral';
    try {
      emotional_state = this.evaluateEmotionalState(screenContext, normalizedEvent);
    } catch (error) {
      console.warn('[coachRuntime] emotional state failed', error);
      emotional_state = 'neutral';
    }
    let response = this.generateCoachResponse(normalizedEvent, screenContext, emotional_state);
    response = this.applySafetyGuards(response, screenContext, normalizedEvent);
    if (!memoryAvailable) {
      response = {
        ...response,
        personalization_basis: undefined,
      };
    }

    response = this.applyEntitlementGate(response, screenContext.subscriptionState);
    if (this.hasPremiumAccess(screenContext.subscriptionState)) {
      const trustLevel = screenContext.trustLevel ?? 50;
      response = this.applyTrustModulation(response, trustLevel);
    }
    const decisionId = `${normalizedEvent.type}:${normalizedEvent.timestamp}`;
    const explainability = await this.attachExplainability(response, decisionId, screenContext);
    coachTelemetry.trackTiming('coach_response_time', performance.now() - startedAt, {
      screen: screenContext.screen,
      event: normalizedEvent.type,
    });
    this.runtimeBreaker.recordSuccess();

    this.storeDecisionHistory({
      decisionId,
      timestamp: normalizedEvent.timestamp,
      screen: screenContext.screen,
      decisionType: normalizedEvent.type,
      summary: response.coach_message,
      reason: response.safety_reason ?? response.trust_reason,
      data_sources: response.data_sources ?? [],
      impact: response.trust_state ? `Тон: ${response.trust_state}` : undefined,
      trustState: response.trust_state,
      uiMode: response.ui_mode,
    });

    return {
      ...response,
      decision_id: decisionId,
      explainability,
    };
  }

  async getCoachOverlay(screenContext: CoachScreenContext): Promise<CoachResponse | null> {
    const policy = this.getInterventionPolicy();
    if (!this.allowsOverlay(policy, screenContext)) {
      return null;
    }
    if (!this.runtimeBreaker.canRequest()) {
      return null;
    }
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

    let gated = this.applyEntitlementGate(response, screenContext.subscriptionState);
    if (this.hasPremiumAccess(screenContext.subscriptionState)) {
      gated = this.applyTrustModulation(gated, screenContext.trustLevel ?? 50);
    }
    this.registerNudge(policy);
    return gated;
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
    if (!this.explainabilityBreaker.canRequest()) {
      return {
        decisionId,
        memory_refs: [],
        trust_history: [],
        emotional_state: 'calm',
        safety_flags: ['explainability_unavailable'],
        pattern_matches: [],
        explainabilityRef: 'explainability_unavailable',
      };
    }
    const startedAt = performance.now();
    try {
      const trace = await this.facade.getExplainableReasoningTrace(decisionId);
      coachTelemetry.trackTiming('explainability_latency', performance.now() - startedAt, {
        decisionId,
      });
      this.explainabilityBreaker.recordSuccess();
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
      this.explainabilityBreaker.recordFailure();
      return {
        decisionId,
        memory_refs: [],
        trust_history: [],
        emotional_state: 'calm',
        safety_flags: ['explainability_unavailable'],
        pattern_matches: [],
        explainabilityRef: 'explainability_unavailable',
      };
    }
  }

  async handleUserRequest(
    intent: CoachRequestIntent,
    screenContext: CoachScreenContext
  ): Promise<CoachResponse | null> {
    if (!this.runtimeBreaker.canRequest()) {
      return null;
    }
    const policy = this.getInterventionPolicy();
    if (policy.mode === 'off') return null;
    if (policy.mode === 'risk_only' && !(screenContext.safetyFlags?.length ?? 0)) {
      return null;
    }

    const rateLimited = this.isRequestRateLimited();
    if (rateLimited) {
      return {
        decision_id: `request:rate_limit:${Date.now()}`,
        coach_message: 'Давай сделаем паузу. Я отвечу чуть позже, чтобы сохранить ясность.',
        emotional_state: 'neutral',
        ui_surface: 'dialog',
        ui_mode: 'support',
        safety_reason: 'rate_limit',
      };
    }

    const baseMessage = this.buildRequestMessage(intent, screenContext);
    const event: CoachMemoryEvent = {
      type: 'UserRequest',
      timestamp: new Date().toISOString(),
      payload: { intent, source: 'user_request', screen: screenContext.screen },
      confidence: 0.7,
      safetyClass:
        intent === 'reassure' || (screenContext.safetyFlags?.length ?? 0) > 0 ? 'caution' : 'normal',
      trustImpact: 0,
    };

    let response: CoachResponse = {
      decision_id: `request:${intent}:${Date.now()}`,
      coach_message: baseMessage,
      emotional_state: 'neutral',
      ui_surface: 'dialog',
      ui_mode: 'support',
      safety_flags: screenContext.safetyFlags,
      trust_state: this.describeTrust(screenContext.trustLevel),
      trust_reason: this.describeTrustReason(screenContext.trustLevel),
      personalization_basis: 'user_request',
    };

    response = this.applySafetyGuards(response, screenContext, event);
    response = this.applyEntitlementGate(response, screenContext.subscriptionState);
    if (this.hasPremiumAccess(screenContext.subscriptionState)) {
      response = this.applyTrustModulation(response, screenContext.trustLevel ?? 50);
    }

    const decisionId = `request:${intent}:${Date.now()}`;
    const explainability = await this.attachExplainability(response, decisionId, screenContext);
    response.explainability = explainability;
    response.decision_id = decisionId;

    this.storeDecisionHistory({
      decisionId,
      timestamp: event.timestamp,
      screen: screenContext.screen,
      decisionType: `user_request:${intent}`,
      summary: response.coach_message,
      reason: response.safety_reason ?? response.trust_reason,
      data_sources: response.data_sources ?? [],
      impact: response.trust_state ? `Тон: ${response.trust_state}` : undefined,
      trustState: response.trust_state,
      uiMode: response.ui_mode,
    });

    this.registerUserRequest();
    return response;
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

    return {
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
    if (!this.explainabilityBreaker.canRequest()) {
      return {
        decisionId,
        memory_refs: [],
        trust_history: [],
        emotional_state: 'calm',
        safety_flags: ['explainability_unavailable'],
        pattern_matches: [],
        explainabilityRef: 'explainability_unavailable',
      };
    }
    const startedAt = performance.now();
    try {
      const trace = await this.facade.getExplainableReasoningTrace(decisionId);
      coachTelemetry.trackTiming('explainability_latency', performance.now() - startedAt, {
        decisionId,
      });
      this.explainabilityBreaker.recordSuccess();
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
      if (gatedTrace.memory_refs.length > 0) {
        coachTelemetry.increment('memory_hits', gatedTrace.memory_refs.length, { decisionId });
      }
      return gatedTrace;
    } catch (error) {
      this.explainabilityBreaker.recordFailure();
      const fallbackTrace: CoachExplainabilityBinding = {
        decisionId,
        memory_refs: [],
        trust_history: [],
        emotional_state: 'calm',
        safety_flags: [...(context.safetyFlags ?? []), 'explainability_unavailable'],
        pattern_matches: [],
        explainabilityRef: 'explainability_unavailable',
      };
      return fallbackTrace;
    }
  }

  private applySafetyGuards(
    response: CoachResponse,
    context: CoachScreenContext,
    event: CoachMemoryEvent
  ): CoachResponse {
    const payload = event.payload ?? {};
    const distressSignal =
      (payload as Record<string, unknown>).emotional_signal === 'distress' ||
      context.safetyFlags?.includes('distress');
    if (event.safetyClass === 'medical_risk' || distressSignal) {
      return {
        ...response,
        coach_message:
          'Сейчас важнее безопасность. Давай замедлимся и поддержим восстановление. Если тяжело — можно обратиться за поддержкой.',
        emotional_state: 'cautious',
        ui_mode: 'protect',
        ui_surface: 'banner',
        safety_reason: 'crisis_mode',
      };
    }

    const guardedCopy = response.coach_message
      .replace(/должен/gi, 'можно')
      .replace(/виноват/gi, 'тяжело')
      .replace(/стыд/gi, 'поддержку');

    return {
      ...response,
      coach_message: guardedCopy,
    };
  }
  private buildDedupeKey(event: CoachMemoryEvent, context: CoachScreenContext): string {
    const payload = event.payload ?? {};
    const source =
      typeof payload.source === 'string'
        ? payload.source
        : context.screen;
    const date =
      typeof payload.date === 'string'
        ? payload.date
        : typeof (payload as any).day === 'string'
          ? (payload as any).day
          : typeof (payload as any).period === 'string'
            ? (payload as any).period
            : event.timestamp.split('T')[0];
    return `${event.type}:${date}:${source}`;
  }

  async listExplainableDecisions(query: CoachDecisionHistoryQuery): Promise<CoachDecisionHistoryItem[]> {
    const history = this.readDecisionHistory();
    const fromMs = new Date(query.from).getTime();
    const toMs = new Date(query.to).getTime();
    const filtered = history.filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      if (Number.isNaN(ts)) return false;
      if (ts < fromMs || ts > toMs) return false;
      if (query.screen && item.screen !== query.screen) return false;
      return true;
    });
    const limited = filtered.slice(0, query.limit ?? 50);
    return limited.map((item) => ({
      ...item,
      dateLabel: new Date(item.timestamp).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'short',
      }),
    }));
  }

  async buildTrustNarrative(): Promise<string> {
    const history = this.readDecisionHistory();
    const latest = history[0];
    if (!latest) return 'Доверие выстраивается постепенно.';
    if (latest.trustState === 'trust_repair') {
      return 'Коуч стал осторожнее, чтобы вернуть доверие.';
    }
    if (latest.trustState === 'stable') {
      return 'Доверие растёт, и коуч поддерживает уверенный ритм.';
    }
    return 'Доверие стабильное. Коуч удерживает мягкий тон.';
  }

  async clearCoachHistory(): Promise<void> {
    localStorage.removeItem('coach_decision_history');
    if (this.facade.clearCoachHistory) {
      await this.facade.clearCoachHistory();
    }
  }

  async resetTrustStyle(): Promise<void> {
    localStorage.removeItem('coach_ignore_count');
    localStorage.removeItem('coach_silence_until');
    localStorage.removeItem('coach_last_nudge_at');
    if (this.facade.clearTrustModel) {
      await this.facade.clearTrustModel();
    }
  }

  private storeDecisionHistory(entry: Omit<CoachDecisionHistoryItem, 'dateLabel'>) {
    const history = this.readDecisionHistory();
    const updated = [entry, ...history].slice(0, 200);
    localStorage.setItem('coach_decision_history', JSON.stringify(updated));
  }

  private readDecisionHistory(): Omit<CoachDecisionHistoryItem, 'dateLabel'>[] {
    try {
      const raw = localStorage.getItem('coach_decision_history');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getInterventionPolicy(): CoachInterventionPolicy {
    const settings = this.readCoachSettings();
    return {
      mode: settings.coach_enabled ? settings.coach_mode : 'off',
      dailyNudgeLimit: 3,
      minIntervalMinutes: 180,
      cooldownAfterIgnoreHours: 6,
      silent: false,
      respectUserSilence: true,
    };
  }

  private allowsEvent(policy: CoachInterventionPolicy, event: CoachMemoryEvent): boolean {
    if (policy.mode === 'off') return false;
    if (policy.mode === 'on_request') {
      return (event.payload as Record<string, unknown>)?.source === 'user_request';
    }
    if (policy.mode === 'risk_only') {
      return event.safetyClass !== 'normal';
    }
    return true;
  }

  private allowsOverlay(policy: CoachInterventionPolicy, context: CoachScreenContext): boolean {
    if (policy.silent) return false;
    if (policy.mode === 'off' || policy.mode === 'on_request') return false;
    if (policy.mode === 'risk_only') {
      const hasRisk =
        (context.safetyFlags?.length ?? 0) > 0 ||
        (context.fatigueLevel ?? 0) > 0.6 ||
        (context.relapseRisk ?? 0) > 0.6;
      if (!hasRisk) return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const countKey = `coach_nudge_count_${today}`;
    const lastKey = 'coach_last_nudge_at';
    const count = Number(localStorage.getItem(countKey) ?? 0);
    if (count >= policy.dailyNudgeLimit) return false;

    const lastAtRaw = localStorage.getItem(lastKey);
    if (lastAtRaw) {
      const lastAt = new Date(lastAtRaw).getTime();
      const minutes = (Date.now() - lastAt) / 60000;
      if (minutes < policy.minIntervalMinutes) return false;
    }

    const silenceUntilRaw = localStorage.getItem('coach_silence_until');
    if (silenceUntilRaw && Date.now() < new Date(silenceUntilRaw).getTime()) {
      return false;
    }

    return true;
  }

  private registerNudge(policy: CoachInterventionPolicy) {
    const today = new Date().toISOString().split('T')[0];
    const countKey = `coach_nudge_count_${today}`;
    const count = Number(localStorage.getItem(countKey) ?? 0);
    localStorage.setItem(countKey, String(count + 1));
    localStorage.setItem('coach_last_nudge_at', new Date().toISOString());
    if (policy.respectUserSilence && policy.cooldownAfterIgnoreHours > 0) {
      const ignoreCount = Number(localStorage.getItem('coach_ignore_count') ?? 0);
      if (ignoreCount >= 3) {
        const until = new Date(Date.now() + policy.cooldownAfterIgnoreHours * 3600000).toISOString();
        localStorage.setItem('coach_silence_until', until);
      }
    }
  }

  private readCoachSettings(): { coach_enabled: boolean; coach_mode: CoachMode } {
    try {
      const raw = localStorage.getItem('potok_coach_settings');
      if (!raw) return { coach_enabled: true, coach_mode: 'support' };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as { coach_enabled: boolean; coach_mode: CoachMode })
        : { coach_enabled: true, coach_mode: 'support' };
    } catch {
      return { coach_enabled: true, coach_mode: 'support' };
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

    const isSafety = response.ui_mode === 'protect' || response.emotional_state === 'cautious';

    return {
      ...response,
      emotional_state: isSafety ? response.emotional_state : 'neutral',
      ui_mode: isSafety ? response.ui_mode : 'support',
      personalization_basis: undefined,
      memory_refs: undefined,
      data_sources: undefined,
      trust_reason: undefined,
    };
  }

  private buildRequestMessage(intent: CoachRequestIntent, context: CoachScreenContext): string {
    switch (intent) {
      case 'explain':
        return 'Я объясню, что происходит, опираясь на данные и твой контекст.';
      case 'support':
        return 'Я рядом. Давай сделаем один спокойный шаг прямо сейчас.';
      case 'motivate':
        return 'Сфокусируемся на следующем шаге и сохраним ритм.';
      case 'clarify':
        return context.screen === 'Program'
          ? 'Поясню, почему план изменился и как это поддерживает твою цель.'
          : 'Поясню изменения и логику, если они есть.';
      case 'reflect':
        return 'Давай посмотрим на происходящее мягко и без давления.';
      case 'reassure':
        return 'Если тревожно — это нормально. Мы можем замедлиться и сохранить безопасность.';
      default:
        return 'Я рядом и готов поддержать.';
    }
  }

  private isRequestRateLimited(): boolean {
    const today = new Date().toISOString().split('T')[0];
    const countKey = `coach_request_count_${today}`;
    const lastKey = 'coach_request_last_at';
    const count = Number(localStorage.getItem(countKey) ?? 0);
    if (count >= 6) return true;
    const lastAtRaw = localStorage.getItem(lastKey);
    if (lastAtRaw) {
      const minutes = (Date.now() - new Date(lastAtRaw).getTime()) / 60000;
      if (minutes < 2) return true;
    }
    return false;
  }

  private registerUserRequest() {
    const today = new Date().toISOString().split('T')[0];
    const countKey = `coach_request_count_${today}`;
    const count = Number(localStorage.getItem(countKey) ?? 0);
    localStorage.setItem(countKey, String(count + 1));
    localStorage.setItem('coach_request_last_at', new Date().toISOString());
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
