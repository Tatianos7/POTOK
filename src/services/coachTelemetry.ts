type CoachMetricName =
  | 'coach_response_time'
  | 'coach_overlay_time'
  | 'explainability_latency'
  | 'memory_fetch_time'
  | 'trust_update_time'
  | 'coach_overlay_shown'
  | 'coach_response_generated'
  | 'coach_memory_hit'
  | 'coach_memory_miss'
  | 'coach_explainability_opened'
  | 'coach_user_ignored'
  | 'coach_user_requested'
  | 'coach_decision_support_used'
  | 'coach_error'
  | 'coach_timeout'
  | 'coach_fallback_used';

const budgets: Partial<Record<CoachMetricName, number>> = {
  coach_response_time: 300,
  coach_overlay_time: 50,
  memory_fetch_time: 150,
  explainability_latency: 200,
  trust_update_time: 120,
};

const sanitizeMeta = (meta: Record<string, unknown>) => {
  const sanitized: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower.includes('user') || lower.includes('email') || lower.includes('phone') || lower.includes('name')) {
      return;
    }
    sanitized[key] = value;
  });
  return sanitized;
};

export const coachTelemetry = {
  trackTiming: (name: CoachMetricName, durationMs: number, meta: Record<string, unknown> = {}) => {
    const budget = budgets[name];
    const payload = { name, durationMs, ...sanitizeMeta(meta) };
    if (budget && durationMs > budget) {
      console.warn('[coachTelemetry] budget_exceeded', { ...payload, budget });
      return;
    }
    console.debug('[coachTelemetry] timing', payload);
  },
  increment: (name: CoachMetricName, value = 1, meta: Record<string, unknown> = {}) => {
    console.debug('[coachTelemetry] counter', { name, value, ...sanitizeMeta(meta) });
  },
};
