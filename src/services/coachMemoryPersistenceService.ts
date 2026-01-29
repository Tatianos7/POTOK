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
}

export const createCoachMemoryPersistenceService = (): CoachMemoryPersistenceService => {
  const notImplemented = async () => {
    throw new Error('CoachMemoryPersistenceService is not implemented yet.');
  };

  return {
    persistEventMemory: notImplemented,
    loadLongTermProfile: notImplemented,
    updateTrustCurve: notImplemented,
    updateEmotionalBaseline: notImplemented,
    summarizeUserJourney: notImplemented,
    getCoachContextForResponse: notImplemented,
    getMemoryRetentionPolicy: async () => ({ shortTermDays: 14, midTermDays: 60, longTermDays: 365 }),
    clearCoachMemory: notImplemented,
    forgetMemoryPeriod: notImplemented,
    getMemorySummary: async () => 'Память коуча содержит краткую историю и устойчивые паттерны.',
  };
};
