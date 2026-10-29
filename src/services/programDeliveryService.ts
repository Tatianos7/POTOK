import { supabase } from '../lib/supabaseClient';
import { programExecutionService } from './programExecutionService';
import { entitlementService } from './entitlementService';
import { profileService } from './profileService';
import type { ProgramExplainabilityDTO } from '../types/explainability';
import type { ProgramMyPlanDTO, ProgramPhaseWeekDTO, ProgramTodayDTO, ProgramTier, ProgramWhyDTO } from '../types/programDelivery';

export type ProgramType = 'nutrition' | 'training';

export interface ProgramFeedbackInput {
  programId: string;
  programType: ProgramType;
  programSessionId?: string;
  energy?: number;
  hunger?: number;
  difficulty?: number;
  pain?: number;
  motivation?: number;
  notes?: string;
}

class ProgramDeliveryService {
  private cacheKey(prefix: string, key: string) {
    return `program_delivery_${prefix}_${key}`;
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
      console.warn('[programDeliveryService] Передан userId не совпадает с сессией');
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

  private assertEntitlement(tier: ProgramTier, allowed: ProgramTier[]) {
    if (!allowed.includes(tier)) {
      throw new Error('Недостаточно прав для доступа к функции');
    }
  }

  private adjustTrustScore(current: number, delta: number) {
    const next = Math.max(0, Math.min(100, Math.round(current + delta)));
    return next;
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

  async getActiveProgram(
    programType?: ProgramType,
    entitlementOverride?: ProgramTier
  ) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const userId = await this.getSessionUserId();
    const tier = await this.resolveTier(userId, entitlementOverride);
    this.assertEntitlement(tier, ['free', 'pro', 'coach', 'vision_pro']);

    const { data, error } = await supabase.rpc('get_active_program', {
      p_program_type: programType ?? null,
    });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Некорректный ответ списка программ');
    const candidates = data.filter((row) => row?.status === 'active' || row?.status === 'paused');
    if (candidates.some((row) => !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.program_id)
      || !['nutrition', 'training'].includes(row.program_type)
      || (programType !== undefined && row.program_type !== programType))) {
      throw new Error('Некорректная область программы');
    }
    if (candidates.length > 1) throw new Error('Найдено несколько текущих программ. Выберите тип программы.');
    return { tier, program: candidates[0] ?? null };
  }

  async getProgramPhases(programId: string) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { data, error } = await supabase.rpc('get_program_phases', {
      p_program_id: programId,
    });
    if (error) throw error;
    return data as ProgramPhaseWeekDTO[];
  }

  async getProgramDays(programId: string) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { data, error } = await supabase.rpc('get_program_days', {
      p_program_id: programId,
    });
    if (error) throw error;
    return data;
  }

  async getProgramDayDetails(programId: string, date: string) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    try {
      const { data, error } = await supabase.rpc('get_program_day_details', {
        p_program_id: programId,
        p_date: date,
      });
      if (error) throw error;
      localStorage.setItem(this.cacheKey('day', `${programId}_${date}`), JSON.stringify(data));
      return data as ProgramTodayDTO;
    } catch (err: any) {
      const cached = localStorage.getItem(this.cacheKey('day', `${programId}_${date}`));
      if (cached) {
        return JSON.parse(cached) as ProgramTodayDTO;
      }
      throw err;
    }
  }

  async getProgramExplainability(programId: string, version?: number) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const userId = await this.getSessionUserId();
    const canExplain = await entitlementService.canExplain(userId);
    if (!canExplain) {
      const { data, error } = await supabase.rpc('get_program_explainability', {
        p_program_id: programId,
        p_version: version ?? null,
      });
      if (error) throw error;
      return (data as ProgramWhyDTO[]).map((row) => ({
        decisionRef: (row as any).decision_ref ?? row.decisionRef,
      }));
    }
    const { data, error } = await supabase.rpc('get_program_explainability', {
      p_program_id: programId,
      p_version: version ?? null,
    });
    if (error) throw error;
    return data as ProgramWhyDTO[];
  }

  async getProgramStatus(programId: string) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { data, error } = await supabase.rpc('get_program_status', {
      p_program_id: programId,
    });
    if (error) throw error;
    return data?.status ?? null;
  }

  async startDay(programId: string, date: string) {
    await programExecutionService.annotate({ programId, date, status: 'planned' });
  }

  async completeDay(programId: string, date: string, programType: ProgramType) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { userId } = await programExecutionService.annotate({ programId, date, programType, status: 'completed' });

    const { data: trustRow } = await supabase
      .from('ai_trust_scores')
      .select('trust_score')
      .eq('user_id', userId)
      .maybeSingle();
    const nextTrust = this.adjustTrustScore(Number(trustRow?.trust_score ?? 50), 2);
    await supabase.from('ai_trust_scores').upsert({ user_id: userId, trust_score: nextTrust });

    await supabase
      .from(programType === 'nutrition' ? 'nutrition_programs' : 'training_programs')
      .update({ status: 'active' })
      .eq('id', programId);
  }

  async skipDay(
    programId: string,
    date: string,
    programType: ProgramType,
    reason: 'fatigue' | 'pose_risk' | 'user_override' = 'user_override'
  ) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const { userId } = await programExecutionService.annotate({ programId, date, programType, status: 'skipped', reason });

    const { data: trustRow } = await supabase
      .from('ai_trust_scores')
      .select('trust_score')
      .eq('user_id', userId)
      .maybeSingle();
    const nextTrust = this.adjustTrustScore(Number(trustRow?.trust_score ?? 50), -3);
    await supabase.from('ai_trust_scores').upsert({ user_id: userId, trust_score: nextTrust });

    return { adaptationApplied: false as const };
  }

  private async setProgramStatus(programId: string, programType: ProgramType, status: 'active' | 'paused') {
    if (!supabase) throw new Error('Supabase не инициализирован');
    if (!['nutrition', 'training'].includes(programType)
      || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(programId)) throw new Error('Некорректная программа');
    const userId = await this.getSessionUserId();
    const table = programType === 'nutrition' ? 'nutrition_programs' : 'training_programs';
    const target = await supabase.from(table).select('id,user_id').eq('id', programId).eq('user_id', userId).limit(2);
    if (target.error) throw target.error;
    if (target.data?.length !== 1 || target.data[0].id !== programId || target.data[0].user_id !== userId) {
      throw new Error('Программа недоступна для изменения');
    }
    if (await this.getSessionUserId() !== userId) throw new Error('Аккаунт изменился. Откройте программу заново.');
    const saved = await supabase.from(table).update({ status }).eq('id', programId).eq('user_id', userId).select('id');
    if (saved.error) throw saved.error;
    if (saved.data?.length !== 1 || saved.data[0].id !== programId) throw new Error('Изменение программы не подтверждено');
  }

  async pauseProgram(programId: string, programType: ProgramType, _reason: string) {
    // Client-owned status annotation only; protected history/guard records belong to the server.
    await this.setProgramStatus(programId, programType, 'paused');
  }

  async resumeProgram(programId: string, programType: ProgramType) {
    await this.setProgramStatus(programId, programType, 'active');
  }

  async submitFeedback(input: ProgramFeedbackInput) {
    if (!supabase) throw new Error('Supabase не инициализирован');
    const userId = await this.getSessionUserId();
    if (!await entitlementService.canAdaptProgram(userId)) {
      throw new Error('Недостаточно прав для отправки обратной связи');
    }

    const { error: feedbackError } = await supabase.from('program_feedback').insert({
      program_id: input.programId,
      program_type: input.programType,
      program_session_id: input.programSessionId ?? null,
      energy: input.energy ?? null,
      hunger: input.hunger ?? null,
      difficulty: input.difficulty ?? null,
      pain: input.pain ?? null,
      motivation: input.motivation ?? null,
      notes: input.notes ?? null,
    });
    if (feedbackError) throw feedbackError;

    return { feedbackSaved: true as const, adaptationApplied: false as const };
  }

  async getMyPlanDTO(programId: string, programType: ProgramType): Promise<ProgramMyPlanDTO> {
    const days = (await this.getProgramDays(programId)) as Array<any>;
    const status = await this.getProgramStatus(programId);
    return {
      programId,
      programType,
      status: status ?? 'active',
      programVersion: days?.[0]?.program_version ?? 1,
      startDate: days?.[0]?.start_date,
      endDate: days?.[0]?.end_date,
      dayCards: days.map((day) => ({
        date: day.date,
        targets: day.targets ?? null,
        sessionPlan: day.session_plan ?? null,
        status: day.session_status ?? 'planned',
        explainabilitySummary: day.explainability_summary ?? null,
      })),
    };
  }

  async load(): Promise<void> {
    await this.getActiveProgram();
  }

  async refresh(): Promise<void> {
    await this.getActiveProgram();
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

  async explain(programType?: ProgramType): Promise<ProgramExplainabilityDTO> {
    const { program, tier } = await this.getActiveProgram(programType);
    const programId = program?.id ?? program?.program_id ?? program?.programId;
    if (!programId) {
      return {
        source: 'programDeliveryService',
        version: '1.0',
        data_sources: ['programs'],
        confidence: 0.2,
        trust_score: 50,
        decision_ref: 'program:no_program',
        safety_notes: ['Нет активной программы.'],
        trust_level: 50,
        safety_flags: ['data_gap'],
        premium_reason: undefined,
      };
    }

    const userId = await this.getSessionUserId();
    const canExplain = await entitlementService.canExplain(userId);
    const rows = await this.getProgramExplainability(programId);
    const first = rows?.[0] as any;
    const trustScore = await this.getTrustScore(userId);

    return {
      source: 'programDeliveryService',
      version: '1.0',
      data_sources: ['program_explainability', 'program_sessions'],
      confidence: Number(first?.confidence ?? 0.7),
      trust_score: trustScore,
      decision_ref: first?.decision_ref ?? first?.decisionRef ?? 'program:default',
      safety_notes: (first?.guard_notes?.safety_notes as string[]) ?? [],
      adaptation_reason: first?.guard_notes?.reason_code ?? undefined,
      trust_level: trustScore,
      safety_flags: (first?.guard_notes?.flags as any) ?? [],
      premium_reason: canExplain || tier !== 'free' ? undefined : 'explainability_locked',
    };
  }
}

export const programDeliveryService = new ProgramDeliveryService();
