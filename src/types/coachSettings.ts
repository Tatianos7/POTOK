export type CoachMode =
  | 'support'
  | 'on_request'
  | 'risk_only'
  | 'off';

export interface CoachSettings {
  coach_enabled: boolean;
  coach_mode: CoachMode;
}

export type CoachVoiceMode = 'off' | 'risk_only' | 'on_request' | 'always';

export type CoachVoiceStyle = 'calm' | 'supportive' | 'motivational';

export type CoachVoiceIntensity = 'soft' | 'neutral' | 'leading';

export interface CoachVoiceSettings {
  enabled: boolean;
  mode: CoachVoiceMode;
  style: CoachVoiceStyle;
  intensity: CoachVoiceIntensity;
}
