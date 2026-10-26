import { supabase } from '../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaywallExplainabilityDTO } from '../types/explainability';

export interface EntitlementStatus {
  allowed: boolean;
  plan: 'free' | 'pro' | 'vision_pro';
  flags?: Record<string, boolean>;
}

export class EntitlementService {
  constructor(private readonly client: Pick<SupabaseClient, 'auth' | 'rpc'> | null = supabase) {}

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!this.client) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await this.client.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      throw new Error('[entitlementService] Пользователь изменился. Повторите действие в текущем аккаунте.');
    }
    return data.user.id;
  }

  async getEntitlements(userId?: string) {
    if (!this.client) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await this.client.rpc('get_entitlements', {
      p_user_id: sessionUserId,
    });
    if (error) throw error;
    await this.getSessionUserId(sessionUserId);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('[entitlementService] Некорректный ответ проверки прав');
    }
    return data;
  }

  async getPaywallState(feature: 'adaptation' | 'explainability' | 'spatial', userId?: string) {
    if (!this.client) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await this.client.rpc('get_paywall_state', {
      p_feature: feature,
      p_user_id: sessionUserId,
    });
    if (error) throw error;
    await this.getSessionUserId(sessionUserId);
    return data;
  }

  private booleanFlags(ent: { flags?: unknown }): Record<string, boolean> {
    const flags = ent.flags;
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return {};
    return Object.fromEntries(Object.entries(flags).map(([key, value]) => [key, value === true]));
  }

  private async hasVerifiedPremium(userId: string): Promise<boolean> {
    await this.getSessionUserId(userId);
    if (!this.client) return false;
    // Legacy tier/flags can restrict a feature, but cannot establish Premium.
    const { data, error } = await this.client.rpc('has_verified_entitlement_v1', {
      p_capability: 'premium',
    });
    await this.getSessionUserId(userId);
    return !error && data === true;
  }

  async canRealtimePose(userId: string): Promise<EntitlementStatus> {
    const ent = await this.getEntitlements(userId);
    const tier: EntitlementStatus['plan'] = ent.tier === 'pro' || ent.tier === 'vision_pro' ? ent.tier : 'free';
    const flags = this.booleanFlags(ent);
    const allowed = flags.can_spatial === true && await this.hasVerifiedPremium(userId);
    return { allowed, plan: tier, flags };
  }

  async canGenerateProgram(userId: string): Promise<boolean> {
    const ent = await this.getEntitlements(userId);
    // Preserve existing Free default, but never coerce a malformed flag to true.
    if (ent.flags != null && (typeof ent.flags !== 'object' || Array.isArray(ent.flags))) return false;
    const flag = ent.flags?.can_view_plan;
    return flag === undefined || flag === null ? true : flag === true;
  }

  async canAdaptProgram(userId: string): Promise<boolean> {
    const ent = await this.getEntitlements(userId);
    return this.booleanFlags(ent).can_adapt === true && await this.hasVerifiedPremium(userId);
  }

  async canExplain(userId: string): Promise<boolean> {
    const ent = await this.getEntitlements(userId);
    return this.booleanFlags(ent).can_explain === true && await this.hasVerifiedPremium(userId);
  }

  async load(): Promise<void> {
    await this.getEntitlements();
  }

  async refresh(): Promise<void> {
    await this.getEntitlements();
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

  async explain(): Promise<PaywallExplainabilityDTO> {
    const userId = await this.getSessionUserId();
    const paywall = await this.getPaywallState('explainability', userId);
    const ent = await this.getEntitlements(userId);
    const trustScore = 50;

    return {
      source: 'entitlementService',
      version: '1.0',
      data_sources: ['entitlements', 'paywall_state'],
      confidence: 0.9,
      trust_score: trustScore,
      decision_ref: paywall?.decision_ref ?? 'paywall:default',
      safety_notes: [],
      trust_level: trustScore,
      safety_flags: [],
      premium_reason: paywall?.reason ?? (ent?.tier === 'free' ? 'premium_required' : undefined),
    };
  }
}

export const entitlementService = new EntitlementService();
