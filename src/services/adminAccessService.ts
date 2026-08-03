import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';

type UserIdColumn = 'id_user' | 'user_id';

const isMissingUserIdColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: string; message?: string };
  const message = (record.message || '').toLowerCase();
  return (
    record.code === '42703' ||
    record.code === 'PGRST204' ||
    message.includes('column user_profiles.id_user does not exist') ||
    message.includes('column user_profiles.user_id does not exist') ||
    message.includes('column "id_user" does not exist') ||
    message.includes('column "user_id" does not exist')
  );
};

export class AdminAccessService {
  private client: SupabaseClient | null;

  constructor(client: SupabaseClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
  }

  async verifyCurrentUserIsAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!this.client || !userId?.trim()) return false;

    const fetchByColumn = async (column: UserIdColumn) =>
      await this.client!
        .from('user_profiles')
        .select('is_admin')
        .eq(column, userId)
        .maybeSingle();

    let { data, error } = await fetchByColumn('id_user');
    if (error && isMissingUserIdColumnError(error)) {
      const fallback = await fetchByColumn('user_id');
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.warn('[adminAccessService] admin access check failed:', error.message || error);
      return false;
    }

    return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
  }
}

export const adminAccessService = new AdminAccessService();
