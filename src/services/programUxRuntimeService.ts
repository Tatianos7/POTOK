import { supabase } from '../lib/supabaseClient';
import { profileService } from './profileService';
import { programDeliveryService } from './programDeliveryService';
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
    programType: ProgramType,
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

      const day = dayDetails?.day
        ? {
            date: dayDetails.day.date,
            targets: dayDetails.day.targets ?? null,
            sessionPlan: dayDetails.day.session_plan ?? null,
            status: dayDetails.session?.status ?? 'planned',
            explainabilitySummary: this.applyEntitlementToExplainability(
              tier,
              dayDetails.explainability?.[0]
                ? {
                    decisionRef: dayDetails.explainability[0].decision_ref,
                    reasonCode: dayDetails.explainability[0].guard_notes?.reason_code,
                  }
                : null
            ),
          }
        : null;

      const payload: ProgramTodayDTO = {
        programId,
        date: today,
        day: day as ProgramDayCardDTO,
        explainability: tier === 'free' ? null : dayDetails.explainability ?? null,
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
  }

  async skipToday(
    programId: string,
    programType: ProgramType,
    date: string,
    reason: 'fatigue' | 'pose_risk' | 'user_override'
  ) {
    await programDeliveryService.skipDay(programId, date, programType, reason);
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
}

export const programUxRuntimeService = new ProgramUxRuntimeService();
