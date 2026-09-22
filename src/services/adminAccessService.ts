import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../lib/supabaseClient';

type VerifiedEntitlementClient = Pick<SupabaseClient, 'auth' | 'rpc'>;
type VerifiedCapability = 'premium' | 'admin';

export interface VerifiedProfileCapabilities {
  premium: boolean;
  admin: boolean;
  premiumVerified: boolean;
  adminVerified: boolean;
}

const deniedCapabilities = (): VerifiedProfileCapabilities => ({
  premium: false,
  admin: false,
  premiumVerified: false,
  adminVerified: false,
});

export class AdminAccessService {
  private client: VerifiedEntitlementClient | null;

  constructor(client: VerifiedEntitlementClient | null = defaultSupabase) {
    this.client = client;
  }

  setClientForTests(client: VerifiedEntitlementClient | null): void {
    this.client = client;
  }

  private async readCapability(capability: VerifiedCapability): Promise<{
    allowed: boolean;
    verified: boolean;
  }> {
    if (!this.client) return { allowed: false, verified: false };
    const { data, error } = await this.client.rpc('has_verified_entitlement_v1', {
      p_capability: capability,
    });
    if (error || typeof data !== 'boolean') {
      if (error) {
        console.warn('[adminAccessService] verified entitlement check failed:', error.message || error);
      }
      return { allowed: false, verified: false };
    }
    return { allowed: data, verified: true };
  }

  async getVerifiedCurrentUserCapabilities(
    expectedUserId: string | null | undefined,
  ): Promise<VerifiedProfileCapabilities> {
    if (!this.client || !expectedUserId?.trim()) return deniedCapabilities();

    const { data, error } = await this.client.auth.getUser();
    if (error || data?.user?.id !== expectedUserId) return deniedCapabilities();

    const [premium, admin] = await Promise.all([
      this.readCapability('premium'),
      this.readCapability('admin'),
    ]);
    const postReadSession = await this.client.auth.getUser();
    if (postReadSession.error || postReadSession.data?.user?.id !== expectedUserId) {
      return deniedCapabilities();
    }
    return {
      premium: premium.allowed,
      admin: admin.allowed,
      premiumVerified: premium.verified,
      adminVerified: admin.verified,
    };
  }

  async verifyCurrentUserIsAdmin(userId: string | null | undefined): Promise<boolean> {
    const capabilities = await this.getVerifiedCurrentUserCapabilities(userId);
    return capabilities.adminVerified && capabilities.admin;
  }
}

export const adminAccessService = new AdminAccessService();
