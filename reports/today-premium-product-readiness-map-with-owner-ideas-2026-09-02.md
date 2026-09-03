# Today Premium Product Readiness Map With Owner Ideas

- Date: 2026-09-02
- Branch: `master`
- HEAD: `51e8a5e today premium owner ideas hybrid architecture review`
- Target package: `TODAY_PREMIUM_PRODUCT_READINESS_MAP_WITH_OWNER_IDEAS`
- Verdict: **TODAY_PREMIUM_PRODUCT_READINESS_MAP_WITH_OWNER_IDEAS_READY**

## Scope

Prepare a Product Readiness Map for Premium Today / `Мой Поток` using the owner ideas hybrid architecture review and the current RLS/read-only status.

This is report-only planning. No runtime code was changed, no UI was changed, no config/dependency files were changed, no API clients were added, no external provider was connected, no Python/FastAPI/Redis/Celery architecture was added, no tables were created, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no real table reads or network calls were made, no secrets/API keys/JWTs were collected, and no PR was created.

## Sources Reviewed

- `reports/today-premium-owner-ideas-hybrid-architecture-review-2026-09-02.md`
- `reports/today-premium-rls-blocker-reentry-status-2026-08-31.md`
- `reports/today-premium-read-only-ux-polish-final-status-2026-08-30.md`

## 1. Current Premium Status

Already ready:

- Premium read-only runtime surfaces exist for `/today` and `/premium-recipes`.
- Paywall and Home card copy are clearer about demo/read-only expectations.
- `/today` has loading, fallback, empty-state, local-only replacement, and local-only shopping clarity.
- `/premium-recipes` has loading, fallback, empty-state, and disabled action clarity.
- Premium recipes are separated from free `/nutrition/recipes`.
- Free diaries, workouts, measurements, and Progress remain available.
- Source tests and reports cover no-write/copy/state contracts for the current read-only scope.

Read-only/demo only:

- `Мой Поток` / `/today` is a read-only/demo Premium experience.
- Premium recipe actions are preview/no-write.
- Replacement apply is local-only.
- Shopping marks are local-only.
- Demo access is local browser state.
- Subscription-style Paywall actions remain disabled.

Blocked:

- Premium user selection writes.
- Premium meal selection persistence.
- Shopping persistence.
- Diary writes from Premium.
- Payment enforcement.
- Entitlement mutation.
- Production rollout.
- Behavioral RLS execution.
- Live provider API runtime.

Pending:

- owner visual acceptance/pass-fail notes;
- secure env/JWT/test-user readiness for behavioral RLS;
- payment/entitlement plan;
- production content readiness;
- provider licensing/cache/commercial-use verification;
- final paid MVP scope decision for training.

## 2. Paid MVP Definition

Minimal sellable Premium v1 should be a guided execution system, not a loose collection of screens.

Paid MVP includes:

- Today / `Мой Поток` as the daily Premium home;
- 14-day plan structure;
- Premium recipes as subscription content;
- recipe/meal replacements;
- shopping list generated from the plan;
- honest no-write or write-enabled behavior depending on RLS/payment readiness at launch;
- no AI promises;
- no voice promises;
- no human coach promise unless staffed and operationally supported.

Training decision:

- Recommended MVP default: training is visible as part of the long-term Premium value but questionnaire-driven personalized training ships after the core nutrition/recipe/shopping Premium loop.
- Alternative if owner insists training is MVP: include only a reviewed training questionnaire plan/spec and static reviewed training content, not adaptive writes or unsafe recommendations.

MVP quality bar:

- users understand what is included;
- payment state and entitlement state are honest;
- Premium writes are RLS-proven before enabled;
- all Premium content shown in runtime is owner-approved;
- external provider content is not live-fed into user plans without normalization and review.

## 3. Implementation Queues

### A. Paid MVP Required

- Behavioral RLS tests with real staging actor contexts.
- Secure env readiness for staging-only RLS preflight.
- Payment/entitlement plan before enforcement.
- Owner visual acceptance or owner pass/fail notes resolved.
- Owner-approved Premium catalog for plans, days, meals, recipes, ingredients, steps, hints, replacements, and shopping derivation.
- Final Paywall wording for real paid state.
- Clear launch definition: read-only demo, paid read-only, or paid write-enabled.
- Production rollout approval after readiness gates pass.

### B. Safe Implementation Before Premium Writes

- Food diary multi-add flow planning.
- Progress / `Цель дня` configuration planning.
- Daily consumed/burned balance planning.
- Workout calories estimate research/spec only.
- Exercise catalog tag schema planning.
- Training questionnaire UX/content spec.
- Premium content pipeline/reporting spec.
- Owner demo result retry/report if pass/fail notes become available.

These are safe before Premium writes when kept as reports/specs or scoped UI/UX changes that do not create Premium persistence, payment, provider API runtime, SQL, or staging/prod mutation.

### C. Fixed Task Queue Outside Premium

- Add multiple foods to diary in one save flow.
- Add missing product through calorie counter.
- Progress daily balance: consumed and burned.
- Steps research: manual vs automatic tracking.
- Approximate workout calorie calculation.
- Configurable `Цель дня`.
- Admin users and usage frequency.
- Training schedule so workouts are not assumed every day.
- MuscleMap expansion if the exercise catalog expands.
- Exercise images and media sourcing.

These are important for POTOK but should not be mixed into Premium launch gates.

### D. Later / V2

- `Мои рецепты` as Premium replacement source.
- Recipe module assembly algorithm.
- Portion scaling and unit conversion hardening.
- Weekly/14-day adaptation.
- Local exercise catalog with replacement logic.
- Premium training questionnaire implementation.
- Telegram bot acquisition/sales experiments.
- Admin analytics beyond basic usage frequency.

### E. Not Now / Risky

- Live API runtime for Edarix, FatSecret, Open Food Facts, ExerciseDB, or similar providers.
- Raw external provider data written directly into plans.
- Python/FastAPI/Redis/Celery architecture migration.
- Payment enforcement before entitlement plan.
- Premium writes before RLS execution.
- Production rollout before RLS/payment/owner acceptance.
- Ads before compliance, privacy, and UX plan.
- AI/voice runtime promises.
- Human coach promise without operations.

## 4. First Implementation Candidates

Candidate 1: Food diary multi-add flow plan.

- Why start here: it fixes a known free-product friction point without touching Premium writes.
- User value: users can select several foods, set weights, and save once.
- Dependencies: current diary add flow review and validation rules.
- Risk: medium; batching can create validation and undo complexity.
- Why not blocked: can start as report/spec and later scoped free diary UX; does not depend on Premium RLS, payment, provider APIs, or production rollout.

Candidate 2: Configurable `Цель дня` planning.

- Why start here: owner explicitly noted that not all users train or count calories.
- User value: Progress becomes more personal and less noisy.
- Dependencies: Progress settings model/spec and display rules.
- Risk: medium; too many options can confuse users.
- Why not blocked: can be planned without Premium writes, RLS, payment, or external APIs.

Candidate 3: Daily consumed/burned balance spec.

- Why start here: aligns nutrition, workouts, and Progress into a clearer daily loop.
- User value: users see what they consumed and approximately burned.
- Dependencies: calorie intake source, workout burn estimate assumptions, and copy disclaimers.
- Risk: medium-high; burn estimates must not imply medical precision.
- Why not blocked: can begin as a report/spec using existing product model and no real table reads.

Candidate 4: Exercise catalog tag taxonomy spec.

- Why start here: gives structure before importing or expanding exercise data.
- User value: future exercise filtering can support difficulty, equipment, axial load, jumps, running, and low-impact needs.
- Dependencies: owner-approved taxonomy and MuscleMap implications.
- Risk: medium; taxonomy drift can make data hard to maintain.
- Why not blocked: spec-only work does not require RLS, payment, provider API licensing, or SQL.

Candidate 5: Premium content pipeline spec.

- Why start here: prevents live API/provider raw data from leaking into runtime plans.
- User value: safer, more consistent Premium content.
- Dependencies: owner review workflow and normalized content contract.
- Risk: medium; content ops can be slow.
- Why not blocked: report-only/spec work is independent of Premium writes and provider API integration.

## 5. Blocked Items

Blocked until RLS behavior tests:

- `user_premium_plan_selections` writes;
- `user_premium_meal_selections` writes;
- persisted Premium replacements;
- persisted Premium shopping checks;
- any user-owned Premium table reads/writes beyond approved test scope;
- paid write-enabled Premium launch.

Blocked until payment/entitlement plan:

- payment enforcement;
- real checkout;
- subscription management;
- purchase restore;
- entitlement mutation;
- paid-state copy that implies verified subscription;
- paid production launch.

Blocked until provider licensing verification:

- Edarix integration;
- FatSecret integration;
- Open Food Facts integration;
- ExerciseDB or dataset import;
- storing/caching provider data;
- commercial use of provider content;
- provider-derived exercise images.

Blocked until owner visual acceptance:

- declaring Premium UX owner-accepted;
- using the current Premium UX as final launch UX;
- skipping visual/copy polish decisions after owner demo.

Blocked until production rollout approval:

- production Premium catalog queries;
- production Premium writes;
- production payment enforcement;
- production entitlement changes;
- public launch communications.

## 6. Recommended First Implementation Package

Recommended first package:

- **FOOD_DIARY_MULTI_ADD_FLOW_PLAN_READY**

Why this first:

- it is valuable outside Premium;
- it addresses a concrete owner pain point;
- it improves daily retention and diary ergonomics;
- it can be planned without RLS behavior tests;
- it does not require payment, entitlement, provider APIs, SQL, staging mutation, production rollout, or Premium writes.

Suggested package scope:

- report-only plan for current diary add flow;
- propose multi-select -> weight entry -> review -> save flow;
- define validation and error states;
- define what remains unchanged;
- identify tests needed for a later implementation;
- keep actual implementation separate.

## 7. Roadmap

Phase 1: safe UX/data improvements.

- Food diary multi-add flow plan, then scoped implementation.
- Configurable `Цель дня` plan.
- Daily consumed/burned balance spec.
- Exercise taxonomy spec.
- Premium content pipeline spec.

Phase 2: Premium readiness blockers.

- Collect owner demo pass/fail notes.
- Prepare secure staging env locally.
- Rerun env-only RLS preflight.
- Run behavioral RLS tests only after readiness and approval.
- Prepare payment/entitlement plan.

Phase 3: Premium writes.

- Enable only the smallest RLS-proven Premium write path first.
- Add selection persistence with tests and rollback plan.
- Keep diary writes, recipe import, and shopping persistence separate.

Phase 4: payment/entitlement.

- Implement entitlement contract.
- Add checkout/subscription behavior only after payment plan approval.
- Update Paywall/Premium entry copy for real paid state.

Phase 5: production rollout.

- Confirm production content readiness.
- Confirm RLS/payment/owner acceptance gates.
- Roll out gradually with monitoring and owner approval.

Phase 6: API ingestion / Telegram / ads / AI later.

- Verify provider licensing and cache rules.
- Build ingestion/review pipeline before runtime use.
- Pilot Telegram bot as acquisition/sales channel.
- Research ads with privacy and UX review.
- Keep AI/voice as future vision until product, safety, and cost plans exist.

## Final Recommendation

Do not implement Premium writes, payment enforcement, live provider runtime, Telegram payments, ads, AI, voice, or production rollout next.

The safest next step is to plan a fixed-task improvement that helps the free product and does not depend on blocked Premium infrastructure:

- **FOOD_DIARY_MULTI_ADD_FLOW_PLAN_READY**

In parallel, the owner can provide manual Premium demo pass/fail notes, and the secure staging env can be prepared for RLS preflight.

## Safety Confirmation

Confirmed for this package:

- report-only;
- no runtime code changes;
- no UI changes;
- no config/dependency changes;
- no API clients added;
- no Edarix/FatSecret/Open Food Facts/ExerciseDB connection;
- no Python/FastAPI/Redis/Celery architecture added;
- no tables created;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no RLS behavior tests;
- no real table reads;
- no network calls;
- no secrets/API keys/JWT collection;
- no service-role keys;
- no RLS policy changes;
- no user Premium selections writes;
- no diary/workout writes;
- no `public.recipes` writes;
- no recipe import;
- no shopping persistence;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**TODAY_PREMIUM_PRODUCT_READINESS_MAP_WITH_OWNER_IDEAS_READY**
