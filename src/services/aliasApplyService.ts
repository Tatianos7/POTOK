import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';

export type AliasApplyResult =
  | 'applied'
  | 'duplicate_alias'
  | 'existing_alias_conflict'
  | 'orphan_canonical'
  | 'invalid_canonical_source'
  | 'not_approved'
  | 'ambiguous_alias'
  | 'missing_source_evidence'
  | 'already_applied'
  | 'permission_denied'
  | 'invalid_alias'
  | 'review_not_found'
  | 'insert_failed';

export type AliasApplyResponse = {
  result: AliasApplyResult;
  aliasId: string | null;
  error: string | null;
};

type AliasApplyRpcRow = {
  result: AliasApplyResult;
  alias_id: string | null;
  error: string | null;
};

export class AliasApplyService {
  private client: SupabaseClient | null;

  constructor(client: SupabaseClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: SupabaseClient | null): void {
    this.client = client;
  }

  async applyApprovedAlias(reviewId: string, alias?: string, comment?: string): Promise<AliasApplyResponse> {
    const client = this.requireClient();
    const { data, error } = await client.rpc('apply_admin_approved_food_alias', {
      p_review_id: reviewId,
      p_alias: alias?.trim() || null,
      p_comment: comment?.trim() || null,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? (data[0] as AliasApplyRpcRow | undefined) : (data as AliasApplyRpcRow | null);
    if (!row?.result) {
      return {
        result: 'insert_failed',
        aliasId: null,
        error: 'RPC did not return an apply result.',
      };
    }

    return {
      result: row.result,
      aliasId: row.alias_id ?? null,
      error: row.error ?? null,
    };
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not initialized');
    }
    return this.client;
  }
}

export const aliasApplyService = new AliasApplyService();
