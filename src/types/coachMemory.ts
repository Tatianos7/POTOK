export type CoachMemoryLayer = 'short' | 'mid' | 'long' | 'safety' | 'trust';

export type CoachMemoryType = 'event' | 'emotional' | 'trust' | 'relationship';

export type RelationshipStage =
  | 'onboarding'
  | 'trust_building'
  | 'stable_partnership'
  | 'relapse_recovery'
  | 'long_term_companion';

export type EmotionalState =
  | 'calm'
  | 'support'
  | 'motivate'
  | 'stabilize'
  | 'protect'
  | 'celebrate'
  | 'guide'
  | 'reframe';

export interface CoachMemoryEvent {
  id?: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
  confidence: number;
  safetyClass: 'normal' | 'caution' | 'medical_risk';
  trustImpact: -2 | -1 | 0 | 1 | 2;
}

export interface RelationshipProfile {
  stage: RelationshipStage;
  trustLevel: number;
  emotionalState: EmotionalState;
  resilience: number;
  autonomy: number;
  safetyMode: boolean;
  confidenceGrowth: number;
  confidenceDecay: number;
  lastUpdated: string;
}

export interface CoachMemorySnapshot {
  layer: CoachMemoryLayer;
  memoryType: CoachMemoryType;
  events: CoachMemoryEvent[];
  summary?: string;
  lastUpdated: string;
}

export interface CoachLongTermContext {
  goals: string[];
  values: string[];
  patterns: string[];
  recoveryHistory: string[];
  trustMilestones: string[];
}

export interface CoachMemoryTrace {
  ref: string;
  summary: string;
  occurredAt?: string;
  layer?: CoachMemoryLayer;
  tags?: string[];
}

export interface TrustDelta {
  timestamp: string;
  delta: number;
  trustLevel?: number;
  reason?: string;
}

export interface CoachExplainabilityBinding {
  decisionId: string;
  memory_refs: CoachMemoryTrace[];
  trust_history: TrustDelta[];
  emotional_state: EmotionalState;
  safety_flags: string[];
  pattern_matches: string[];
  explainabilityRef?: string;
}
