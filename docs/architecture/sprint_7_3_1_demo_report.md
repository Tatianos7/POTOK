# Sprint 7.3.1 — UX Runtime & User Journey Demo Report

## Live Run (user_id: 286bd239-d3f3-434a-96ce-46d0b1fe2c70)
Program: `b2c15cd8-6a3e-46ef-b7ca-345489283a34`

## API / DTO Checks
- `getToday` (`get_program_day_details`) returns day + session + explainability.
- `getMyProgram` (`get_program_days`) returns 14 days (deduped latest).
- `getPhaseTimeline` (`get_program_phases`) returns 26 phases.
- `getWhy` (`get_program_explainability`) returns v4 entries.

## Runtime Transitions
- `program_sessions` updated to `completed → skipped` for today.
- `adherenceRate` computed from sessions: 0% (today skipped).
- `program_feedback` created and linked to program.
- `program_versions` advanced to 25 with `feedback_replan`.
- `program_adaptations` recorded trigger `fatigue_spike`.
- `program_explainability` recorded `why_lowered_intensity` for feedback.

## Evidence (samples)
**Day details**
```json
{
  "day": {
    "date": "2026-01-21",
    "targets": { "calories": 1440, "protein": 96, "fat": 48, "carbs": 176 },
    "block_type": "deload",
    "phase_type": "build"
  },
  "session": {
    "status": "skipped",
    "plan_payload": { "reason": "fatigue" }
  }
}
```

**Explainability v4 (why_lowered_intensity)**
```json
{
  "decision_ref": "why_lowered_intensity",
  "guard_notes": {
    "reason_code": "feedback_replan",
    "diff_summary": { "note": "feedback-driven adjustment" },
    "safety_notes": { "fatigue_spike": true }
  }
}
```

**Feedback**
```json
{
  "energy": 2,
  "hunger": 4,
  "difficulty": 4,
  "motivation": 3
}
```

## E2E 111–120
PASS

## Verdict
Sprint 7.3.1 = Production Ready
