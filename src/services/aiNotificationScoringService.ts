import { supabase } from '../lib/supabaseClient';
import { aiTrustService } from './aiTrustService';
import { userStateService } from './userStateService';

export interface NotificationScoreInput {
  ruleId?: string | null;
  triggerType: string;
  contextRef?: string | null;
  context: Record<string, unknown>;
  period: { fromDate: string; toDate: string };
}

export interface ScoredNotification {
  id: string;
  trigger_type: string;
  urgency_score: number;
  relevance_score: number;
  trust_weighted_priority: number;
  status: 'queued' | 'scored' | 'throttled';
  score_breakdown?: Record<string, unknown> | null;
}

class AiNotificationScoringService {
  private readonly MAX_SENDS_DEFAULT = 3;
  private readonly MAX_SENDS_LOW_TRUST = 1;
  private readonly MODEL_VERSION = 'v1';
  private notificationHistoryAvailable = true;
  private notificationHistoryWarned = false; // warn once if history table missing

  private async isMissingTableError(error: any): Promise<boolean> {
    try {
      const { isTableMissingError } = await import('./dbUtils');
      return isTableMissingError(error);
    } catch (e) {
      return (
        error?.code === 'PGRST205' ||
        error?.code === 'PGRST204' ||
        error?.message?.includes('404') ||
        error?.message?.includes('not found')
      );
    }
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
      console.warn('[aiNotificationScoringService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private stableStringify(value: unknown): string {
    const seen = new WeakSet();
    const stringify = (val: any): any => {
      if (val === null || typeof val !== 'object') return val;
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
      if (Array.isArray(val)) return val.map(stringify);
      const keys = Object.keys(val).sort();
      const out: Record<string, any> = {};
      keys.forEach((key) => {
        out[key] = stringify(val[key]);
      });
      return out;
    };
    return JSON.stringify(stringify(value));
  }

  private hashString(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  }

  private buildDedupeKey(userId: string, input: NotificationScoreInput): string {
    const payload = {
      userId,
      triggerType: input.triggerType,
      contextRef: input.contextRef ?? null,
      context: input.context,
      period: input.period,
    };
    return this.hashString(this.stableStringify(payload));
  }

  private computeScores(context: Record<string, unknown>, trustScore: number, state: any) {
    const deviation = Number(context.goal_deviation ?? state?.trend_weight_7d ?? 0);
    const adherence = Number(context.adherence_drop ?? 0);
    const streakRisk = Number(context.streak_risk ?? 0);
    const fatigue = Number(state?.fatigue_index ?? 0);

    const urgency = Math.max(0, deviation * 0.6 + adherence * 0.3 + streakRisk * 0.1);
    const relevance = Math.max(0, 1 - Math.min(1, fatigue));
    const trustFactor = Math.max(0.2, Math.min(1, trustScore / 100));
    const trustWeighted = urgency * relevance * trustFactor;

    return {
      urgency,
      relevance,
      trustWeighted,
      breakdown: {
        deviation,
        adherence,
        streakRisk,
        fatigue,
        trustScore,
        trustFactor,
      },
    };
  }

  private async isSuppressed(userId: string): Promise<boolean> {
    if (!supabase) return false;
    const { data, error } = await supabase
      .from('notification_suppression')
      .select('until_ts')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data?.until_ts) return false;
    return new Date(data.until_ts).getTime() > Date.now();
  }

  private async exceededDailyLimit(userId: string, trustScore: number): Promise<boolean> {
    if (!supabase) return false;
    if (!this.notificationHistoryAvailable) return false;
    const limit = trustScore < 30 ? this.MAX_SENDS_LOW_TRUST : this.MAX_SENDS_DEFAULT;
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from('notification_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`)
      .in('status', ['queued', 'sent', 'delivered', 'opened']);

    if (error && (await this.isMissingTableError(error))) {
      this.notificationHistoryAvailable = false;
      if (!this.notificationHistoryWarned) {
        console.warn('[aiNotificationScoringService] notification_history table missing in DB — silencing history queries');
        this.notificationHistoryWarned = true;
      }
      return false;
    }

    return (count ?? 0) >= limit;
  }

  async queueScore(userId: string, input: NotificationScoreInput): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const dedupeKey = this.buildDedupeKey(sessionUserId, input);

    const { data: existing } = await supabase
      .from('notification_scores')
      .select('id')
      .eq('user_id', sessionUserId)
      .eq('dedupe_key', dedupeKey)
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0].id;
    }

    const { data, error } = await supabase
      .from('notification_scores')
      .insert({
        user_id: sessionUserId,
        rule_id: input.ruleId ?? null,
        trigger_type: input.triggerType,
        context_ref: input.contextRef ?? null,
        status: 'queued',
        dedupe_key: dedupeKey,
        score_breakdown: {
          model_version: this.MODEL_VERSION,
          context: input.context,
          period: input.period,
        },
      })
      .select('id')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to queue notification score');
    }

    return data.id as string;
  }

  async scoreQueued(userId: string, period: { fromDate: string; toDate: string }): Promise<ScoredNotification[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);

    const [trustScore, state, suppressed] = await Promise.all([
      aiTrustService.getTrustScore(sessionUserId),
      userStateService.buildState(sessionUserId, period),
      this.isSuppressed(sessionUserId),
    ]);

    const { data: queued, error } = await supabase
      .from('notification_scores')
      .select('*')
      .eq('user_id', sessionUserId)
      .eq('status', 'queued');

    if (error) {
      throw error;
    }

    const queuedRows = queued || [];
    const scored: ScoredNotification[] = [];

    for (const row of queuedRows) {
      const context = (row.score_breakdown?.context as Record<string, unknown>) || {};
      const { urgency, relevance, trustWeighted, breakdown } = this.computeScores(context, trustScore, state);
      const nextStatus: 'scored' | 'throttled' = suppressed ? 'throttled' : 'scored';

      const { error: updateError } = await supabase
        .from('notification_scores')
        .update({
          urgency_score: urgency,
          relevance_score: relevance,
          trust_weighted_priority: trustWeighted,
          status: nextStatus,
          updated_at: new Date().toISOString(),
          score_breakdown: {
            ...row.score_breakdown,
            explainability: breakdown,
            trust_score: trustScore,
          },
        })
        .eq('id', row.id);

      if (updateError) {
        throw updateError;
      }

      scored.push({
        id: row.id,
        trigger_type: row.trigger_type,
        urgency_score: urgency,
        relevance_score: relevance,
        trust_weighted_priority: trustWeighted,
        status: nextStatus,
        score_breakdown: breakdown,
      });
    }

    if (await this.exceededDailyLimit(sessionUserId, trustScore)) {
      await supabase
        .from('notification_scores')
        .update({ status: 'throttled', updated_at: new Date().toISOString() })
        .eq('user_id', sessionUserId)
        .eq('status', 'scored');
      return scored.map((s) => ({ ...s, status: 'throttled' }));
    }

    return scored.sort((a, b) => {
      if (b.trust_weighted_priority !== a.trust_weighted_priority) {
        return b.trust_weighted_priority - a.trust_weighted_priority;
      }
      return a.id.localeCompare(b.id);
    });
  }
}

export const aiNotificationScoringService = new AiNotificationScoringService();
