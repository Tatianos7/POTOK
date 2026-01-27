import { supabase } from '../lib/supabaseClient';

export interface DayAnalysisContext {
  date: string;
  totals: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    weight: number;
  };
  meals: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snack: number;
  };
  foods?: Array<{
    canonical_food_id: string | null;
    name: string;
    grams: number;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }>;
  goals?: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  } | null;
  user_state?: Record<string, unknown>;
  confidence_min?: number;
  confidence_blocked?: boolean;
}

class AiRecommendationsService {
  private readonly MAX_QUEUED_PER_DAY = 5;
  private readonly MAX_QUEUED_GENERIC = 10;
  private readonly MODEL_VERSION = 'v1';
  private readonly PROMPT_VERSION = 'v1';
  private readonly GENERATION_PARAMS = { temperature: 0, top_p: 1 };

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiRecommendationsService] Передан userId не совпадает с сессией');
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

  private buildInputHash(context: DayAnalysisContext): string {
    return this.hashString(this.stableStringify(context));
  }

  private assertContext(context: DayAnalysisContext): void {
    const { totals } = context;
    const values = [totals.calories, totals.protein, totals.fat, totals.carbs, totals.weight];
    if (!context.date) {
      throw new Error('[aiRecommendationsService] Missing date in context');
    }
    const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
    if (invalid) {
      throw new Error('[aiRecommendationsService] Invalid totals in context');
    }
  }

  async queueDayRecommendation(userId: string, context: DayAnalysisContext, idempotencyKey?: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    this.assertContext(context);

    const sessionUserId = await this.getSessionUserId(userId);
    const inputHash = this.buildInputHash(context);
    if (context.confidence_blocked) {
      await this.queueSuppressedRecommendation(userId, context, { reason: 'low_confidence_food' }, idempotencyKey);
      return;
    }

    const { count } = await supabase
      .from('ai_recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionUserId)
      .eq('request_type', 'recommendation')
      .eq('input_context->>date', context.date)
      .in('status', ['queued', 'running']);

    if ((count ?? 0) >= this.MAX_QUEUED_PER_DAY) {
      throw new Error('[aiRecommendationsService] Rate limit exceeded for day');
    }

    const { data: existing } = await supabase
      .from('ai_recommendations')
      .select('id,status')
      .eq('user_id', sessionUserId)
      .eq('request_type', 'recommendation')
      .eq('input_hash', inputHash)
      .in('status', ['queued', 'running', 'completed'])
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .insert({
        user_id: sessionUserId,
        model_version: this.MODEL_VERSION,
        prompt_version: this.PROMPT_VERSION,
        generation_params: this.GENERATION_PARAMS,
        request_type: 'recommendation',
        input_context: context,
        input_hash: inputHash,
        idempotency_key: idempotencyKey ?? inputHash,
        status: 'queued',
      });

    if (error) {
      throw error;
    }
  }

  async queueReportInterpretation(
    userId: string,
    context: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<void> {
    await this.queueGenericRecommendation(userId, context, idempotencyKey);
  }

  async queueSuppressedRecommendation(
    userId: string,
    context: DayAnalysisContext,
    reasons: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const inputHash = this.buildInputHash(context);

    const { error } = await supabase
      .from('ai_recommendations')
      .insert({
        user_id: sessionUserId,
        model_version: this.MODEL_VERSION,
        prompt_version: this.PROMPT_VERSION,
        generation_params: this.GENERATION_PARAMS,
        request_type: 'recommendation',
        input_context: context,
        input_hash: inputHash,
        idempotency_key: idempotencyKey ?? inputHash,
        status: 'suppressed',
        explainability: reasons,
      });

    if (error) {
      throw error;
    }
  }

  async queueHabitFeedback(
    userId: string,
    context: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<void> {
    await this.queueGenericRecommendation(userId, context, idempotencyKey);
  }

  private async queueGenericRecommendation(
    userId: string,
    context: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const inputHash = this.hashString(this.stableStringify(context));

    const { count } = await supabase
      .from('ai_recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionUserId)
      .eq('request_type', 'recommendation')
      .in('status', ['queued', 'running']);

    if ((count ?? 0) >= this.MAX_QUEUED_GENERIC) {
      throw new Error('[aiRecommendationsService] Rate limit exceeded');
    }

    const { data: existing } = await supabase
      .from('ai_recommendations')
      .select('id,status')
      .eq('user_id', sessionUserId)
      .eq('request_type', 'recommendation')
      .eq('input_hash', inputHash)
      .in('status', ['queued', 'running', 'completed'])
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .insert({
        user_id: sessionUserId,
        model_version: this.MODEL_VERSION,
        prompt_version: this.PROMPT_VERSION,
        generation_params: this.GENERATION_PARAMS,
        request_type: 'recommendation',
        input_context: context,
        input_hash: inputHash,
        idempotency_key: idempotencyKey ?? inputHash,
        status: 'queued',
      });

    if (error) {
      throw error;
    }
  }

  async markDayRecommendationOutdated(userId: string, date: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);

    const { error } = await supabase
      .from('ai_recommendations')
      .update({ status: 'outdated', updated_at: new Date().toISOString() })
      .eq('user_id', sessionUserId)
      .eq('request_type', 'recommendation')
      .eq('input_context->>date', date)
      .in('status', ['queued', 'running', 'completed']);

    if (error) {
      throw error;
    }
  }

  async markRunning(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async markValidating(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .update({ status: 'validating', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async markSuppressed(id: string, reasons: Record<string, unknown>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .update({
        status: 'suppressed',
        explainability: reasons,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async markRequiresReview(id: string, reasons: Record<string, unknown>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .update({
        status: 'requires_review',
        explainability: reasons,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async markCompleted(
    id: string,
    result: unknown,
    explainability?: Record<string, unknown>,
    scores?: { confidence?: number | null; relevance?: number | null }
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .update({
        status: 'completed',
        result,
        explainability: explainability ?? null,
        confidence_score: scores?.confidence ?? null,
        relevance_score: scores?.relevance ?? null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_recommendations')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}

export const aiRecommendationsService = new AiRecommendationsService();
