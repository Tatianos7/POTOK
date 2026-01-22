import { supabase } from '../lib/supabaseClient';
import { getProgressTrends, ProgressTrends } from './analyticsService';
import { aiRecommendationsService } from './aiRecommendationsService';

export interface ReportPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ReportSnapshot {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  status: 'requested' | 'generating' | 'ready' | 'outdated' | 'failed';
  aggregates?: Record<string, unknown> | null;
  ai_summary_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

class ReportService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[reportService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 200): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw lastError;
  }

  private async buildAggregates(userId: string, period: ReportPeriod): Promise<Record<string, unknown>> {
    const trends: ProgressTrends = await getProgressTrends(userId, period.startDate, period.endDate);
    return {
      period,
      trends,
    };
  }

  async requestReportSnapshot(userId: string, period: ReportPeriod): Promise<ReportSnapshot> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const aggregates = await this.buildAggregates(sessionUserId, period);

    const { data, error } = await this.withRetry(() =>
      supabase
        .from('report_snapshots')
        .upsert(
          {
            user_id: sessionUserId,
            period_start: period.startDate,
            period_end: period.endDate,
            status: 'ready',
            aggregates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,period_start,period_end' }
        )
        .select('*')
        .single()
    );

    if (error || !data) {
      throw error || new Error('Failed to create report snapshot');
    }

    await this.withRetry(() =>
      supabase
        .from('report_aggregates')
        .upsert(
          {
            snapshot_id: data.id,
            user_id: sessionUserId,
            data: aggregates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'snapshot_id' }
        )
    );

    await this.withRetry(() =>
      supabase
        .from('progress_trends')
        .upsert(
          {
            user_id: sessionUserId,
            period_start: period.startDate,
            period_end: period.endDate,
            data: aggregates.trends,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,period_start,period_end' }
        )
    );

    return data as ReportSnapshot;
  }

  async getReportSnapshot(userId: string, period: ReportPeriod): Promise<ReportSnapshot | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('report_snapshots')
      .select('*')
      .eq('user_id', sessionUserId)
      .eq('period_start', period.startDate)
      .eq('period_end', period.endDate)
      .single();

    if (error) {
      return null;
    }

    return data as ReportSnapshot;
  }

  async markReportOutdated(userId: string, period: ReportPeriod): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('report_snapshots')
      .update({ status: 'outdated', updated_at: new Date().toISOString() })
      .eq('user_id', sessionUserId)
      .eq('period_start', period.startDate)
      .eq('period_end', period.endDate);

    if (error) {
      throw error;
    }
  }

  async requestReportInterpretation(userId: string, snapshot: ReportSnapshot): Promise<void> {
    const context = {
      report_id: snapshot.id,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      aggregates: snapshot.aggregates ?? null,
    };
    await aiRecommendationsService.queueReportInterpretation(userId, context);
  }
}

export const reportService = new ReportService();
