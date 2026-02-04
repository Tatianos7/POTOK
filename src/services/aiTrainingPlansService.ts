import { supabase } from '../lib/supabaseClient';

export interface TrainingDayContext {
  date: string;
  totals: {
    volume: number;
    sets: number;
    reps: number;
    exercises: number;
  };
  exercises?: Array<{
    canonical_exercise_id?: string | null;
    movement_pattern?: string | null;
    energy_system?: string | null;
    sets: number;
    reps: number;
    weight: number;
    volume: number;
    muscles: string[];
  }>;
  goals?: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  } | null;
  user_state?: Record<string, unknown>;
}

class AiTrainingPlansService {
  private readonly MAX_QUEUED = 3;
  private readonly MODEL_VERSION = 'v1';
  private readonly PROMPT_VERSION = 'v1';
  private readonly GENERATION_PARAMS = { temperature: 0, top_p: 1 };

  // If DB missing input_context column, avoid noisy exceptions and fallback
  private inputContextMissWarned = false;

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[aiTrainingPlansService] Передан userId не совпадает с сессией');
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

  private buildInputHash(context: TrainingDayContext): string {
    return this.hashString(this.stableStringify(context));
  }

  async queueTrainingPlan(userId: string, context: TrainingDayContext, idempotencyKey?: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const inputHash = this.buildInputHash(context);

    const { count } = await supabase
      .from('ai_training_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sessionUserId)
      .in('status', ['queued', 'running']);

    if ((count ?? 0) >= this.MAX_QUEUED) {
      throw new Error('[aiTrainingPlansService] Rate limit exceeded');
    }

    const { data: existing } = await supabase
      .from('ai_training_plans')
      .select('id,status')
      .eq('user_id', sessionUserId)
      .eq('input_hash', inputHash)
      .in('status', ['queued', 'running', 'completed'])
      .limit(1);

    if (existing && existing.length > 0) {
      return;
    }

    // Try inserting with input_context; if DB lacks column, retry without it once
    let insertError: any = null;
    try {
      const res = await supabase
        .from('ai_training_plans')
        .insert({
          user_id: sessionUserId,
          model_version: this.MODEL_VERSION,
          prompt_version: this.PROMPT_VERSION,
          generation_params: this.GENERATION_PARAMS,
          input_context: context,
          input_hash: inputHash,
          idempotency_key: idempotencyKey ?? inputHash,
          status: 'queued',
        });
      insertError = res.error;
    } catch (err: any) {
      insertError = err;
    }

    if (insertError) {
      const msg = String(insertError.message ?? '').toLowerCase();
      const code = String(insertError.code ?? '').toUpperCase();
      if (code === '42703' || msg.includes('input_context') || msg.includes('does not exist')) {
        this.inputContextMissing = true;
        if (!this.inputContextMissWarned) {
          console.warn('[aiTrainingPlansService] input_context column missing in DB, performing fallback insert without it');
          this.inputContextMissWarned = true;
        }
        const { error: retryError } = await supabase
          .from('ai_training_plans')
          .insert({
            user_id: sessionUserId,
            model_version: this.MODEL_VERSION,
            prompt_version: this.PROMPT_VERSION,
            generation_params: this.GENERATION_PARAMS,
            input_hash: inputHash,
            idempotency_key: idempotencyKey ?? inputHash,
            status: 'queued',
          });
        if (retryError) throw retryError;
      } else {
        throw insertError;
      }
    }
  }

  async markTrainingPlanOutdated(userId: string, date: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);

    // If input_context column is missing, do a safe fallback: log once and skip marking
    try {
      const { error } = await supabase
        .from('ai_training_plans')
        .update({ status: 'outdated', updated_at: new Date().toISOString() })
        .eq('user_id', sessionUserId)
        .eq('input_context->>date', date)
        .in('status', ['queued', 'running', 'completed']);

      if (error) {
        const msg = String(error.message ?? '').toLowerCase();
        const code = String(error.code ?? '').toUpperCase();
        if (code === '42703' || msg.includes('input_context') || msg.includes('does not exist')) {
          this.inputContextMissing = true;
          if (!this.inputContextMissWarned) {
            console.warn('[aiTrainingPlansService] input_context column missing when marking outdated — skipping operation');
            this.inputContextMissWarned = true;
          }
          return;
        }
        throw error;
      }
    } catch (err: any) {
      const msg = String(err?.message ?? '').toLowerCase();
      const code = String(err?.code ?? '').toUpperCase();
      if (code === '42703' || msg.includes('input_context') || msg.includes('does not exist')) {
        this.inputContextMissing = true;
        if (!this.inputContextMissWarned) {
          console.warn('[aiTrainingPlansService] input_context column missing when marking outdated — skipping operation');
          this.inputContextMissWarned = true;
        }
        return;
      }
      throw err;
    }
  }

  async markRunning(id: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_training_plans')
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
      .from('ai_training_plans')
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
      .from('ai_training_plans')
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
      .from('ai_training_plans')
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
    plan: unknown,
    explainability?: Record<string, unknown>,
    scores?: { confidence?: number | null; relevance?: number | null }
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase
      .from('ai_training_plans')
      .update({
        status: 'completed',
        plan,
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
      .from('ai_training_plans')
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

export const aiTrainingPlansService = new AiTrainingPlansService();
