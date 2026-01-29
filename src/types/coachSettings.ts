export type CoachMode =
  | 'support'
  | 'on_request'
  | 'risk_only'
  | 'off';

export interface CoachSettings {
  coach_enabled: boolean;
  coach_mode: CoachMode;
}
