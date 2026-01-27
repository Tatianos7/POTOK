import { supabase } from '../lib/supabaseClient';
import { aiTrustService } from './aiTrustService';
import { entitlementService } from './entitlementService';

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

const DEFAULT_DURATION_DAYS = 28;
const TRUST_THRESHOLD = 50;
const TRUST_LOW_THRESHOLD = 40;
const CONFIDENCE_BLOCK_THRESHOLD = 0.6;
const FATIGUE_THRESHOLD = 70;
const OVERLOAD_THRESHOLD = 80;
const ADHERENCE_THRESHOLD = 0.5;
const PLATEAU_WEIGHT_DELTA = 0.2;
const DELOAD_FACTOR = 0.8;
const MICRO_ADJUST_FACTOR = 0.95;

const toISODate = (value: Date): string => value.toISOString().split('T')[0];

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

class ProgramGenerationService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[programGenerationService] Передан userId не совпадает с сессией');
    }
    return data.user.id;
  }

  private async getGoalContext(userId: string) {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase
      .from('user_goals')
      .select('calories,protein,fat,carbs')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error('Нет целей питания для генерации программы');
    }
    return data;
  }

  private async getUserState(userId: string) {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  private async resolveConfidence(programType: ProgramType): Promise<number> {
    if (!supabase) return 1;
    if (programType === 'training') {
      return 1;
    }
    const { data, error } = await supabase
      .from('foods')
      .select('confidence_score')
      .eq('source', 'core')
      .limit(50);
    if (error) throw error;
    const values = (data || [])
      .map((row: any) => Number(row.confidence_score ?? 1))
      .filter((val: number) => Number.isFinite(val));
    if (values.length === 0) return 1;
    return Math.min(...values);
  }

  private buildSkeleton(startDate: Date, durationDays: number, trustScore: number) {
    const phasesCount = trustScore < TRUST_THRESHOLD ? 1 : 2;
    const phaseDuration = Math.ceil(durationDays / phasesCount);
    const phases = Array.from({ length: phasesCount }).map((_, index) => {
      const phaseStart = addDays(startDate, index * phaseDuration);
      const phaseEnd = addDays(phaseStart, phaseDuration - 1);
      return {
        name: `phase_${index + 1}`,
        phase_type: index === phasesCount - 1 ? 'deload' : 'build',
        phase_goal: index === phasesCount - 1 ? 'recovery' : 'progress',
        start_date: toISODate(phaseStart),
        end_date: toISODate(phaseEnd),
        blocks: [
          {
            block_type: index === phasesCount - 1 ? 'deload' : 'build',
            block_goal: index === phasesCount - 1 ? 'recovery' : 'progress',
            duration_days: phaseDuration,
          },
        ],
      };
    });
    return phases;
  }

  private buildDays(
    startDate: Date,
    durationDays: number,
    programType: ProgramType,
    goals: { calories: number; protein: number; fat: number; carbs: number },
    confidence: number,
    options?: {
      adjustmentFactor?: number;
      planDepth?: 'basic' | 'full';
      refeed?: boolean;
    }
  ) {
    const conservativeFactor = confidence < 0.75 ? 0.9 : 1;
    const adjustmentFactor = options?.adjustmentFactor ?? 1;
    const planDepth = options?.planDepth ?? 'full';
    const refeed = options?.refeed ?? false;
    return Array.from({ length: durationDays }).map((_, index) => {
      const dayDate = addDays(startDate, index);
      if (programType === 'nutrition') {
        const baseCalories = goals.calories * conservativeFactor * adjustmentFactor;
        const baseProtein = goals.protein * conservativeFactor * adjustmentFactor;
        const baseFat = goals.fat * conservativeFactor * adjustmentFactor;
        const baseCarbs = goals.carbs * conservativeFactor * adjustmentFactor;
        const carbsFactor = refeed ? 1.1 : 1;
        return {
          date: toISODate(dayDate),
          targets: {
            calories: Math.round(baseCalories),
            protein: Math.round(baseProtein),
            fat: Math.round(baseFat),
            carbs: Math.round(baseCarbs * carbsFactor),
          },
        };
      }
      const intensity =
        planDepth === 'basic'
          ? 'low'
          : confidence < 0.75
            ? 'low'
            : index % 2 === 0
              ? 'moderate'
              : 'low';
      return {
        date: toISODate(dayDate),
        session_plan: {
          focus: planDepth === 'basic' ? 'recovery' : index % 2 === 0 ? 'strength' : 'recovery',
          intensity,
        },
      };
    });
  }

  private async persistProgramStructure(params: {
    programId: string;
    programType: ProgramType;
    phases: Array<{
      name: string;
      phase_type: string;
      phase_goal: string;
      start_date: string;
      end_date: string;
      blocks: Array<{ block_type: string; block_goal: string; duration_days: number }>;
    }>;
    days: Array<{ date: string; targets?: any; session_plan?: any }>;
    constraints: Record<string, unknown>;
  }) {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { programId, programType, phases, days, constraints } = params;
    let dayIndex = 0;

    for (const phase of phases) {
      const { data: phaseRow, error: phaseError } = await supabase
        .from('program_phases')
        .insert({
          program_id: programId,
          program_type: programType,
          name: phase.name,
          phase_type: phase.phase_type,
          phase_goal: phase.phase_goal,
          start_date: phase.start_date,
          end_date: phase.end_date,
        })
        .select('id')
        .single();
      if (phaseError || !phaseRow) throw phaseError || new Error('Phase not created');

      for (const block of phase.blocks) {
        const { data: blockRow, error: blockError } = await supabase
          .from('program_blocks')
          .insert({
            phase_id: phaseRow.id,
            block_type: block.block_type,
            block_goal: block.block_goal,
            duration_days: block.duration_days,
          })
          .select('id')
          .single();
        if (blockError || !blockRow) throw blockError || new Error('Block not created');

        const blockDays = days.slice(dayIndex, dayIndex + block.duration_days);
        dayIndex += block.duration_days;
        for (const day of blockDays) {
          const payload =
            programType === 'nutrition'
              ? { targets: day.targets, session_plan: null }
              : { targets: null, session_plan: day.session_plan };
          const { error: dayError } = await supabase.from('program_days').insert({
            block_id: blockRow.id,
            date: day.date,
            constraints_applied: constraints,
            ...payload,
          });
          if (dayError) throw dayError;

        const sessionType = programType === 'nutrition' ? 'meal_plan' : 'workout_plan';
        const planPayload = programType === 'nutrition' ? day.targets : day.session_plan;
        const { data: existingSession, error: existingSessionError } = await supabase
          .from('program_sessions')
          .select('id,status')
          .eq('program_id', programId)
          .eq('date', day.date)
          .maybeSingle();
        if (existingSessionError) throw existingSessionError;

        if (!existingSession?.id) {
          const { error: sessionError } = await supabase.from('program_sessions').insert({
            program_id: programId,
            date: day.date,
            session_type: sessionType,
            plan_payload: planPayload,
            status: 'planned',
          });
          if (sessionError) throw sessionError;
        } else if (existingSession.status === 'planned') {
          const { error: sessionUpdateError } = await supabase
            .from('program_sessions')
            .update({ session_type: sessionType, plan_payload: planPayload })
            .eq('id', existingSession.id);
          if (sessionUpdateError) throw sessionUpdateError;
        }
        }
      }
    }
  }

  private buildDeloadSkeleton(startDate: Date, durationDays: number) {
    const deloadDays = Math.max(2, Math.min(5, Math.floor(durationDays * 0.2)));
    const remainingDays = Math.max(1, durationDays - deloadDays);
    return [
      {
        name: 'phase_1',
        phase_type: 'build',
        phase_goal: 'progress',
        start_date: toISODate(startDate),
        end_date: toISODate(addDays(startDate, durationDays - 1)),
        blocks: [
          {
            block_type: 'deload',
            block_goal: 'recovery',
            duration_days: deloadDays,
          },
          {
            block_type: 'build',
            block_goal: 'progress',
            duration_days: remainingDays,
          },
        ],
      },
    ];
  }

  async generateProgram(input: ProgramInput): Promise<ProgramGenerationResult> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(input.userId);
    const canGenerate = await entitlementService.canGenerateProgram(sessionUserId);
    if (!canGenerate) {
      throw new Error('Entitlement блокирует генерацию программы');
    }
    const programType = input.programType;
    const durationDays = clamp(input.durationDays ?? DEFAULT_DURATION_DAYS, 7, 56);
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const endDate = addDays(startDate, durationDays - 1);

    const [trustScore, goals, userState, confidence] = await Promise.all([
      aiTrustService.getTrustScore(sessionUserId),
      this.getGoalContext(sessionUserId),
      this.getUserState(sessionUserId),
      this.resolveConfidence(programType),
    ]);

    const constraints = input.constraints ?? {};
    const medicalBlocked = Boolean((constraints as any).medical_blocked);

    const { data: job, error: jobError } = await supabase
      .from('program_generation_jobs')
      .insert({
        user_id: sessionUserId,
        program_type: programType,
        status: 'running',
        input_context: {
          user_state: userState,
          goals,
          constraints,
          trust_score: trustScore,
          effective_confidence: confidence,
        },
      })
      .select('id')
      .single();
    if (jobError) throw jobError;

    const knowledgeVersionRef = {
      program_type: programType,
      effective_confidence: confidence,
      source: programType === 'nutrition' ? 'foods' : 'exercises',
      version: 'v1',
    };

    if (medicalBlocked || confidence < CONFIDENCE_BLOCK_THRESHOLD) {
      const programTable = programType === 'nutrition' ? 'nutrition_programs' : 'training_programs';
      const { data: program, error: programError } = await supabase
        .from(programTable)
        .insert({
          user_id: sessionUserId,
          status: 'paused',
          program_version: 1,
          knowledge_version_ref: knowledgeVersionRef,
          start_date: toISODate(startDate),
          end_date: toISODate(endDate),
        })
        .select('id')
        .single();
      if (programError || !program) throw programError || new Error('Program not created');

      const { error: guardError } = await supabase.from('program_guard_events').insert({
        program_id: program.id,
        program_type: programType,
        risk_level: 'danger',
        flags: [
          medicalBlocked ? 'medical_block' : null,
          confidence < CONFIDENCE_BLOCK_THRESHOLD ? 'low_confidence' : null,
        ].filter(Boolean),
        blocked_actions: ['program_generation'],
      });
      if (guardError) throw guardError;

      await supabase
        .from('program_generation_jobs')
        .update({ status: 'failed', output_program_id: program.id })
        .eq('id', job.id);

      throw new Error('Program generation blocked by guard');
    }

    const phases = this.buildSkeleton(startDate, durationDays, trustScore);
    const days = this.buildDays(startDate, durationDays, programType, goals, confidence);

    const programPayload = {
      user_id: sessionUserId,
      status: 'active',
      program_version: 1,
      knowledge_version_ref: knowledgeVersionRef,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
    };

    const programTable = programType === 'nutrition' ? 'nutrition_programs' : 'training_programs';
    const { data: program, error: programError } = await supabase
      .from(programTable)
      .insert(programPayload)
      .select('id,program_version')
      .single();
    if (programError || !program) throw programError || new Error('Program not created');

    await this.persistProgramStructure({
      programId: program.id,
      programType,
      phases,
      days,
      constraints,
    });

    const snapshot = {
      phases,
      trust_score: trustScore,
      effective_confidence: confidence,
      plan_depth: trustScore < TRUST_THRESHOLD ? 'basic' : 'full',
      constraints,
    };

    const { error: versionError } = await supabase.from('program_versions').insert({
      program_id: program.id,
      program_type: programType,
      version: program.program_version,
      snapshot,
      reason: 'initial_generation',
    });
    if (versionError) throw versionError;

    const { error: explainabilityError } = await supabase.from('program_explainability').insert({
      program_id: program.id,
      program_type: programType,
      version: program.program_version,
      decision_ref: 'program_generation',
      knowledge_refs: knowledgeVersionRef,
      confidence,
      guard_notes: {
        trust_score: trustScore,
        constraints_applied: Object.keys(constraints ?? {}).length > 0,
      },
    });
    if (explainabilityError) throw explainabilityError;

    const { error: jobUpdateError } = await supabase
      .from('program_generation_jobs')
      .update({ status: 'completed', output_program_id: program.id })
      .eq('id', job.id);
    if (jobUpdateError) throw jobUpdateError;

    return {
      programId: program.id,
      programType,
      programVersion: program.program_version,
    };
  }

  async replanProgram(
    programId: string,
    programType: ProgramType,
    constraints: Record<string, unknown>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const programTable = programType === 'nutrition' ? 'nutrition_programs' : 'training_programs';
    const { data: program, error: programError } = await supabase
      .from(programTable)
      .select('id,user_id,program_version,start_date,end_date')
      .eq('id', programId)
      .single();
    if (programError || !program) throw programError || new Error('Program not found');

    const startDate = program.start_date ? new Date(program.start_date) : new Date();
    const endDate = program.end_date ? new Date(program.end_date) : addDays(startDate, DEFAULT_DURATION_DAYS - 1);
    const durationDays = Math.max(7, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

    const [trustScore, goals, confidence] = await Promise.all([
      aiTrustService.getTrustScore(program.user_id),
      this.getGoalContext(program.user_id),
      this.resolveConfidence(programType),
    ]);

    const phases = this.buildSkeleton(startDate, durationDays, trustScore);
    const days = this.buildDays(startDate, durationDays, programType, goals, confidence);

    await this.persistProgramStructure({
      programId: program.id,
      programType,
      phases,
      days,
      constraints,
    });

    const nextVersion = Number(program.program_version ?? 1) + 1;
    const snapshot = {
      phases,
      trust_score: trustScore,
      effective_confidence: confidence,
      plan_depth: trustScore < TRUST_THRESHOLD ? 'basic' : 'full',
      constraints,
    };

    const { error: versionError } = await supabase.from('program_versions').insert({
      program_id: program.id,
      program_type: programType,
      version: nextVersion,
      snapshot,
      reason: 'constraint_replan',
    });
    if (versionError) throw versionError;

    const { error: programUpdateError } = await supabase
      .from(programTable)
      .update({ program_version: nextVersion })
      .eq('id', program.id);
    if (programUpdateError) throw programUpdateError;
  }

  async adaptProgram(input: ProgramAdaptationInput): Promise<ProgramAdaptationResult> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId();
    const canAdapt = await entitlementService.canAdaptProgram(sessionUserId);
    if (!canAdapt) {
      throw new Error('Entitlement блокирует адаптацию программы');
    }
    const programTable = input.programType === 'nutrition' ? 'nutrition_programs' : 'training_programs';
    const { data: program, error: programError } = await supabase
      .from(programTable)
      .select('id,user_id,program_version,start_date,end_date,knowledge_version_ref,status')
      .eq('id', input.programId)
      .single();
    if (programError || !program) throw programError || new Error('Program not found');

    const [trustScore, goals, userState, confidence] = await Promise.all([
      aiTrustService.getTrustScore(program.user_id),
      this.getGoalContext(program.user_id),
      this.getUserState(program.user_id),
      this.resolveConfidence(input.programType),
    ]);

    const constraints = input.constraints ?? {};
    const skippedDates = Array.isArray((constraints as any).skipped_dates)
      ? ((constraints as any).skipped_dates as string[])
      : [];
    const feedback = (constraints as any).feedback as
      | { energy?: number; hunger?: number; difficulty?: number; pain?: number; motivation?: number }
      | undefined;
    const medicalBlocked =
      Boolean((constraints as any).medical_blocked) || Number(feedback?.pain ?? 0) >= 4;
    const overload = Number(userState?.training_load_index ?? 0) >= OVERLOAD_THRESHOLD;
    const fatigueSpike =
      Number(userState?.fatigue_index ?? 0) >= FATIGUE_THRESHOLD ||
      Number(feedback?.difficulty ?? 0) >= 4 ||
      Number(feedback?.energy ?? 5) <= 2;
    const adherenceDrop = Number(userState?.adherence_score ?? 1) < ADHERENCE_THRESHOLD;
    const trustDrop = trustScore < TRUST_LOW_THRESHOLD;
    const plateau =
      userState?.trend_weight_7d != null &&
      userState?.trend_weight_30d != null &&
      Math.abs(Number(userState.trend_weight_7d) - Number(userState.trend_weight_30d)) <=
        PLATEAU_WEIGHT_DELTA;
    const knowledgeVersionRef =
      input.knowledgeVersionRef ??
      program.knowledge_version_ref ?? {
        program_type: input.programType,
        effective_confidence: confidence,
        source: input.programType === 'nutrition' ? 'foods' : 'exercises',
        version: 'v1',
      };
    const versionBump =
      Boolean((program.knowledge_version_ref as any)?.version) &&
      (program.knowledge_version_ref as any)?.version !== (knowledgeVersionRef as any)?.version;

    let poseRiskFlagId: string | null = null;
    if (input.programType === 'training') {
      const { data: poseSession } = await supabase
        .from('pose_sessions')
        .select('id')
        .eq('user_id', program.user_id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (poseSession?.id) {
        const { data: poseFlag } = await supabase
          .from('pose_guard_flags')
          .select('id,severity')
          .eq('pose_session_id', poseSession.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (poseFlag?.severity === 'danger') {
          poseRiskFlagId = poseFlag.id;
        }
      }
    }

    const triggers: AdaptationTrigger[] = [];
    if (plateau) triggers.push('plateau');
    if (fatigueSpike) triggers.push('fatigue_spike');
    if (overload) triggers.push('overload');
    if (adherenceDrop) triggers.push('adherence_drop');
    if (skippedDates.length > 0) triggers.push('adherence_drop');
    if (trustDrop) triggers.push('trust_drop');
    if (versionBump) triggers.push('knowledge_version_bump');
    if (confidence < CONFIDENCE_BLOCK_THRESHOLD) triggers.push('confidence_drop');
    if (medicalBlocked) triggers.push('risk_flag');
    if (poseRiskFlagId) triggers.push('risk_flag');

    if (skippedDates.length > 0) {
      const { error: skipError } = await supabase
        .from('program_sessions')
        .update({ status: 'skipped' })
        .eq('program_id', program.id)
        .in('date', skippedDates);
      if (skipError) throw skipError;
    }

    const startDate = program.start_date ? new Date(program.start_date) : new Date();
    const endDate = program.end_date ? new Date(program.end_date) : addDays(startDate, DEFAULT_DURATION_DAYS - 1);
    const durationDays = Math.max(7, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

    if (poseRiskFlagId) {
      const today = toISODate(new Date());
      const { data: sessionRow } = await supabase
        .from('program_sessions')
        .select('id,plan_payload')
        .eq('program_id', program.id)
        .eq('date', today)
        .maybeSingle();

      const { error: poseGuardError } = await supabase.from('program_guard_events').insert({
        program_id: program.id,
        program_type: input.programType,
        risk_level: 'danger',
        flags: ['pose_risk'],
        blocked_actions: ['training_day'],
      });
      if (poseGuardError) throw poseGuardError;

      if (sessionRow?.id) {
        const { error: sessionUpdateError } = await supabase
          .from('program_sessions')
          .update({
            status: 'skipped',
            plan_payload: {
              ...(sessionRow.plan_payload ?? {}),
              blocked_by_pose_guard_flag_id: poseRiskFlagId,
            },
          })
          .eq('id', sessionRow.id);
        if (sessionUpdateError) throw sessionUpdateError;
      }
    }

    if (medicalBlocked || confidence < CONFIDENCE_BLOCK_THRESHOLD) {
      const { error: guardError } = await supabase.from('program_guard_events').insert({
        program_id: program.id,
        program_type: input.programType,
        risk_level: 'danger',
        flags: [
          medicalBlocked ? 'medical_block' : null,
          confidence < CONFIDENCE_BLOCK_THRESHOLD ? 'low_confidence' : null,
        ].filter(Boolean),
        blocked_actions: ['program_adaptation'],
      });
      if (guardError) throw guardError;

      const nextVersion = Number(program.program_version ?? 1) + 1;
      await supabase.from('program_versions').insert({
        program_id: program.id,
        program_type: input.programType,
        version: nextVersion,
        snapshot: {
          status: 'paused',
          triggers,
          trust_score: trustScore,
          effective_confidence: confidence,
          constraints,
        },
        reason: 'guard_pause',
      });

      await supabase.from('program_explainability').insert({
        program_id: program.id,
        program_type: input.programType,
        version: nextVersion,
        decision_ref: 'why_paused',
        knowledge_refs: knowledgeVersionRef,
        confidence,
        guard_notes: {
          reason_code: 'guard_pause',
          input_context: { trust_score: trustScore, user_state: userState },
          diff_summary: { status: 'paused' },
          safety_notes: {
            medical_blocked: medicalBlocked,
            confidence_blocked: confidence < CONFIDENCE_BLOCK_THRESHOLD,
          },
        },
      });

      await supabase
        .from(programTable)
        .update({ program_version: nextVersion, status: 'paused' })
        .eq('id', program.id);

      return {
        programId: program.id,
        programType: input.programType,
        fromVersion: Number(program.program_version ?? 1),
        toVersion: nextVersion,
        strategy: 'pause',
        triggers,
      };
    }

    let strategy: AdaptationStrategy = 'micro';
    if (fatigueSpike || overload) {
      strategy = 'meso';
    } else if (trustDrop || versionBump) {
      strategy = 'macro';
    } else if (!plateau && !adherenceDrop && skippedDates.length === 0) {
      strategy = 'macro';
    }

    const planDepth = trustScore < TRUST_THRESHOLD ? 'basic' : 'full';
    const adjustmentFactor =
      fatigueSpike || overload
        ? DELOAD_FACTOR
        : adherenceDrop
          ? 0.9
          : plateau
            ? MICRO_ADJUST_FACTOR
            : 1;
    const refeed = fatigueSpike && input.programType === 'nutrition';

    const phases =
      strategy === 'meso'
        ? this.buildDeloadSkeleton(startDate, durationDays)
        : this.buildSkeleton(startDate, durationDays, trustScore);

    const days = this.buildDays(startDate, durationDays, input.programType, goals, confidence, {
      adjustmentFactor,
      planDepth,
      refeed,
    });

    await this.persistProgramStructure({
      programId: program.id,
      programType: input.programType,
      phases,
      days,
      constraints,
    });

    const nextVersion = Number(program.program_version ?? 1) + 1;
    const snapshot = {
      phases,
      trust_score: trustScore,
      effective_confidence: confidence,
      plan_depth: planDepth,
      constraints,
      triggers,
      strategy,
      adjustment_factor: adjustmentFactor,
      refeed,
      knowledge_version_ref: knowledgeVersionRef,
    };

    await supabase.from('program_versions').insert({
      program_id: program.id,
      program_type: input.programType,
      version: nextVersion,
      snapshot,
      reason: 'adaptation_replan',
    });

    await supabase.from('program_adaptations').insert({
      program_id: program.id,
      program_type: input.programType,
      from_version: Number(program.program_version ?? 1),
      to_version: nextVersion,
      trigger: triggers[0] ?? 'plateau',
      summary: { strategy, triggers, adjustment_factor: adjustmentFactor, refeed },
    });

    if (fatigueSpike || overload) {
      await supabase.from('program_guard_events').insert({
        program_id: program.id,
        program_type: input.programType,
        risk_level: overload ? 'danger' : 'caution',
        flags: [fatigueSpike ? 'fatigue' : null, overload ? 'overload' : null].filter(Boolean),
        blocked_actions: overload ? ['intensity_increase'] : [],
      });
    }

    const decisionRef =
      fatigueSpike || overload ? 'why_lowered_intensity' : strategy === 'macro' ? 'why_changed' : 'why_changed';

    await supabase.from('program_explainability').insert({
      program_id: program.id,
      program_type: input.programType,
      version: nextVersion,
      decision_ref: decisionRef,
      knowledge_refs: knowledgeVersionRef,
      confidence,
      guard_notes: {
        reason_code: strategy,
        input_context: { user_state: userState, trust_score: trustScore },
        diff_summary: {
          adjustment_factor: adjustmentFactor,
          refeed,
          plan_depth: planDepth,
        },
        safety_notes: {
          fatigueSpike,
          overload,
          adherenceDrop,
          trustDrop,
          plateau,
          pose_risk: Boolean(poseRiskFlagId),
          pose_guard_flag_id: poseRiskFlagId,
        },
      },
    });

    await supabase
      .from(programTable)
      .update({ program_version: nextVersion, knowledge_version_ref: knowledgeVersionRef })
      .eq('id', program.id);

    return {
      programId: program.id,
      programType: input.programType,
      fromVersion: Number(program.program_version ?? 1),
      toVersion: nextVersion,
      strategy,
      triggers,
    };
  }
}

export const programGenerationService = new ProgramGenerationService();
