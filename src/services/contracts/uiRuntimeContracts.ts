import type {
  HabitsExplainabilityDTO,
  PaywallExplainabilityDTO,
  ProgramExplainabilityDTO,
  ProgressExplainabilityDTO,
  TodayExplainabilityDTO,
} from "../../types/explainability";

export interface TodayService {
  load(): Promise<void>;
  refresh(): Promise<void>;
  offlineSnapshot(): Promise<void>;
  revalidate(): Promise<void>;
  recover(): Promise<void>;
  explain(): Promise<TodayExplainabilityDTO>;
}

export interface ProgramService {
  load(): Promise<void>;
  refresh(): Promise<void>;
  offlineSnapshot(): Promise<void>;
  revalidate(): Promise<void>;
  recover(): Promise<void>;
  explain(): Promise<ProgramExplainabilityDTO>;
}

export interface ProgressService {
  load(): Promise<void>;
  refresh(): Promise<void>;
  offlineSnapshot(): Promise<void>;
  revalidate(): Promise<void>;
  recover(): Promise<void>;
  explain(): Promise<ProgressExplainabilityDTO>;
}

export interface HabitsService {
  load(): Promise<void>;
  refresh(): Promise<void>;
  offlineSnapshot(): Promise<void>;
  revalidate(): Promise<void>;
  recover(): Promise<void>;
  explain(): Promise<HabitsExplainabilityDTO>;
}

export interface EntitlementService {
  load(): Promise<void>;
  refresh(): Promise<void>;
  offlineSnapshot(): Promise<void>;
  revalidate(): Promise<void>;
  recover(): Promise<void>;
  explain(): Promise<PaywallExplainabilityDTO>;
}
