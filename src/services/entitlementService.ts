import { supabase } from '../lib/supabaseClient';
import type { PaywallExplainabilityDTO } from '../types/explainability';

export interface EntitlementStatus {
  allowed: boolean;
  plan: 'free' | 'pro' | 'vision_pro';
  flags?: Record<string, boolean>;
}

class EntitlementService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }
    if (userId && userId !== data.user.id) {
      console.warn('[entitlementService] Передан userId не совпадает с сессией');
    }
    return data.user.id;
  }

  async getEntitlements(userId?: string) {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase.rpc('get_entitlements', {
      p_user_id: sessionUserId,
    });
    if (error) throw error;
    return data;
  }

  async getPaywallState(feature: 'adaptation' | 'explainability' | 'spatial', userId?: string) {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase.rpc('get_paywall_state', {
      p_feature: feature,
      p_user_id: sessionUserId,
    });
    if (error) throw error;
    return data;
  }

  async canRealtimePose(userId: string): Promise<EntitlementStatus> {
    const ent = await this.getEntitlements(userId);
    const tier = (ent?.tier as EntitlementStatus['plan']) ?? 'free';
    const flags = ent?.flags ?? {};
    const allowed = Boolean(flags?.can_spatial || flags?.can_voice || tier === 'pro' || tier === 'vision_pro');
    return { allowed, plan: tier, flags };
  }

  async canGenerateProgram(userId: string): Promise<boolean> {
    const ent = await this.getEntitlements(userId);
    return Boolean(ent?.flags?.can_view_plan ?? true);
  }

  async canAdaptProgram(userId: string): Promise<boolean> {
    const ent = await this.getEntitlements(userId);
    return Boolean(ent?.flags?.can_adapt ?? false);
  }

  async canExplain(userId: string): Promise<boolean> {
    const ent = await this.getEntitlements(userId);
    return Boolean(ent?.flags?.can_explain ?? false);
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
