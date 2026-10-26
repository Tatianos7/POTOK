export type ProgramType = 'nutrition' | 'training';
export type AdaptationStrategy = 'micro' | 'meso' | 'macro' | 'pause';
export type AdaptationTrigger =
  | 'plateau'
  | 'fatigue_spike'
  | 'overload'
  | 'adherence_drop'
  | 'risk_flag'
  | 'trust_drop'
  | 'knowledge_version_bump'
  | 'confidence_drop';

export interface ProgramInput {
  userId: string;
  programType: ProgramType;
  startDate?: string;
  durationDays?: number;
  constraints?: Record<string, unknown>;
}

export interface ProgramGenerationResult {
  programId: string;
  programType: ProgramType;
  programVersion: number;
}

export interface ProgramAdaptationInput {
  programId: string;
  programType: ProgramType;
  constraints?: Record<string, unknown>;
  knowledgeVersionRef?: Record<string, unknown>;
}

export interface ProgramAdaptationResult {
  programId: string;
  programType: ProgramType;
  fromVersion: number;
  toVersion: number;
  strategy: AdaptationStrategy;
  triggers: AdaptationTrigger[];
}

/** Legacy table-by-table generation is retired until a reviewed protected transport exists. */
export const LEGACY_PROGRAM_MUTATIONS_AVAILABLE = false;

export class ProgramMutationUnavailableError extends Error {
  readonly code = 'PROGRAM_MUTATION_CHANNEL_NOT_BOUND';
  constructor() {
    super('Автоматическая корректировка и создание программ пока недоступны.');
    this.name = 'ProgramMutationUnavailableError';
  }
}

class ProgramGenerationService {
  async generateProgram(_input: ProgramInput): Promise<ProgramGenerationResult> {
    throw new ProgramMutationUnavailableError();
  }

  async replanProgram(_programId: string, _programType: ProgramType, _constraints: Record<string, unknown>): Promise<void> {
    throw new ProgramMutationUnavailableError();
  }

  async adaptProgram(_input: ProgramAdaptationInput): Promise<ProgramAdaptationResult> {
    throw new ProgramMutationUnavailableError();
  }
}

export const programGenerationService = new ProgramGenerationService();
