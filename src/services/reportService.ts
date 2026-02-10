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
  private reportSchemaWarned = false; // warn once when schema errors block report storage

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

  private schemaWarned = false;

  private async withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 200): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        try {
          const { isSchemaError } = await import('./dbUtils');
          if (isSchemaError(error)) {
            if (!this.schemaWarned) {
              console.warn('[reportService] Schema mismatch detected — operations will degrade until migration is applied');
              this.schemaWarned = true;
            }
            // return Supabase-like error payload for graceful fallback
            return { data: null, error } as unknown as T;
          }
        } catch (e) {
          // ignore
        }
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

  async requestReportSnapshot(userId: string, period: ReportPeriod): Promise<ReportSnapshot | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const supabaseClient = supabase;
    const aggregates = await this.buildAggregates(sessionUserId, period);

    let data: any = null;
    try {
      const res = await this.withRetry(async () =>
        await supabaseClient
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
      data = res?.data ?? null;
      if (res?.error) throw res.error;
    } catch (err: any) {
      try {
        const { isSchemaError } = await import('./dbUtils');
        if (isSchemaError(err)) {
          if (!this.reportSchemaWarned) {
            console.warn('[reportService] Schema error while creating report snapshots — skipping persistence');
            this.reportSchemaWarned = true;
          }
          return null;
        }
      } catch (e) {
        // ignore import errors
      }
      throw err;
    }

    try {
      await this.withRetry(async () =>
        await supabaseClient
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
    } catch (err: any) {
      try {
        const { isSchemaError } = await import('./dbUtils');
        if (isSchemaError(err)) {
          if (!this.reportSchemaWarned) {
            console.warn('[reportService] Schema error while writing report aggregates — skipping persistence');
            this.reportSchemaWarned = true;
          }
          // continue without failing
          return data as ReportSnapshot;
        }
      } catch (e) {
        // ignore
      }
      throw err;
    }

    try {
      await this.withRetry(async () =>
        await supabaseClient
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
    } catch (err: any) {
      try {
        const { isSchemaError } = await import('./dbUtils');
        if (isSchemaError(err)) {
          if (!this.reportSchemaWarned) {
            console.warn('[reportService] Schema error while writing progress trends — skipping persistence');
            this.reportSchemaWarned = true;
          }
          // continue without failing
          return data as ReportSnapshot;
        }
      } catch (e) {
        // ignore
      }
      throw err;
    }

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
