import type { NutritionValues } from './adaptiveNutrition';

/** Future server read-model contract, not a database schema or client authority. */
export interface NutritionRevisionContext {
  accountId: string;
  planId: string;
  planRevision: string;
  goalRevision: string;
  weekAnchor: string;
  timeZone: string;
}

export interface NutritionSnapshotRevision {
  snapshotRevision: string;
  recipeRevision: string | null;
  portionRevision: string;
}

/** Values describe the explicit amount consumed/planned, not per-100g values. */
export interface NutritionPortionSnapshot extends NutritionSnapshotRevision {
  recipeId: string | null;
  servings: number;
  foods: Array<{
    foodRef: string;
    name: string;
    amount: number;
    unit: 'g' | 'ml';
    state: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
    nutrition: NutritionValues;
  }>;
}

export interface NutritionDatedSlot {
  date: string;
  slotId: string;
  snapshot: NutritionPortionSnapshot;
}

export interface NutritionPlanReadModel {
  context: NutritionRevisionContext;
  status: 'active' | 'provisional';
  slots: NutritionDatedSlot[];
}

export type NutritionMealAction = 'CONSUMED_AS_PLANNED' | 'CONSUMED_MODIFIED' | 'SKIPPED' | 'EXTRA_FOOD';

export interface NutritionMutationEnvelope {
  expected: NutritionRevisionContext;
  idempotencyKey: string;
  /** Simulation ordering only. Never send this as an authoritative server revision. */
  expectedLocalSequence: number;
}

type PlannedMealIdentity = { date: string; slotId: string; expectedSnapshot: NutritionSnapshotRevision };
export type NutritionDomainCommand = NutritionMutationEnvelope & (
  | ({ type: 'MEAL'; action: 'CONSUMED_AS_PLANNED' | 'SKIPPED'; actual?: never } & PlannedMealIdentity)
  | ({ type: 'MEAL'; action: 'CONSUMED_MODIFIED'; actual: NutritionPortionSnapshot } & PlannedMealIdentity)
  | { type: 'MEAL'; action: 'EXTRA_FOOD'; date: string; slotId: null; actual: NutritionPortionSnapshot }
  | ({ type: 'REPLACE'; replacement: NutritionPortionSnapshot } & PlannedMealIdentity)
  | { type: 'UNDO_ANNOTATION'; targetEventId: string }
  | { type: 'REVISE_FACT'; targetEventId: string; operation: 'EDIT'; actual: NutritionPortionSnapshot }
  | { type: 'REVISE_FACT'; targetEventId: string; operation: 'UNDO'; actual?: never }
);

/** Describes a future effect in local simulation; it is never a persisted diary row. */
export type NutritionSimulatedEffect =
  | { kind: 'diary-snapshot'; date: string; slotId: string | null; snapshot: NutritionPortionSnapshot; supersedes: string | null }
  | { kind: 'skip-annotation'; date: string; slotId: string }
  | { kind: 'plan-replacement'; date: string; slotId: string; before: NutritionPortionSnapshot; after: NutritionPortionSnapshot }
  | { kind: 'fact-retraction'; date: string; slotId: string | null; supersedes: string }
  | { kind: 'annotation-retraction'; date: string; slotId: string; supersedes: string };

export interface NutritionSimulationEvent {
  eventId: string;
  commandFingerprint: string;
  command: NutritionDomainCommand;
  effect: NutritionSimulatedEffect;
}

export interface NutritionSimulationState {
  mode: 'local-simulation';
  networkWritesEnabled: false;
  graph: NutritionPlanReadModel;
  /** Includes every confirmed local command; conservative conflict detection. */
  localSequence: number;
  /** Advances only for simulated PLAN mutation; original server revision is preserved. */
  localPlanSequence: number;
  history: NutritionSimulationEvent[];
  pending: null | {
    stage: 'proposed' | 'previewed';
    command: NutritionDomainCommand;
    fingerprint: string;
    effect: NutritionSimulatedEffect;
  };
}
