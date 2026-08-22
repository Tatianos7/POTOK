# Today Premium Existing Routes And Screens Audit

- Date: 2026-08-22
- Branch: `master`
- Status basis:
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_14_DAY_SYSTEM_SPEC_READY`
  - `TODAY_PREMIUM_ACCESS_PLAN_DAY_OWNER_AMENDMENTS_READY`
  - `TODAY_PREMIUM_RECIPES_SEPARATION_SPEC_READY`
  - `HOME_REMOVE_PREMIUM_BADGES_FROM_WORKOUTS_PROGRESS_READY`
- Verdict: **TODAY_PREMIUM_EXISTING_ROUTES_AND_SCREENS_AUDIT_READY**

## Scope

Read-only audit of existing Home/Dashboard, subscription/payment, Goal, Measurements, Today/Smart Day, and nutrition recipe screens/routes for future POTOK Premium / `Мой Поток` implementation.

No runtime code, DB/schema/storage, migrations, payment, auth/access, diary/workout writes, recipe import, AI runtime, voice input, or PR work was done.

## Found Files

Home/Dashboard:

- `src/pages/Dashboard.tsx`
- `src/components/FeatureCard.tsx`
- `src/utils/constants.ts`
- `src/data/features.ts`
- `src/types/index.ts`

Routes:

- `src/App.tsx`

Subscription/payment:

- `src/pages/Paywall.tsx`
- `src/pages/SubscriptionManagement.tsx`
- `src/components/ChangeSubscriptionModal.tsx`
- `src/components/PaymentModal.tsx`
- `src/components/PaymentSuccessModal.tsx`
- `src/components/DeleteSubscriptionModal.tsx`
- `src/pages/Profile.tsx`
- `src/services/profileService.ts`
- `src/services/entitlementService.ts`
- `src/services/uiRuntimeAdapter.ts`

Goal and measurements:

- `src/pages/Goal.tsx`
- `src/components/CreateGoalModal.tsx`
- `src/components/EditGoalModal.tsx`
- `src/pages/GoalResult.tsx`
- `src/pages/Measurements.tsx`
- `src/services/goalService.ts`
- `src/services/measurementsService.ts`

Today / Smart Day:

- `src/pages/Today.tsx`
- `src/types/todayPlan.ts`
- `src/services/demoSmartDayProvider.ts`
- `src/services/demoTodayPlansProvider.ts`

Nutrition recipes:

- `src/pages/Recipes.tsx`
- `src/pages/RecipeDetails.tsx`
- `src/pages/RecipeAnalyzer.tsx`
- `src/pages/FoodSearch.tsx`
- `src/components/RecipesGrid.tsx`
- `src/components/RecipesList.tsx`
- `src/components/SaveRecipeToDiarySheet.tsx`
- `src/components/SaveRecipeModal.tsx`
- `src/services/recipesService.ts`
- `src/services/recipeDiaryService.ts`
- `src/types/recipe.ts`

## Existing Routes

Routes are declared in `src/App.tsx` and wrapped with `ProtectedRoute` for authenticated app screens.

Relevant current routes:

- `/` -> `Dashboard`
- `/profile` -> `Profile`
- `/goal` -> `Goal`
- `/goals` -> `Goal`
- `/goal/result` -> `GoalResult`
- `/measurements` -> `Measurements`
- `/nutrition` -> `FoodDiary`
- `/nutrition/search` -> `FoodSearch`
- `/nutrition/recipe-analyzer` -> `RecipeAnalyzer`
- `/nutrition/recipes` -> `Recipes`
- `/nutrition/recipes/:id` -> `RecipeDetails`
- `/nutrition/favorites` -> `FavoritesProductsPage`
- `/workouts` -> `Workouts`
- `/progress` -> `Progress`
- `/today` -> `Today`
- `/my-program` -> `MyProgram`
- `/paywall` -> `Paywall`

There is no current route for `/my-potok`, `/premium-recipes`, or a dedicated `Сборник рецептов` premium library.

## Home / Dashboard Audit

`Dashboard` renders Home cards from `FEATURE_CARDS` in `src/utils/constants.ts`.

Each card has:

- `id`;
- `icon`;
- `title`;
- `subtitle`;
- `isPremium`;
- optional `premiumColor`;
- `route`.

`FeatureCard` receives `hasPremium={user?.hasPremium || false}` and shows a visible `PREMIUM` badge when:

- `card.isPremium` is true;
- user does not have premium.

Current Home card source of truth for the actual Dashboard is `src/utils/constants.ts`. `src/data/features.ts` contains a parallel feature list used by tests/data checks and should stay aligned if future Home card logic changes.

Current `План тренировок и питания` card:

- title: `План тренировок и питания`;
- subtitle: `Здесь курсы по тренировкам и питанию`;
- route: `/today`;
- `isPremium: false`.

Current `Тренировки` and `Прогресс` cards:

- route to `/workouts` and `/progress`;
- are no longer marked premium after the latest Home badge cleanup.

There is no subscription-state branching inside `FEATURE_CARDS` today. Future `POTOK Premium` -> `Мой Поток` behavior will need either:

- computed Home card data in `Dashboard`, based on `user.hasPremium`;
- or a helper function such as `getHomeFeatureCards({ hasPremium })`.

Safest future replacement:

- replace the current `План тренировок и питания` card with one subscription-aware premium entry;
- before purchase: `POTOK Premium`, subtitle `Готовый план питания и тренировок под вашу цель`;
- after purchase: `Мой Поток`, subtitle `Ваше питание, тренировки и рекомендации на сегодня`;
- keep route `/today` only if `/today` becomes the premium world entry;
- add `Сборник рецептов` only when `user.hasPremium === true`;
- do not re-add premium badges to `Тренировки` or `Прогресс`.

## Subscription / Payment Audit

`/paywall` exists and renders `src/pages/Paywall.tsx`.

Current `Paywall`:

- loads paywall state through `uiRuntimeAdapter.getPaywallState('explainability')`;
- uses entitlement/explainability surfaces;
- includes older copy such as `Manual Mode`, `Follow Plan`, `Today`, `Explainability`, and `Coach Layer`;
- has buttons `Улучшить до Premium` and `Восстановить покупки`;
- does not currently present the new owner-approved `POTOK Premium` teaser value set.

`SubscriptionManagement` exists as a modal-style component:

- shows `УПРАВЛЕНИЕ ПОДПИСКОЙ`;
- can open `ChangeSubscriptionModal`;
- `handleSelectPlan` currently calls `profileService.updatePremiumStatus(user.id, true)`;
- this is payment-like demo/admin behavior and should not be changed during audit.

`Profile` currently shows a `Подписка` card with:

- `Тариф: FREE`;
- `Монетизация находится в разработке.`;
- `Подписки появятся в одном из будущих обновлений POTOK.`

Search did not find `SubscriptionManagement` imported or mounted in `Profile`. It appears to exist but is not currently connected to a visible profile action in this screen.

Future paywall CTA options:

- route to `/paywall` first for teaser;
- from teaser CTA `Оформить подписку`, open or route to the existing subscription management/payment surface after a separate implementation decision;
- avoid advertising AI in this teaser until AI runtime exists.

## Goal Screen Audit

`/goal` and `/goals` both route to `Goal`.

`Goal`:

- loads goal state via `uiRuntimeAdapter.getGoalState(user.id)`;
- supports local fallback from `localStorage` key `goal_${user.id}`;
- stores/uses goal fields such as goal type, current weight, target weight, dates, training place, BMR, TDEE, calories, protein, fat, carbs;
- opens `CreateGoalModal` for goal calculation;
- navigates to `/goal/result` with form data after calculation;
- can save edited calories/protein/fat/carbs through `goalService.saveUserGoal`.

`CreateGoalModal` currently collects:

- gender;
- age;
- weight;
- height;
- lifestyle;
- training place: none/home/gym;
- goal;
- target weight;
- intensity.

Reuse for `Рассчитать цель`:

- yes, route `/goal` is the safest current target;
- existing flow already calculates/stores goal-relevant data;
- future premium questionnaire can extend from this flow after a separate design.

Future premium questionnaire extension points:

- meal count;
- cooking time;
- cooking for 1 day or 2-3 days;
- food preferences;
- dislikes/restrictions;
- `Нет времени` frequency and practical constraints;
- quick meals;
- portable snacks;
- short workouts;
- training frequency and duration.

Do not add those inputs in this audit.

## Measurements Screen Audit

`/measurements` routes to `Measurements`.

Current `Measurements`:

- supports base measurements `ВЕС`, `ТАЛИЯ`, `БЕДРА`;
- supports custom measurements up to a limit;
- supports main and additional photos;
- loads/saves via `measurementsService`;
- after save, shows a prompt pointing to `Прогресс`.

Reuse for `Создать замеры`:

- yes, route `/measurements` is the safest current target;
- button text in future premium empty state should be `Создать замеры`;
- no separate premium measurement route is needed for the first implementation.

Do not change measurement persistence or photo handling as part of Premium entry work.

## Today / Smart Day Audit

`/today` routes to `Today`.

Current `Today` already contains UI/demo concepts that map to future `Мой Поток`:

- primary Smart Day flow;
- day-state selector: `Нет сил`, `Обычный день`, `Готова работать`;
- CTA `Собрать день`;
- result state `Сегодня готово`;
- plan items for nutrition, workout, water/activity, recommendations;
- actions: `Принять день`, `Выполнено`, `Не подходит`, `Сделать проще`, `Заменить питание`, `Заменить тренировку`;
- guardrail: `План не записывается в дневник автоматически...`;
- local/mock state only.

Current `Today` also keeps secondary demo program flow:

- `Другие способы`;
- `Готовые программы`;
- demo program `Похудение дома · 7 дней`;
- selected day becomes Today items;
- meal action navigates to `/nutrition`;
- workout action navigates to `/workouts`;
- `Выполнено` / `Не подходит` update only local/mock state.

Reusable pieces:

- `TodayPlan`, `TodayItem`, `TodayDayState`, item status model in `src/types/todayPlan.ts`;
- `demoSmartDayProvider` as a safe UI model reference;
- `demoTodayPlansProvider` as a purchased-plan prototype;
- view separation in `TodayView` to avoid mixing Smart Day result and program preview.

What not to mix:

- do not show Smart Day result and program demo stacked together;
- do not turn free self-guided checklist into Today;
- do not auto-write nutrition/workout/water from Today;
- do not expose AI runtime claims before implementation.

Future naming:

- after purchase Home should say `Мой Поток`, but route may still be `/today` for the first step if changing route names would add risk;
- later, `/today` can remain the technical route while UI copy says `Мой Поток`.

## Nutrition Recipes Audit

Current recipe routes are under the free nutrition diary area:

- `/nutrition/recipes`;
- `/nutrition/recipes/:id`;
- `/nutrition/recipe-analyzer`.

`Recipes` uses tabs:

- `МОИ РЕЦЕПТЫ`;
- `ИЗБРАННЫЕ`;
- `СБОРНИК`.

`RecipeTab` is currently:

- `my`;
- `favorites`;
- `collection`.

`recipesService` reads/writes the existing `recipes` table by `user_id` for `getAllRecipes`, and relation tables for favorites/collection:

- `favorite_recipes`;
- `recipe_collections`.

`Recipe` currently has:

- optional `source`: `recipe_analyzer`, `manual`, `default`, `meal`;
- optional `userId` for `МОИ РЕЦЕПТЫ`.

`RecipeAnalyzer` can save to `Мои рецепты`, and `SaveRecipeToDiarySheet` / `recipeDiaryService` can create diary meal entries after user action.

Audit conclusion:

- current recipes are user-created/user-owned diary recipes;
- premium ready recipes are not modeled as a separate catalog yet;
- the current `СБОРНИК` tab is not the same as the future Premium `Сборник рецептов`;
- future premium recipe library should not reuse this label in a way that confuses user collections with POTOK content.

Premium recipes should stay separate until an owner-approved model exists:

- no mixing access rules;
- no normal-user edits to POTOK recipes;
- no automatic promotion of user recipes to premium catalog;
- diary should receive snapshots after confirmation so historical entries survive premium access changes.

## What Can Be Reused

- `Dashboard` card rendering and icon/card model.
- `user.hasPremium` from `AuthContext` as first simple UI branching signal.
- `/paywall` as an existing protected paywall route, after copy/product cleanup.
- `/goal` for `Рассчитать цель`.
- `/measurements` for `Создать замеры`.
- `/today` and `TodayPlan`/`TodayItem` demo model for future `Мой Поток` UI foundation.
- `/nutrition` as confirm-to-diary destination.
- `/workouts` as quick-start workout destination.
- Existing recipe UI patterns for cards/lists/details, but not the existing user-owned data model as-is for premium content.

## What Cannot Be Touched Now

- DB/schema/storage and migrations.
- Auth/access logic and `ProtectedRoute`.
- Existing payment/subscription mutation behavior.
- Diary/workout write paths.
- User-created recipe persistence.
- Premium recipe catalog modeling.
- AI runtime or AI claims in paywall.
- Coach marketplace.
- Voice input.
- Progress Daily Goal.

## Risks

- Duplicated feature sources: `src/utils/constants.ts` drives Dashboard, while `src/data/features.ts` also stores similar cards. Future changes can drift unless centralized.
- Existing `/paywall` copy is older and mentions AI/Coach/explainability-like value. It needs product cleanup before becoming the new teaser.
- `SubscriptionManagement` exists but appears disconnected from visible profile UI; wiring CTA later needs a clear owner-approved path.
- Current profile subscription card says monetization is in development and may conflict with a future active Premium entry.
- Existing recipe `СБОРНИК` tab can be confused with future Premium `Сборник рецептов`.
- Current recipes table/service are user-scoped; using them directly for POTOK premium content could mix user content and paid catalog access.
- `/today` currently contains demo flows; future `Мой Поток` should keep one-screen-one-function separation and avoid stacked Smart Day/program states.

## Recommended Minimal Implementation Step

Recommended next package: `TODAY_PREMIUM_HOME_ACCESS_UI_MOCK_PACKAGE`.

Suggested scope:

- add a small Home card adapter/helper that derives premium Home cards from `user.hasPremium`;
- before purchase, show `POTOK Premium` with subtitle `Готовый план питания и тренировок под вашу цель`;
- after purchase, show `Мой Поток` with subtitle `Ваше питание, тренировки и рекомендации на сегодня`;
- after purchase, show separate `Сборник рецептов` card as a placeholder route/disabled UI if no premium recipe route exists yet;
- keep `/today` as the route for `Мой Поток` for now;
- route `Рассчитать цель` to `/goal`;
- route `Создать замеры` to `/measurements`;
- update `/paywall` copy to remove AI/Coach promises before wiring purchase CTA;
- add tests around Home card branching and routes;
- do not implement payment, DB, AI, premium recipes catalog, or diary writes.

## Safety Confirmation

- Read-only audit only, plus this report.
- No runtime code.
- No DB/schema/storage changes.
- No migrations.
- No production data changes.
- No payment changes.
- No auth/access changes.
- No diary/workout writes.
- No recipe import.
- No AI runtime.
- No voice input.
- No PR.

## Final Verdict

**TODAY_PREMIUM_EXISTING_ROUTES_AND_SCREENS_AUDIT_READY**
