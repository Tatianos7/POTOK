export type ProgramTier = 'free' | 'pro' | 'coach' | 'vision_pro';

export interface ProgramDayCardDTO {
  date: string;
  targets?: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  } | null;
  sessionPlan?: {
    focus: string;
    intensity: string;
  } | null;
  status: 'planned' | 'completed' | 'skipped';
  explainabilitySummary?: {
    decisionRef: string;
    reasonCode?: string;
  } | null;
}

export interface ProgramMyPlanDTO {
  programId: string;
  programType: 'nutrition' | 'training';
  status: string;
  programVersion: number;
  startDate?: string;
  endDate?: string;
  dayCards: ProgramDayCardDTO[];
}

export interface ProgramTodayDTO {
  programId: string;
  date: string;
  day: ProgramDayCardDTO;
  explainability?: Record<string, unknown> | null;
}

export interface ProgramPhaseWeekDTO {
  phaseId: string;
  name?: string;
  phaseType?: string;
  phaseGoal?: string;
  startDate?: string;
  endDate?: string;
  blocks: Array<{
    blockId: string;
    blockType?: string;
    blockGoal?: string;
    durationDays: number;
  }>;
}

export interface ProgramWhyDTO {
  decisionRef: string;
  reasonCode?: string;
  diffSummary?: Record<string, unknown>;
  safetyNotes?: Record<string, unknown>;
  knowledgeRefs?: Record<string, unknown>;
  confidence?: number | null;
}
