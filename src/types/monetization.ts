export interface PaywallState {
  locked: boolean;
  requiredTier?: 'pro' | 'vision_pro';
  reason?: string;
  tier?: 'free' | 'pro' | 'vision_pro' | 'coach';
}

export interface FeatureLockReason {
  feature: 'adaptation' | 'explainability' | 'spatial' | 'voice' | 'pose_realtime';
  reason: string;
}

export interface UpgradeOption {
  sku: string;
  provider: 'app_store' | 'play_store' | 'vision_pro';
  plan: 'pro' | 'vision_pro';
  priceText?: string;
}

export interface RestoreResult {
  status: 'restored' | 'not_found' | 'failed';
  message?: string;
}
