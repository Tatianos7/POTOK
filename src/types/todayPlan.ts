export type TodayPlanSource = 'smart_day' | 'ai' | 'purchased_plan' | 'coach';

export type TodayDayState = 'low_energy' | 'normal' | 'ready';

export type TodayItemType = 'meal' | 'workout' | 'water' | 'steps' | 'habit' | 'task';

export type TodayItemStatus = 'planned' | 'done' | 'skipped' | 'replaced' | 'not_suitable';

export type TodayNotSuitableReason =
  | 'no_products'
  | 'dislike'
  | 'no_time_to_cook'
  | 'eating_out'
  | 'portion_not_suitable'
  | 'no_equipment'
  | 'no_time'
  | 'too_hard'
  | 'pain_or_discomfort'
  | 'other';

export interface TodayItem {
  id: string;
  planId: string;
  source: TodayPlanSource;
  type: TodayItemType;
  title: string;
  subtitle?: string;
  note?: string;
  actionLabel?: string;
  status: TodayItemStatus;
  notSuitableReason?: TodayNotSuitableReason;
}

export interface TodayPlan {
  id: string;
  source: TodayPlanSource;
  title: string;
  date: string;
  status: 'active' | 'completed' | 'partially_completed' | 'skipped';
  dayState?: TodayDayState;
  demoProgramId?: string;
  demoDayIndex?: number;
  items: TodayItem[];
  createdAt: string;
  updatedAt: string;
}
