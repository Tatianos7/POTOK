import type { CoachLongTermContext, CoachMemoryEvent, RelationshipProfile } from '../types/coachMemory';

export interface CoachMemoryService {
  recordEvent: (event: CoachMemoryEvent) => Promise<void>;
  updateEmotionalState: (state: RelationshipProfile['emotionalState']) => Promise<void>;
  updateTrust: (delta: number, reason?: string) => Promise<void>;
  getRelationshipProfile: () => Promise<RelationshipProfile>;
  getLongTermContext: () => Promise<CoachLongTermContext>;
}

export const createCoachMemoryService = (): CoachMemoryService => {
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
    recordEvent: noop,
    updateEmotionalState: noop,
    updateTrust: noop,
    getRelationshipProfile: async () => defaultProfile,
    getLongTermContext: async () => defaultContext,
  };
};
