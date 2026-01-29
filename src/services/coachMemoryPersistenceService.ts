import type { CoachLongTermContext, CoachMemoryEvent, RelationshipProfile } from '../types/coachMemory';

export interface CoachMemoryPersistenceService {
  persistEventMemory: (event: CoachMemoryEvent) => Promise<void>;
  loadLongTermProfile: () => Promise<RelationshipProfile>;
  updateTrustCurve: (delta: number, reason?: string) => Promise<void>;
  updateEmotionalBaseline: (state: RelationshipProfile['emotionalState']) => Promise<void>;
  summarizeUserJourney: () => Promise<string>;
  getCoachContextForResponse: () => Promise<CoachLongTermContext>;
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
  };
};
