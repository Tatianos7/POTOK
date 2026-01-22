import { supabase } from '../lib/supabaseClient';
import { aiTrustService } from './aiTrustService';

export interface PoseCoachResult {
  message: string;
  confidence: number;
  eventType: 'correction' | 'warning';
}

export interface PoseCoachOptions {
  allowRealtime: boolean;
  guardSafe: boolean;
  trustThreshold?: number;
  riskLevel?: 'safe' | 'caution' | 'danger';
  guardReason?: string;
}

class AiPoseCoachService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiPoseCoachService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private buildMessage(scores: any, hasGuard: boolean): PoseCoachResult {
    if (hasGuard) {
      return {
        message: 'Снизьте нагрузку и вернитесь в безопасную амплитуду.',
        confidence: 0.9,
        eventType: 'warning',
      };
    }

    const poseScore = Number(scores?.pose_quality_score ?? 0);
    if (poseScore >= 80) {
      return {
        message: 'Отличная техника. Сохраняйте контроль и темп.',
        confidence: 0.85,
        eventType: 'correction',
      };
    }

    return {
      message: 'Снизьте темп и контролируйте амплитуду в ключевой точке движения.',
      confidence: 0.75,
      eventType: 'correction',
    };
  }

  async generateCue(userId: string, sessionId: string, options: PoseCoachOptions): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const [{ data: scores }, { data: guardFlags }, trustScore] = await Promise.all([
      supabase
        .from('pose_quality_scores')
        .select('pose_quality_score,stability_score,symmetry_score,tempo_score')
        .eq('pose_session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('pose_guard_flags')
        .select('severity')
        .eq('pose_session_id', sessionId),
      aiTrustService.getTrustScore(sessionUserId),
    ]);

    const hasGuard = (guardFlags || []).some((g: any) => g.severity === 'high');
    if (options.guardReason?.includes('velocity_drop_risk')) {
      await supabase.from('pose_feedback_events').insert({
        pose_session_id: sessionId,
        event_type: 'warning',
        message: 'Снизьте темп. Есть признаки утомления по скорости движения.',
        confidence: 0.85,
      });
      return;
    }
    if (options.riskLevel === 'danger') {
      await supabase.from('pose_feedback_events').insert({
        pose_session_id: sessionId,
        event_type: 'warning',
        message: 'Обнаружен риск. Прекратите подход и восстановите безопасное положение.',
        confidence: 0.9,
      });
      return;
    }

    if (!options.guardSafe || hasGuard) {
      await supabase.from('pose_feedback_events').insert({
        pose_session_id: sessionId,
        event_type: 'warning',
        message: 'Обнаружен риск. Снизьте нагрузку и вернитесь в безопасную амплитуду.',
        confidence: 0.9,
      });
      return;
    }

    if (!options.allowRealtime) {
      return;
    }

    const threshold = options.trustThreshold ?? 40;
    if (trustScore < threshold) {
      return;
    }

    const result = this.buildMessage(scores, false);

    if (result.confidence < 0.6) {
      return;
    }

    await supabase.from('pose_feedback_events').insert({
      pose_session_id: sessionId,
      event_type: result.eventType,
      message: result.message,
      confidence: result.confidence,
    });

    await supabase.from('ai_coaching_events').insert({
      user_id: sessionUserId,
      type: result.eventType === 'warning' ? 'warning' : 'correction',
      trigger: 'pose_engine',
      confidence: result.confidence,
      trust_score_used: trustScore,
      state_snapshot: {
        pose_quality_score: scores?.pose_quality_score ?? null,
        stability_score: scores?.stability_score ?? null,
        symmetry_score: scores?.symmetry_score ?? null,
        tempo_score: scores?.tempo_score ?? null,
        guard: hasGuard,
        guard_reason: options.guardReason ?? null,
        risk_level: options.riskLevel ?? 'safe',
      },
    });
  }
}

export const aiPoseCoachService = new AiPoseCoachService();
