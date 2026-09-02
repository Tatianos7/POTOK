# Today Premium Owner Ideas Hybrid Architecture Review

- Date: 2026-09-02
- Branch: `master`
- HEAD: `fb6574f today premium rls blocker reentry status`
- Target package: `TODAY_PREMIUM_OWNER_IDEAS_HYBRID_ARCHITECTURE_REVIEW`
- Verdict: **TODAY_PREMIUM_OWNER_IDEAS_HYBRID_ARCHITECTURE_REVIEW_READY**

## Scope

Analyze owner ideas for Premium Today / `Мой Поток`, hybrid recipe/food/exercise architecture, free/premium separation, Telegram acquisition, monetization, and future POTOK tasks.

This is product analysis and future task shaping only. No runtime code was changed, no UI was changed, no API client was added, no external provider was connected, no Python/FastAPI/Redis/Celery architecture was added, no tables were created, no config/dependency files were changed, no Supabase SQL was executed, no staging mutation occurred, production was not touched, no RLS behavior tests were run, no real table reads or network calls were made, no secrets/API keys/JWTs were collected, and no PR was created.

## Source Summary

Premium Today / `Мой Поток`:

- Owner ideas point toward `Мой Поток` as a guided daily system, not just a static paid page.
- The valuable shape is a 14-day or weekly Premium plan with nutrition, recipes, replacements, shopping, and optionally training.
- Current read-only UX already clarifies local-only demo behavior, disabled writes, loading/fallback states, and Premium entry copy.
- Future Premium must not enable writes or production rollout until RLS and payment/entitlement boundaries are ready.

Nutrition:

- Nutrition should combine ready plans, diary tracking, daily balance, user choice in Progress, and a better flow for adding food.
- The owner wants day-level progress for consumed and burned calories.
- The owner also wants honest treatment of training days: workouts should not be assumed every day.

Recipes:

- Premium recipes should be part of the subscription.
- Recipe collections can also be sold separately through a Telegram bot as an acquisition channel.
- Future `Мои рецепты` should allow users to replace a planned dish with their own recipe if it fits KBJU.
- Recipe modules can reduce manual plan creation by letting POTOK assemble plans from reviewed recipe building blocks.

Food database:

- The hybrid idea is to use external sources such as Edarix, FatSecret, and Open Food Facts for data acquisition or enrichment, then normalize into POTOK's own catalog.
- Runtime should use a reviewed internal catalog, not direct live API responses.
- API availability, licensing, cache rules, pricing, and commercial use must be verified before any integration.

Food diary:

- Current one-by-one food addition is not ergonomic.
- Suggested future flow: select multiple products first, then enter weights for each, then save once.
- The calorie counter should support adding a product that is not present in the database.

Training:

- Free training should include a richer exercise base, exercise difficulty, load warnings, and safer alternatives.
- Premium training can use a questionnaire to choose training goals, experience, time, equipment, limitations, injuries, and weekly schedule.
- The app should warn users not to overstate experience because that can worsen condition.

Exercise database:

- ExerciseDB or similar datasets are candidate sources, but licenses and commercial use must be verified.
- POTOK should keep a local exercise catalog with normalized tags and owner-approved content.
- Useful tags include `difficulty`, `equipment`, `no_axial`, `no_jump`, `no_run`, `low_impact`, `rehab_friendly`, `contraindications`, `replacement_exercise_ids`, `target_muscles`, `secondary_muscles`, `duration`, `rest`, and later estimated-calories logic.

MuscleMap / exercise images:

- Expanding the exercise base may require expanding MuscleMap coverage.
- New muscles, secondary muscles, and exercise images should be planned as content/design work, not hidden inside Premium launch.
- Exercise images have data-quality, copyright, and production-readiness implications.

Progress / `Цель дня`:

- The owner wants daily progress for consumed and burned calories.
- Users should choose what appears in `Цель дня`, because not all users train and not all users count calories.
- Progress should not automatically count workouts every day unless the user has a training schedule or another honest mechanism.

Steps / calories burned:

- Steps can be manual or automatic, but device/Health API options require separate research.
- Workout calories can be estimated approximately, but the method must be framed as an estimate, not medical precision.

Admin / user analytics:

- Admin should later show users and POTOK usage frequency.
- This is useful for product decisions, retention, support, and funnel analysis.
- It should be treated as a separate analytics/admin package with privacy review.

Telegram bot:

- Free bot idea: workout logging plus a button to download POTOK.
- Paid bot idea: recipe/diet collections plus a button to download POTOK.
- Bot can be an acquisition and sales channel, but core product state should remain in the app unless a sync strategy is designed.

Advertising:

- Free tier may include ads.
- Paid tier should be ad-free.
- Ads need UX, compliance, analytics, and store-policy review before implementation.

Paywall / Premium entry:

- Suggested copy direction:
  - not paid: `Хочу быть в ПОТОКЕ`;
  - paid: `Я в потоке`.
- This should wait for a payment/entitlement wording pass so copy does not imply active payment before payment enforcement exists.

Free vs Premium:

- Free should remain useful: diaries, Progress, basic tools, basic recipes/exercises, manual input.
- Premium should feel like a guided execution system: plans, recipes, shopping, replacements, questionnaire-driven training, and no ads.
- Demo access can remain limited/local until entitlement and payment are ready.

Risks:

- Main risks are API licensing, cache/storable rules, data quality, health safety, privacy, payment compliance, scope creep, runtime complexity, and false user expectations.

## Valuable Ideas For POTOK

Most valuable ideas:

- hybrid model: external sources for ingestion/enrichment plus POTOK-owned normalized runtime catalog;
- owner-approved Premium catalog instead of direct live API output;
- recipe modules instead of manually authoring every full plan;
- plan assembly algorithm from reviewed dishes;
- portion scaling;
- shopping list aggregation;
- multiple-food diary add flow with one save action;
- local exercise database with tags;
- exercise filtering by `no_axial`, `no_jump`, `no_run`, and `low_impact`;
- exercise difficulty level;
- Premium training questionnaire;
- approximate workout calorie estimate;
- configurable `Цель дня` in Progress;
- Telegram bot as acquisition/sales channel;
- Premium recipes as both subscription value and a separate bot-sold product.

## Ideas That Need Verification

VERIFY_REQUIRED:

- Edarix API actuality and availability;
- FatSecret API terms;
- Open Food Facts terms;
- ExerciseDB and alternative dataset licenses;
- commercial usage rights;
- cache and storable-data rules;
- API limits and pricing;
- legal and privacy requirements;
- advertising in the free tier;
- Telegram bot payments and compliance;
- step tracking through device/Health APIs;
- correctness and acceptable framing of calories-burned estimates.

No web research was performed in this report.

## Fit With Current POTOK Architecture

Current fit:

- POTOK already uses Supabase/PostgreSQL.
- Premium read-only runtime is prepared.
- Premium data model exists on staging.
- Premium writes are still disabled.
- Payment enforcement is still disabled.
- Production rollout is still blocked.
- Behavioral RLS tests are pending because secure env/JWT/test users are not ready.
- Owner visual acceptance is pending because owner pass/fail notes were not supplied.

Architecture guidance:

- Adapt owner ideas to the existing POTOK architecture instead of replacing it.
- Do not move the project to Python/FastAPI/Redis/Celery without a separate architecture decision.
- Use external APIs later as ingestion/import sources, not as live runtime dependencies for user-facing plan generation.
- Keep runtime content in POTOK-owned tables after normalization, review, and approval.
- Keep write paths disabled until behavioral RLS and entitlement/payment plans are ready.

## Free Vs Premium Split

Option A: Free tools, Premium guided system.

Free:

- diaries;
- Progress;
- basic recipes and exercises;
- manual food/training input.

Premium:

- Today plan;
- ready nutrition/training plans;
- Premium recipes;
- shopping list;
- replacements;
- training by questionnaire;
- 14-day system.

Pros:

- easy to explain;
- keeps free product useful;
- Premium value is clear and bundled.

Cons:

- Premium content must be strong enough to justify payment;
- more content operations are required.

Business impact:

- good subscription positioning;
- easier Paywall story.

UX impact:

- clear separation between tools and done-for-you guidance.

Technical risk:

- medium, because plan/replacement/shopping writes still need RLS and data quality.

Recommendation:

- strongest default direction for paid MVP once RLS/payment blockers are cleared.

Option B: Free manual tracking plus limited Premium demo.

Free:

- manual tracking;
- limited Premium demo;
- basic view into Premium value.

Premium:

- personal plan;
- shopping;
- replacements;
- weekly/14-day adaptation;
- `Мои рецепты` as replacement options.

Pros:

- aligns with current read-only demo model;
- lets users understand Premium before purchase.

Cons:

- demo can blur expectations if not carefully worded;
- personalization requires strong data model and RLS.

Business impact:

- good conversion path if demo feels valuable.

UX impact:

- lower friction, but needs very honest copy.

Technical risk:

- medium-high after writes/personalization are enabled.

Recommendation:

- best bridge from current state to paid MVP.

Option C: Free tools plus ads, Premium execution without ads.

Free:

- tools;
- manual tracking;
- ads.

Premium:

- done-for-you execution system;
- no ads.

Pros:

- creates monetization even before some users subscribe;
- ad-free Premium is easy to understand.

Cons:

- ads can damage trust in a health/fitness app;
- ads add compliance, SDK, privacy, and UX burden.

Business impact:

- possible upside, but risks brand quality.

UX impact:

- free UX may feel noisier.

Technical risk:

- high until privacy/store-policy/ad-provider plan exists.

Recommendation:

- not for immediate paid MVP; keep as later monetization research.

## MVP Classification

Must have for Paid MVP:

- behavioral RLS tests passed with secure staging env;
- payment/entitlement plan before enforcement;
- owner visual acceptance or owner notes resolved;
- Premium read-only UX preserved until writes are approved;
- owner-approved Premium catalog;
- clear Paywall/Premium entry copy;
- no-write boundaries for disabled actions until RLS is proven;
- basic 14-day plan structure;
- Premium recipes and shopping/replacement concepts based on reviewed catalog data.

Should have soon:

- multiple-food diary add flow;
- user-created food in calorie counter;
- configurable Progress / `Цель дня`;
- daily consumed/burned balance;
- workout calories estimate as an approximate value;
- local exercise catalog tags for difficulty and limitations;
- training questionnaire draft for Premium.

Later / v2:

- `Мои рецепты` as Premium replacement source;
- recipe module assembly algorithm;
- automated portion scaling and unit conversion hardening;
- weekly/14-day adaptation;
- Telegram bot paid recipe collections;
- free workout logging bot;
- expanded admin usage analytics.

Future vision:

- external API ingestion pipeline with review workflow;
- richer exercise dataset with images and MuscleMap expansion;
- device/Health API step tracking;
- ads in free tier with paid ad-free experience;
- deeper personalization across nutrition, training, Progress, and recovery constraints.

Not now / risky:

- live API runtime for recipes/foods/exercises;
- direct provider raw data in user plans without review;
- Python/FastAPI/Redis/Celery migration;
- payment enforcement before entitlement plan;
- Premium writes before RLS execution;
- production rollout before RLS/payment/owner acceptance;
- AI/voice runtime promises;
- ads before compliance and UX plan.

Fixed task queue outside Premium:

- multi-add food diary flow;
- missing-food/product creation in calorie counter;
- Progress daily consumed/burned balance;
- steps manual vs automatic research;
- workout calorie estimate;
- configurable `Цель дня`;
- admin users and usage frequency;
- training schedule so workouts are not counted every day;
- MuscleMap expansion;
- exercise images.

## Fixed Task Queue Outside Premium

| Task | Block | Why Important | Dependency | Risk | Suggested Priority |
| --- | --- | --- | --- | --- | --- |
| Add multiple foods to diary in one flow | Food diary | Reduces repetitive logging friction | Existing diary save flow review | Medium: batch UX and validation | High |
| Add missing product through calorie counter | Food database / diary | Prevents dead ends when food is absent | Food catalog normalization rules | Medium: data quality and moderation | High |
| Daily consumed/burned balance | Progress | Makes Progress more useful day to day | Calories intake + burn estimate model | Medium: misleading precision | High |
| Steps: manual vs automatic research | Progress / activity | Helps decide honest activity tracking | Device/Health API verification | Medium-high: privacy/platform permissions | Medium |
| Workout calories estimate | Training / Progress | Connects workouts to daily balance | Exercise metadata and user body context | Medium-high: accuracy expectations | Medium |
| Configurable `Цель дня` | Progress | Fits users who do not train or count calories | Progress settings model | Medium: settings complexity | High |
| Admin users and usage frequency | Admin / analytics | Supports product decisions and retention insight | Privacy-safe analytics design | Medium-high: privacy and access control | Medium |
| Do not count workouts every day without schedule | Training / Progress | Avoids dishonest daily goals | Training schedule or user intent input | Medium | High |
| MuscleMap expansion | Training / visualization | Needed if exercise catalog grows | Muscle taxonomy and design assets | Medium: asset scope | Medium |
| Exercise images | Training content | Improves exercise comprehension | Licensed/owned image source | High: copyright and quality | Medium |

## Proposed Premium Data / Content Strategy

Recommended strategy:

- start with owner-approved Premium catalog, not live API output;
- use external APIs later only as ingestion/import sources;
- normalize every imported food/recipe/exercise into POTOK-owned structures;
- review every recipe before it appears in Premium runtime;
- let runtime return only checked content;
- do not write raw external provider data directly into user plans without review;
- store exercises locally/in POTOK database rather than depending on live exercise APIs;
- keep provider-specific raw data outside the user-facing source of truth unless licensing explicitly allows storage and review.

Exercise fields/tags to plan:

- `difficulty`;
- `equipment`;
- `no_axial`;
- `no_jump`;
- `no_run`;
- `low_impact`;
- `rehab_friendly`;
- `contraindications`;
- `replacement_exercise_ids`;
- `target_muscles`;
- `secondary_muscles`;
- `duration`;
- `rest`;
- `estimated_calories` logic later.

## Training Architecture Ideas

Free exercise base:

- include exercise difficulty;
- include load/safety warnings;
- include axial-load notes;
- include safer alternatives when spinal load, jumps, or running are unsuitable;
- keep wording careful and non-medical unless reviewed.

Premium training questionnaire:

- training goal;
- experience level;
- warning not to overstate experience;
- time available per workout;
- equipment available;
- limitations/injuries;
- weekly schedule;
- user preference for training frequency.

No daily workout assumption:

- Progress should not assume training every day.
- User should either set training days or POTOK should use a transparent schedule model.

Workout calories estimate:

- start as approximate;
- avoid medical precision claims;
- require exercise type, duration, intensity, and user profile assumptions;
- classify as VERIFY_REQUIRED before production use.

Replacement exercises:

- use tags such as `no_axial`, `no_jump`, `no_run`, `low_impact`, limitations, target muscles, and equipment.
- make replacements explicit and owner-reviewed.

MuscleMap implications:

- expanding exercise catalog may require more muscles and muscle groups;
- target and secondary muscle tags should match MuscleMap taxonomy;
- design/content work should be planned separately from Premium launch.

Exercise image implications:

- images need ownership/license clarity;
- images should be normalized by exercise and variant;
- low-quality or unlicensed images should not enter production content.

## Nutrition / Recipe Architecture Ideas

Hybrid food database:

- use external sources for discovery/enrichment;
- store normalized foods in POTOK-owned catalog;
- keep user-facing runtime stable and reviewed.

External APIs as import source:

- Edarix, FatSecret, Open Food Facts, and similar sources need licensing, cache, commercial-use, limits, and pricing verification.
- Do not connect them in runtime until verification and ingestion design are complete.

Own normalized food catalog:

- maintain stable IDs;
- normalize units, grams, calories, macros, common aliases, and data provenance;
- review conflicts before production use.

User-created food:

- allow user to add missing products later;
- separate personal/user-created foods from owner-approved catalog foods;
- avoid polluting global catalog without moderation.

Multi-add diary flow:

- select multiple products;
- enter weight per product;
- save once;
- validate each item before committing.

Premium `Мои рецепты`:

- user can propose or save a recipe;
- recipe can be used as a replacement only if KBJU fits the target slot;
- should wait until Premium writes/RLS are ready.

Recipe replacements by KBJU:

- replacement should compare calories, protein, fat, carbs, meal type, and possibly ingredients/equipment/time.
- current local-only replacement behavior should remain until persistence is approved.

Shopping list aggregation:

- aggregate ingredients from selected plan/day;
- normalize units and duplicates;
- keep shopping marks local-only until persistence is approved.

Portion scaling:

- useful for personalizing recipes and shopping quantities;
- depends on reliable base grams, serving size, and unit conversion.

Unit conversion risk:

- high data-quality risk;
- needs review for spoons/cups/pieces, cooked vs raw weights, and localized product units.

## Telegram Bot Strategy

Free bot option:

- workout logging;
- simple training habit loop;
- app download CTA;
- lightweight acquisition channel.

Paid bot product option:

- recipe collections;
- diet collections;
- separate product purchase;
- CTA to download POTOK for the fuller experience.

What should stay in app:

- account state;
- Premium entitlement;
- detailed diary/progress;
- personalized Today flow;
- reviewed catalog runtime;
- long-term user data.

What can live in bot:

- lightweight acquisition;
- simple workout logging;
- product previews;
- recipe/diet collection sales;
- reminders or onboarding prompts after compliance review.

Risks:

- duplicated logic;
- payment/support/moderation overhead;
- data sync complexity;
- privacy and account linking;
- inconsistent Premium expectations between bot and app.

Recommendation for MVP:

- do not block Premium MVP on the bot;
- keep bot as a later acquisition/sales experiment;
- start with a static/low-logic bot offer before syncing app data.

## Monetization Strategy

Premium subscription:

- main product is the guided execution system: Today plan, Premium recipes, shopping, replacements, and future questionnaire-based training.
- payment enforcement must wait for entitlement/payment plan.

Recipe collections as separate bot product:

- can monetize content outside app subscription;
- should funnel users to POTOK;
- must avoid confusing separate purchase with full Premium subscription.

Free tier ads:

- possible later monetization model;
- paid tier should be ad-free;
- requires UX, privacy, compliance, analytics, and store-policy review.

Paywall wording:

- not paid: `Хочу быть в ПОТОКЕ`;
- paid: `Я в потоке`.

Risks:

- wording can imply active paid state before entitlement is implemented;
- bot payments can create support/compliance complexity;
- ads may reduce trust in a health/fitness product;
- subscription promises must match actual runtime behavior.

What must wait:

- payment enforcement;
- subscription-management logic;
- entitlement mutation;
- production rollout;
- paid-state copy that implies an active verified subscription.

## Product Readiness Impact

Already exists:

- Supabase/PostgreSQL foundation;
- Premium read-only runtime;
- staging Premium data model;
- `/today` and `/premium-recipes` demo/read-only surfaces;
- Paywall/Home clarity copy;
- no-write guardrails and tests;
- Premium UX polish reports and demo documentation.

Need to add to Product Readiness Map:

- external data/provider verification track;
- owner-approved content pipeline;
- food catalog/import moderation;
- exercise catalog taxonomy and tags;
- training questionnaire design;
- Progress customization;
- Telegram bot funnel strategy;
- monetization/payment/entitlement plan;
- owner demo acceptance status.

Blocks paid MVP:

- behavioral RLS not executed;
- Premium writes disabled;
- payment enforcement disabled;
- owner visual acceptance pending;
- entitlement/payment plan missing;
- production rollout not approved.

Blocks production rollout:

- RLS behavior verification;
- production content readiness;
- payment/entitlement readiness if paid launch is included;
- owner demo acceptance;
- provider licensing verification if external content is used;
- privacy/compliance decisions for analytics, ads, bots, and device integrations.

Can be deferred:

- live API ingestion;
- Telegram bot;
- ads;
- AI/voice;
- automatic step tracking;
- full MuscleMap expansion;
- detailed workout calorie estimation.

## Risks

Technical risks:

- live external API dependencies in runtime;
- data sync across app and bot;
- premature Python/FastAPI/Redis/Celery architecture split;
- unit conversion and recipe scaling complexity;
- write paths before RLS verification.

Data quality risks:

- inconsistent nutrition data;
- duplicate foods and aliases;
- raw/cooked weight confusion;
- unsuitable exercise replacements;
- unreviewed recipe or exercise content.

Legal/licensing risks:

- API commercial use restrictions;
- cache/storage restrictions;
- exercise image copyright;
- food dataset attribution requirements;
- Telegram payment terms;
- ad provider/store policy constraints.

Privacy/health risks:

- injuries/limitations and health-related training recommendations;
- device/Health API permissions;
- calorie burn estimates presented too confidently;
- admin user analytics without clear access/privacy rules.

Business/cost risks:

- API pricing and quotas;
- bot support overhead;
- ad UX tradeoffs;
- Premium promise exceeding current implementation;
- content production cost.

UX/user expectations risks:

- demo vs paid access confusion;
- disabled actions feeling broken;
- local-only replacements/shopping misunderstood as saved;
- AI/coach/payment promises before implementation;
- daily workout assumptions frustrating non-training users.

Scope creep risks:

- mixing Premium launch with food database overhaul;
- mixing Premium launch with exercise catalog overhaul;
- adding bot/payments/ads before core RLS/payment readiness;
- expanding MuscleMap and images inside the same release.

## Recommended Next Step

Recommended next report:

- **TODAY_PREMIUM_PRODUCT_READINESS_MAP_WITH_OWNER_IDEAS_READY**

Scope:

- merge the owner ideas into a Product Readiness Map;
- separate paid MVP blockers from future-growth ideas;
- identify exact packages for RLS, payment/entitlement, owner demo acceptance, content pipeline, food diary improvements, Progress improvements, exercise database, and Telegram bot;
- keep implementation out of scope until readiness decisions are made.

Do not proceed to implementation before Product Readiness Map.

Do not enable writes before RLS.

Do not enable payment before an entitlement plan.

Do not use live API runtime before licensing, cache, commercial-use, privacy, and review plans are complete.

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
- no `premium_shopping_items`;
- no `user_premium_shopping_checks`;
- no AI runtime;
- no voice input;
- no payment enforcement;
- no production rollout;
- no PR.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**TODAY_PREMIUM_OWNER_IDEAS_HYBRID_ARCHITECTURE_REVIEW_READY**
