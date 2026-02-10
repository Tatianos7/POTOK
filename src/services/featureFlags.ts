export type FeatureFlagName =
  | 'coach_enabled'
  | 'coach_voice_enabled'
  | 'coach_dialog_enabled'
  | 'coach_memory_enabled'
  | 'coach_decision_support_enabled';

export interface FeatureFlags {
  coach_enabled: boolean;
  coach_voice_enabled: boolean;
  coach_dialog_enabled: boolean;
  coach_memory_enabled: boolean;
  coach_decision_support_enabled: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  coach_enabled: true,
  coach_voice_enabled: true,
  coach_dialog_enabled: true,
  coach_memory_enabled: true,
  coach_decision_support_enabled: true,
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const readEnvFlag = (key: string): boolean | undefined => {
  const envValue =
    (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, unknown> }).env?.[key]) ??
    (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, unknown> }).env?.[`VITE_${key}`]);
  return normalizeBoolean(envValue);
};

const readLocalStorageFlag = (key: string): boolean | undefined => {
  if (typeof localStorage === 'undefined') return undefined;
  return normalizeBoolean(localStorage.getItem(key));
};

const readFlagsOverride = (): Partial<FeatureFlags> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem('potok_feature_flags');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<FeatureFlags>) : {};
  } catch {
    return {};
  }
};

export const getFeatureFlags = (): FeatureFlags => {
  const overrides = readFlagsOverride();
  return {
    coach_enabled: overrides.coach_enabled ?? DEFAULT_FLAGS.coach_enabled,
    coach_voice_enabled: overrides.coach_voice_enabled ?? DEFAULT_FLAGS.coach_voice_enabled,
    coach_dialog_enabled: overrides.coach_dialog_enabled ?? DEFAULT_FLAGS.coach_dialog_enabled,
    coach_memory_enabled: overrides.coach_memory_enabled ?? DEFAULT_FLAGS.coach_memory_enabled,
    coach_decision_support_enabled:
      overrides.coach_decision_support_enabled ?? DEFAULT_FLAGS.coach_decision_support_enabled,
  };
};

export const isCoachKillSwitchEnabled = (): boolean => {
  const envFlag = readEnvFlag('POTOK_DISABLE_COACH');
  if (envFlag !== undefined) return envFlag;
  const localFlag = readLocalStorageFlag('POTOK_DISABLE_COACH');
  if (localFlag !== undefined) return localFlag;
  return false;
};
