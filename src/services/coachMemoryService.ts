import type { CoachLongTermContext, CoachMemoryEvent, RelationshipProfile } from '../types/coachMemory';

export interface CoachMemoryService {
  recordEvent: (event: CoachMemoryEvent) => Promise<void>;
  updateEmotionalState: (state: RelationshipProfile['emotionalState']) => Promise<void>;
  updateTrust: (delta: number, reason?: string) => Promise<void>;
  getRelationshipProfile: () => Promise<RelationshipProfile>;
  getLongTermContext: () => Promise<CoachLongTermContext>;
}

export const createCoachMemoryService = (): CoachMemoryService => {
  const notImplemented = async () => {
    throw new Error('CoachMemoryService is not implemented yet.');
  };

  return {
    recordEvent: notImplemented,
    updateEmotionalState: notImplemented,
    updateTrust: notImplemented,
    getRelationshipProfile: notImplemented,
    getLongTermContext: notImplemented,
  };
};
