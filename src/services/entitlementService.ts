import { supabase } from '../lib/supabaseClient';
import { profileService } from './profileService';

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
}

export const entitlementService = new EntitlementService();
