import { supabase } from '../lib/supabaseClient';

export type ExecutionStatus = 'planned' | 'completed' | 'skipped';
export type ExecutionReason = 'fatigue' | 'pose_risk' | 'user_override';

function unavailable() {
  return Object.assign(new Error('Действия с программой временно недоступны: база обновляется. Попробуйте позже.'), {
    code: 'PROGRAM_EXECUTION_UNAVAILABLE',
  });
}

/** A client-first transition: no legacy payload fallback, schema writes or cached readiness. */
export class ProgramExecutionService {
  constructor(private readonly client: typeof supabase = supabase) {}

  async annotate(input: {
    programId: string;
    date: string;
    status: ExecutionStatus;
    programType?: 'nutrition' | 'training';
    reason?: ExecutionReason;
  }): Promise<{ userId: string; sessionId: string }> {
    const client = this.client;
    if (!client) throw unavailable();
    if (!['planned', 'completed', 'skipped'].includes(input.status)
      || (input.programType !== undefined && !['nutrition', 'training'].includes(input.programType))
      || (input.reason !== undefined && !['fatigue', 'pose_risk', 'user_override'].includes(input.reason))) {
      throw new Error('Некорректное действие с программой');
    }
    const actor = await client.auth.getUser();
    const userId = actor.data?.user?.id;
    if (actor.error || !userId) throw new Error('Пользователь не авторизован');

    // Validate the actual REST projection without reading a row or sending a mutation.
    // An old schema, stale schema cache, permission failure or outage keeps actions closed.
    const readiness = await client.from('program_sessions').select('execution_reason').limit(0);
    if (readiness.error || !Array.isArray(readiness.data) || readiness.data.length !== 0) throw unavailable();

    let query = client.from('program_sessions').select('id,session_type')
      .eq('program_id', input.programId).eq('date', input.date);
    if (input.programType) query = query.eq('session_type', input.programType === 'nutrition' ? 'meal_plan' : 'workout_plan');
    const target = await query.limit(2);
    if (target.error) throw target.error;
    const row = target.data?.length === 1 ? target.data[0] : null;
    if (!row || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.id)
      || !['meal_plan', 'workout_plan'].includes(row.session_type)
      || (input.programType && row.session_type !== (input.programType === 'nutrition' ? 'meal_plan' : 'workout_plan'))) {
      throw Object.assign(new Error('День программы недоступен или неоднозначен. Обновите программу.'), { code: 'PROGRAM_SESSION_NOT_AVAILABLE' });
    }
    const current = await client.auth.getUser();
    if (current.error || current.data?.user?.id !== userId) {
      throw Object.assign(new Error('Аккаунт изменился. Откройте программу заново.'), { code: 'PROGRAM_EXECUTION_ACCOUNT_CHANGED' });
    }
    const saved = await client.from('program_sessions').update({
      status: input.status,
      execution_reason: input.status === 'skipped' ? (input.reason ?? 'user_override') : null,
    }).eq('id', row.id).eq('program_id', input.programId).eq('date', input.date)
      .eq('session_type', row.session_type).select('id');
    if (saved.error) {
      // GET and PATCH schema caches can become ready at different times. Never retry a write.
      if (['PGRST204', '42703', '42501'].includes(saved.error.code)) throw unavailable();
      throw saved.error;
    }
    if (saved.data?.length !== 1 || saved.data[0].id !== row.id) {
      throw Object.assign(new Error('Сохранение дня программы не подтверждено. Обновите программу.'), { code: 'PROGRAM_EXECUTION_NOT_CONFIRMED' });
    }
    return { userId, sessionId: row.id };
  }
}

export const programExecutionService = new ProgramExecutionService();
