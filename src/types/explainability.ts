export type ExplainabilitySource =
  | "programUxRuntimeService"
  | "programDeliveryService"
  | "progressAggregatorService"
  | "habitsService"
  | "entitlementService"
  | "trustService"
  | "manual";

export type SafetyFlag =
  | "fatigue"
  | "pain"
  | "overload"
  | "low_confidence"
  | "data_gap"
  | "recovery_needed";

export interface BaseExplainabilityDTO {
  source: ExplainabilitySource;
  version: string;
  data_sources: string[];
  confidence: number;
  trust_score: number;
  decision_ref: string;
  safety_notes: string[];
  adaptation_reason?: string;
}

export interface TodayExplainabilityDTO extends BaseExplainabilityDTO {
  // источник данных: programUxRuntimeService + trustService
  trust_level: number;
  // confidence: уверенность объяснения
  // safety_flags: предупреждения (guard rails)
  safety_flags: SafetyFlag[];
  // premium_reason: нужен ли Premium для объяснения
  premium_reason?: string;
}

export interface ProgramExplainabilityDTO extends BaseExplainabilityDTO {
  // источник данных: programUxRuntimeService
  trust_level: number;
  // confidence: уверенность причин адаптации
  // safety_flags: ограничения по безопасности
  safety_flags: SafetyFlag[];
  // premium_reason: причина блокировки/ограничения
  premium_reason?: string;
}

export interface ProgressExplainabilityDTO extends BaseExplainabilityDTO {
  // источник данных: progressAggregatorService
  trust_level: number;
  // confidence: уверенность тренда
  // safety_flags: предупреждения по данным
  safety_flags: SafetyFlag[];
  // premium_reason: причина блокировки инсайтов
  premium_reason?: string;
}

export interface HabitsExplainabilityDTO extends BaseExplainabilityDTO {
  // источник данных: habitsService + trustService
  trust_level: number;
  // confidence: уверенность влияния привычек
  // safety_flags: предупреждения по регулярности
  safety_flags: SafetyFlag[];
  // premium_reason: если фича ограничена
  premium_reason?: string;
}

export interface PaywallExplainabilityDTO extends BaseExplainabilityDTO {
  // источник данных: entitlementService
  trust_level: number;
  // confidence: уверенность причины блокировки
  // safety_flags: правовые/безопасные ограничения
  safety_flags: SafetyFlag[];
  // premium_reason: причина закрытия доступа
  premium_reason?: string;
}
