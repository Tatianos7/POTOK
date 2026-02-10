import type { CoachLongTermContext, CoachMemoryEvent, RelationshipProfile } from '../types/coachMemory';

export interface CoachMemoryPersistenceService {
  persistEventMemory: (event: CoachMemoryEvent) => Promise<void>;
  loadLongTermProfile: () => Promise<RelationshipProfile>;
  updateTrustCurve: (delta: number, reason?: string) => Promise<void>;
  updateEmotionalBaseline: (state: RelationshipProfile['emotionalState']) => Promise<void>;
  summarizeUserJourney: () => Promise<string>;
  getCoachContextForResponse: () => Promise<CoachLongTermContext>;
  getMemoryRetentionPolicy: () => Promise<{ shortTermDays: number; midTermDays: number; longTermDays: number }>;
  clearCoachMemory: () => Promise<void>;
  forgetMemoryPeriod: (fromISO: string, toISO: string) => Promise<void>;
  getMemorySummary: () => Promise<string>;
  isAvailable?: () => boolean;
}

export const createCoachMemoryPersistenceService = (): CoachMemoryPersistenceService => {
  const now = () => new Date().toISOString();
  const noop = async () => undefined;
  const defaultProfile: RelationshipProfile = {
    stage: 'onboarding',
    trustLevel: 50,
    emotionalState: 'calm',
    resilience: 0.5,
    autonomy: 0.5,
    safetyMode: false,
    confidenceGrowth: 0.2,
    confidenceDecay: 0.1,
    lastUpdated: now(),
  };
  const defaultContext: CoachLongTermContext = {
    goals: [],
    values: [],
    patterns: [],
    recoveryHistory: [],
    trustMilestones: [],
  };

  return {
    persistEventMemory: noop,
    loadLongTermProfile: async () => defaultProfile,
    updateTrustCurve: noop,
    updateEmotionalBaseline: noop,
    summarizeUserJourney: async () => 'Память коуча временно отключена. Я опираюсь на текущие данные.',
    getCoachContextForResponse: async () => defaultContext,
    getMemoryRetentionPolicy: async () => ({ shortTermDays: 14, midTermDays: 60, longTermDays: 365 }),
    clearCoachMemory: noop,
    forgetMemoryPeriod: noop,
    getMemorySummary: async () => 'Память коуча содержит краткую историю и устойчивые паттерны.',
    isAvailable: () => false,
  };
};
