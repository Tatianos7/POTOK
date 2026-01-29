type CoachMetricName =
  | 'coach_response_time'
  | 'explainability_latency'
  | 'memory_fetch_time'
  | 'trust_update_time'
  | 'memory_hits';

const budgets: Partial<Record<CoachMetricName, number>> = {
  coach_response_time: 400,
  memory_fetch_time: 150,
  explainability_latency: 200,
  trust_update_time: 120,
};

export const coachTelemetry = {
  trackTiming: (name: CoachMetricName, durationMs: number, meta: Record<string, unknown> = {}) => {
    const budget = budgets[name];
    if (budget && durationMs > budget) {
      console.warn('[coachTelemetry] budget_exceeded', { name, durationMs, budget, ...meta });
      return;
    }
    console.debug('[coachTelemetry] timing', { name, durationMs, ...meta });
  },
  increment: (name: CoachMetricName, value = 1, meta: Record<string, unknown> = {}) => {
    console.debug('[coachTelemetry] counter', { name, value, ...meta });
  },
};
