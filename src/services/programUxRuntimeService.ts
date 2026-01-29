import { supabase } from '../lib/supabaseClient';
import { profileService } from './profileService';
import { programDeliveryService } from './programDeliveryService';
import { entitlementService } from './entitlementService';
import { coachRuntime, type CoachScreenContext } from './coachRuntime';
import type { TodayExplainabilityDTO } from '../types/explainability';
import type {
  ProgramDayCardDTO,
  ProgramMyPlanDTO,
  ProgramPhaseWeekDTO,
  ProgramTodayDTO,
  ProgramWhyDTO,
  ProgramTier,
} from '../types/programDelivery';

type ProgramType = 'nutrition' | 'training';

export interface ProgramProgressDTO {
  programId: string;
  completedDays: number;
  skippedDays: number;
  plannedDays: number;
  adherenceRate: number;
}

export type UxStatus = 'loading' | 'ready' | 'offline_readonly' | 'blocked' | 'paused';

export interface ProgramUxState {
  status: UxStatus;
  message?: string;
}

class ProgramUxRuntimeService {
  private cacheKey(prefix: string, key: string) {
    return `program_ux_${prefix}_${key}`;
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[programUxRuntimeService] Передан userId не совпадает с сессией');
    }
    return data.user.id;
  }

  private async resolveTier(userId: string, override?: ProgramTier): Promise<ProgramTier> {
    if (override) return override;
    const profile = await profileService.getProfile(userId);
    if (profile?.is_admin) return 'coach';
    if (profile?.has_premium) return 'pro';
    return 'free';
  }

  private async getTrustScore(userId: string): Promise<number> {
    if (!supabase) return 50;
    const { data } = await supabase
      .from('ai_trust_scores')
      .select('trust_score')
      .eq('user_id', userId)
      .maybeSingle();
    return Number(data?.trust_score ?? 50);
  }

  private async buildCoachContext(screen: CoachScreenContext['screen']): Promise<CoachScreenContext> {
    const userId = await this.getSessionUserId();
    const tier = await this.resolveTier(userId);
    const trustLevel = await this.getTrustScore(userId);
    return {
      screen,
      userMode: 'Follow Plan',
      subscriptionState: tier === 'free' ? 'Free' : 'Premium',
      trustLevel,
    };
  }

  private async resolveActiveProgram(): Promise<{ programId: string; programType: ProgramType } | null> {
    try {
      const { program } = await programDeliveryService.getActiveProgram();
      const programId = program?.id ?? program?.program_id ?? program?.programId;
      if (!programId) return null;
      const programType = (program?.program_type ?? program?.programType ?? 'nutrition') as ProgramType;
      return { programId, programType };
    } catch (error) {
      return null;
    }
  }

  private applyEntitlementToExplainability(
    tier: ProgramTier,
    explainability?: ProgramDayCardDTO['explainabilitySummary']
  ) {
    if (!explainability) return explainability;
    if (tier === 'free') {
      return { decisionRef: explainability.decisionRef };
    }
    return explainability;
  }

  async getToday(
    programId: string,
    _programType: ProgramType,
    entitlementOverride?: ProgramTier
  ): Promise<{ state: ProgramUxState; data?: ProgramTodayDTO }> {
    const userId = await this.getSessionUserId();
    const tier = await this.resolveTier(userId, entitlementOverride);
    const today = new Date().toISOString().split('T')[0];

    try {
      const [status, dayDetails] = await Promise.all([
        programDeliveryService.getProgramStatus(programId),
        programDeliveryService.getProgramDayDetails(programId, today),
      ]);

      const uxStatus: UxStatus =
        status === 'blocked' ? 'blocked' : status === 'paused' ? 'paused' : 'ready';

      const rawDay = (dayDetails as any)?.day;
      const rawExplainability = (dayDetails as any)?.explainability;
      const rawSession = (dayDetails as any)?.session;
      const day = rawDay
        ? {
            date: rawDay.date,
            targets: rawDay.targets ?? null,
            sessionPlan: rawDay.session_plan ?? null,
            status: rawSession?.status ?? 'planned',
            explainabilitySummary: this.applyEntitlementToExplainability(
              tier,
              rawExplainability?.[0]
                ? {
                    decisionRef: rawExplainability[0].decision_ref,
                    reasonCode: rawExplainability[0].guard_notes?.reason_code,
                  }
                : null
            ),
          }
        : null;

      const payload: ProgramTodayDTO = {
        programId,
        date: today,
        day: day as ProgramDayCardDTO,
        explainability: tier === 'free' ? null : rawExplainability ?? null,
      };

      localStorage.setItem(this.cacheKey('today', programId), JSON.stringify(payload));

      return { state: { status: uxStatus }, data: payload };
    } catch (err: any) {
      const cached = localStorage.getItem(this.cacheKey('today', programId));
      if (cached) {
        return { state: { status: 'offline_readonly', message: 'offline cache' }, data: JSON.parse(cached) };
      }
      throw err;
    }
  }

  async getMyProgram(
    programId: string,
    programType: ProgramType,
    entitlementOverride?: ProgramTier
  ): Promise<ProgramMyPlanDTO> {
    const userId = await this.getSessionUserId();
    const tier = await this.resolveTier(userId, entitlementOverride);
    const days = (await programDeliveryService.getProgramDays(programId)) as Array<any>;
    const status = await programDeliveryService.getProgramStatus(programId);

    const dayCards: ProgramDayCardDTO[] = days.map((day) => ({
      date: day.date,
      targets: day.targets ?? null,
      sessionPlan: day.session_plan ?? null,
      status: day.session_status ?? 'planned',
      explainabilitySummary: this.applyEntitlementToExplainability(
        tier,
        day.explainability_summary ?? null
      ),
    }));

    const payload: ProgramMyPlanDTO = {
      programId,
      programType,
      status: status ?? 'active',
      programVersion: days?.[0]?.program_version ?? 1,
      startDate: days?.[0]?.start_date,
      endDate: days?.[0]?.end_date,
      dayCards,
    };

    localStorage.setItem(this.cacheKey('plan', programId), JSON.stringify(payload));
    return payload;
  }

  async getPhaseTimeline(programId: string): Promise<ProgramPhaseWeekDTO[]> {
    return programDeliveryService.getProgramPhases(programId);
  }

  async getWhy(
    programId: string,
    version?: number,
    entitlementOverride?: ProgramTier
  ): Promise<ProgramWhyDTO[]> {
    const userId = await this.getSessionUserId();
    const tier = await this.resolveTier(userId, entitlementOverride);
    const rows = await programDeliveryService.getProgramExplainability(programId, version);
    return rows.map((row) => ({
      decisionRef: (row as any).decision_ref ?? row.decisionRef,
      reasonCode: tier === 'free' ? undefined : (row as any).guard_notes?.reason_code,
      diffSummary: tier === 'free' ? undefined : (row as any).guard_notes?.diff_summary,
      safetyNotes: tier === 'free' ? undefined : (row as any).guard_notes?.safety_notes,
      knowledgeRefs: tier === 'free' ? undefined : (row as any).knowledge_refs,
      confidence: (row as any).confidence ?? null,
    }));
  }

  async completeToday(programId: string, programType: ProgramType, date: string) {
    await programDeliveryService.completeDay(programId, date, programType);
    const context = await this.buildCoachContext('Today');
    void coachRuntime.handleUserEvent(
      {
        type: 'DayCompleted',
        timestamp: new Date().toISOString(),
        payload: { program_id: programId, date, program_type: programType, source: 'ui' },
        confidence: 0.7,
        safetyClass: 'normal',
        trustImpact: 1,
      },
      context
    );
  }

  async skipToday(
    programId: string,
    programType: ProgramType,
    date: string,
    reason: 'fatigue' | 'pose_risk' | 'user_override'
  ) {
    await programDeliveryService.skipDay(programId, date, programType, reason);
    const context = await this.buildCoachContext('Today');
    void coachRuntime.handleUserEvent(
      {
        type: 'DaySkipped',
        timestamp: new Date().toISOString(),
        payload: { program_id: programId, date, program_type: programType, reason, source: 'ui' },
        confidence: 0.7,
        safetyClass: reason === 'pose_risk' ? 'caution' : 'normal',
        trustImpact: -1,
      },
      context
    );
    if (reason === 'fatigue' || reason === 'pose_risk') {
      void coachRuntime.handleUserEvent(
        {
          type: reason === 'pose_risk' ? 'PainReported' : 'FatigueReported',
          timestamp: new Date().toISOString(),
          payload: { program_id: programId, date, program_type: programType, reason, source: 'ui' },
          confidence: 0.6,
          safetyClass: 'caution',
          trustImpact: 0,
        },
        context
      );
    }
  }

  async submitFeedback(payload: {
    programId: string;
    programType: ProgramType;
    energy?: number;
    hunger?: number;
    difficulty?: number;
    pain?: number;
    motivation?: number;
    notes?: string;
  }) {
    await programDeliveryService.submitFeedback(payload);
    const context = await this.buildCoachContext('Today');
    const fatigueSignal =
      (payload.energy !== undefined && payload.energy <= 3) ||
      (payload.difficulty !== undefined && payload.difficulty >= 8);
    if (payload.pain && payload.pain > 0) {
      void coachRuntime.handleUserEvent(
        {
          type: 'PainReported',
          timestamp: new Date().toISOString(),
          payload: { ...payload, source: 'ui' },
          confidence: 0.6,
          safetyClass: 'caution',
          trustImpact: 0,
        },
        context
      );
    } else if (fatigueSignal) {
      void coachRuntime.handleUserEvent(
        {
          type: 'FatigueReported',
          timestamp: new Date().toISOString(),
          payload: { ...payload, source: 'ui' },
          confidence: 0.6,
          safetyClass: 'caution',
          trustImpact: 0,
        },
        context
      );
    }
  }

  async getProgress(programId: string): Promise<ProgramProgressDTO> {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { data, error } = await supabase
      .from('program_sessions')
      .select('status')
      .eq('program_id', programId);
    if (error) throw error;
    const completed = data?.filter((row) => row.status === 'completed').length ?? 0;
    const skipped = data?.filter((row) => row.status === 'skipped').length ?? 0;
    const planned = data?.length ?? 0;
    const adherenceRate = planned === 0 ? 0 : Math.round((completed / planned) * 100);
    return {
      programId,
      completedDays: completed,
      skippedDays: skipped,
      plannedDays: planned,
      adherenceRate,
    };
  }

  async load(): Promise<void> {
    await this.resolveActiveProgram();
  }

  async refresh(): Promise<void> {
    await this.resolveActiveProgram();
  }

  async offlineSnapshot(): Promise<void> {
    return Promise.resolve();
  }

  async revalidate(): Promise<void> {
    await this.refresh();
  }

  async recover(): Promise<void> {
    await this.refresh();
  }

  async explain(): Promise<TodayExplainabilityDTO> {
    const active = await this.resolveActiveProgram();
    if (!active) {
      return {
        source: 'programUxRuntimeService',
        version: '1.0',
        data_sources: ['programs'],
        confidence: 0.2,
        trust_score: 50,
        decision_ref: 'today:no_program',
        safety_notes: ['Нет активной программы.'],
        trust_level: 50,
        safety_flags: ['data_gap'],
        premium_reason: undefined,
      };
    }

    const userId = await this.getSessionUserId();
    const canExplain = await entitlementService.canExplain(userId);
    const today = new Date().toISOString().split('T')[0];
    const details = await programDeliveryService.getProgramDayDetails(active.programId, today);
    const explainability = (details as any)?.explainability?.[0] as any;
    const trustScore = await this.getTrustScore(userId);

    return {
      source: 'programUxRuntimeService',
      version: '1.0',
      data_sources: ['program_sessions', 'program_explainability', 'program_guard_events'],
      confidence: Number(explainability?.confidence ?? 0.7),
      trust_score: trustScore,
      decision_ref: explainability?.decision_ref ?? 'today:default',
      safety_notes: (explainability?.guard_notes?.safety_notes as string[]) ?? [],
      adaptation_reason: explainability?.guard_notes?.reason_code ?? undefined,
      trust_level: trustScore,
      safety_flags: (explainability?.guard_notes?.flags as any) ?? [],
      premium_reason: canExplain ? undefined : 'explainability_locked',
    };
  }
}

export const programUxRuntimeService = new ProgramUxRuntimeService();
