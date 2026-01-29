import type {
  CoachExplainabilityBinding,
  CoachLongTermContext,
  CoachMemoryEvent,
  RelationshipProfile,
  TrustDelta,
} from '../types/coachMemory';
import { createCoachMemoryService, type CoachMemoryService } from './coachMemoryService';
import {
  createCoachMemoryPersistenceService,
  type CoachMemoryPersistenceService,
} from './coachMemoryPersistenceService';
import { CircuitBreaker } from './coachCircuitBreaker';
import { coachTelemetry } from './coachTelemetry';

export interface CoachRelationshipRuntime {
  getProfile: () => Promise<RelationshipProfile>;
  updateFromEvent?: (event: CoachMemoryEvent) => Promise<void>;
}

export interface CoachExperienceContext {
  sourceScreen: string;
  explainabilityRef?: string;
}

export interface CoachMemoryFacade {
  recordExperience: (event: CoachMemoryEvent, context: CoachExperienceContext) => Promise<void>;
  loadCoachContext: (userId: string) => Promise<RelationshipProfile>;
  updateTrustModel: (signal: { delta: number; reason?: string }) => Promise<void>;
  getLongTermNarrative: (userId: string) => Promise<string>;
  getExplainableReasoningTrace: (decisionId: string) => Promise<CoachExplainabilityBinding>;
  getCoachContextForResponse: () => Promise<CoachLongTermContext>;
  clearCoachHistory?: () => Promise<void>;
  clearTrustModel?: () => Promise<void>;
}

interface CoachMemoryFacadeDeps {
  memoryService?: CoachMemoryService;
  persistenceService?: CoachMemoryPersistenceService;
  relationshipRuntime?: CoachRelationshipRuntime;
}

export const createCoachMemoryFacade = ({
  memoryService = createCoachMemoryService(),
  persistenceService = createCoachMemoryPersistenceService(),
  relationshipRuntime,
}: CoachMemoryFacadeDeps = {}): CoachMemoryFacade => {
  const memoryBreaker = new CircuitBreaker({ name: 'coachMemoryFacade', failureThreshold: 2 });

  const minimizePayload = (payload: Record<string, unknown>) => {
    const minimized: Record<string, unknown> = {};
    Object.entries(payload ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        minimized[key] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
        return;
      }
      minimized[key] = value;
    });
    return minimized;
  };

  return {
    recordExperience: async (event, context) => {
      if (!memoryBreaker.canRequest()) {
        throw new Error('memory_circuit_open');
      }
      const minimizedPayload = minimizePayload(event.payload ?? {});
      try {
        await persistenceService.persistEventMemory({
          ...event,
          payload: {
            ...minimizedPayload,
            source_screen: context.sourceScreen,
            explainability_ref: context.explainabilityRef ?? null,
          },
        });
        memoryBreaker.recordSuccess();
      } catch (error) {
        memoryBreaker.recordFailure();
        throw error;
      }
      await memoryService.recordEvent(event);
      if (relationshipRuntime?.updateFromEvent) {
        await relationshipRuntime.updateFromEvent(event);
      }
    },
    loadCoachContext: async () => {
      if (!memoryBreaker.canRequest()) {
        throw new Error('memory_circuit_open');
      }
      const startedAt = performance.now();
      const profile = await persistenceService.loadLongTermProfile();
      coachTelemetry.trackTiming('memory_fetch_time', performance.now() - startedAt, {
        source: 'loadCoachContext',
      });
      return profile;
    },
    updateTrustModel: async (signal) => {
      const startedAt = performance.now();
      await persistenceService.updateTrustCurve(signal.delta, signal.reason);
      await memoryService.updateTrust(signal.delta, signal.reason);
      coachTelemetry.trackTiming('trust_update_time', performance.now() - startedAt, {
        reason: signal.reason ?? 'unknown',
      });
    },
    getLongTermNarrative: async () => {
      try {
        return await persistenceService.summarizeUserJourney();
      } catch (error) {
        console.warn('[coachMemoryFacade] summarizeUserJourney failed', error);
        return 'Ты прошел путь с разными фазами. Я учитываю устойчивость и восстановление.';
      }
    },
    getExplainableReasoningTrace: async (decisionId) => {
      let profile: RelationshipProfile | null = null;
      try {
        if (!memoryBreaker.canRequest()) {
          throw new Error('memory_circuit_open');
        }
        const startedAt = performance.now();
        profile = await persistenceService.loadLongTermProfile();
        coachTelemetry.trackTiming('memory_fetch_time', performance.now() - startedAt, {
          source: 'getExplainableReasoningTrace',
        });
      } catch (error) {
        console.warn('[coachMemoryFacade] loadLongTermProfile failed', error);
      }

      const now = Date.now();
      const daysAgo = (days: number) => new Date(now - days * 86400000).toISOString();
      const trustLevel = profile?.trustLevel ?? 50;
      const emotionalState = profile?.emotionalState ?? 'calm';

      const buildMemoryRefs = (): CoachExplainabilityBinding['memory_refs'] => {
        if (decisionId.includes('PlateauDetected')) {
          return [
            {
              ref: 'memory:plateau_cycle',
              summary: 'Ты уже проходил похожий спад 2 недели назад.',
              occurredAt: daysAgo(14),
              layer: 'mid',
              tags: ['plateau', 'recovery'],
            },
            {
              ref: 'memory:plateau_response',
              summary: 'Тогда помогло снизить нагрузку и вернуть ритм.',
              occurredAt: daysAgo(12),
              layer: 'mid',
              tags: ['adjustment', 'consistency'],
            },
          ];
        }
        if (decisionId.includes('HabitBroken')) {
          return [
            {
              ref: 'memory:habit_slip',
              summary: 'Похожий сбой уже был, и возвращение заняло всего пару дней.',
              occurredAt: daysAgo(10),
              layer: 'short',
              tags: ['habit', 'recovery'],
            },
          ];
        }
        if (decisionId.includes('ReturnAfterPause')) {
          return [
            {
              ref: 'memory:return_cycle',
              summary: 'После паузы тебе помогал мягкий старт и короткие цели.',
              occurredAt: daysAgo(30),
              layer: 'long',
              tags: ['restart', 'motivation'],
            },
          ];
        }
        if (decisionId.includes('CalorieOverTarget')) {
          return [
            {
              ref: 'memory:nutrition_balance',
              summary: 'Ранее лёгкая корректировка калорий помогала вернуть баланс.',
              occurredAt: daysAgo(7),
              layer: 'short',
              tags: ['nutrition', 'balance'],
            },
          ];
        }
        if (decisionId.includes('WorkoutCompleted') || decisionId.includes('StrengthPR')) {
          return [
            {
              ref: 'memory:training_streak',
              summary: 'Регулярные тренировки поддерживают твой прогресс и уверенность.',
              occurredAt: daysAgo(5),
              layer: 'short',
              tags: ['training', 'consistency'],
            },
          ];
        }
        return [
          {
            ref: 'memory:recent_cycle',
            summary: 'Похожая фаза уже была ранее, и мягкое снижение нагрузки помогло.',
            occurredAt: daysAgo(14),
            layer: 'mid',
            tags: ['recovery', 'consistency'],
          },
        ];
      };

      const memoryRefs = buildMemoryRefs();
      const trustHistory: TrustDelta[] = [
        {
          timestamp: daysAgo(14),
          delta: trustLevel < 40 ? -1 : 1,
          trustLevel: Math.max(10, trustLevel - 5),
          reason: trustLevel < 40 ? 'low_consistency' : 'steady_rhythm',
        },
        {
          timestamp: daysAgo(3),
          delta: trustLevel < 40 ? 1 : 0,
          trustLevel,
          reason: trustLevel < 40 ? 'recovery_signal' : 'stable_support',
        },
      ];

      const safetyFlags = decisionId.includes('PainReported')
        ? ['pain']
        : decisionId.includes('FatigueReported')
          ? ['fatigue']
          : [];

      return {
        decisionId,
        memory_refs: memoryRefs,
        trust_history: trustHistory,
        emotional_state: emotionalState,
        safety_flags: safetyFlags,
        pattern_matches: trustLevel < 40 ? ['trust_repair'] : ['stable_rhythm'],
      };
    },
    getCoachContextForResponse: async () => {
      return persistenceService.getCoachContextForResponse();
    },
    clearCoachHistory: async () => {
      if (persistenceService.clearCoachMemory) {
        await persistenceService.clearCoachMemory();
      }
    },
    clearTrustModel: async () => {
      await persistenceService.updateTrustCurve(0, 'trust_reset');
      await memoryService.updateTrust(0, 'trust_reset');
    },
  };
};
