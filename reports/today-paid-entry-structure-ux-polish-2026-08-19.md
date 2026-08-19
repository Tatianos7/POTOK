# Today Paid Entry Structure UX Polish

- Date: 2026-08-19
- Branch: `master`
- Status basis:
  - `TODAY_PAID_ENTRY_STRUCTURE_UI_READY`
- Verdict: **TODAY_PAID_ENTRY_STRUCTURE_UX_POLISH_READY**

## Scope

UX/copy polish for the existing `/today` paid entry foundation.

No DB/schema/storage, production data, diary/workout writes, payment, AI generation, Plan Store implementation, trainer marketplace, Coach Network, or PR work was done.

## Owner Visual Review

Owner screenshots showed:

- mixed RU/EN copy: `PAID TODAY`, `Today`, `verified coach`;
- mobile hero felt too large;
- CTA text with `· Скоро` looked untidy and could wrap poorly;
- paid direction cards needed to be more compact and easier to scan.

## What Changed

- Replaced the hero label with Russian copy: `План на день`.
- Kept `Today` as the product/title term.
- Made the hero card more compact by reducing card size and vertical gaps.
- Removed the extra disabled hero `Скоро` button.
- Reworked paid direction cards into a tighter layout.
- Moved `Скоро` into a separate small badge instead of appending it to CTA text.
- Replaced `verified coach` with `проверенного специалиста`.

## Paid Direction Cards

The three directions remain unchanged structurally:

- `POTOK AI`;
- `Готовые программы`;
- `Персональный тренер`.

Each card now has:

- short Russian subtitle;
- 2-3 compact bullets;
- separate `Скоро` badge;
- disabled CTA without `· Скоро` suffix.

## Guardrail

The guardrail was kept and shortened:

- Title: `План ≠ запись в дневнике`
- Text: `В дневник попадает только то, что вы подтвердили или выполнили.`

## What Was Intentionally Not Implemented

- Payment.
- AI generation.
- Plan Store/catalog.
- Trainer marketplace.
- Coach Network.
- Diary/workout write actions.
- DB/schema/storage changes.
- New paid logic behind the disabled CTAs.

## Tests Run

Targeted tests:

```text
npx tsx --test src/pages/__tests__/TodayPaidEntry.test.tsx
```

Result: passed.

```text
tests 7
pass 7
fail 0
```

Note: the server-render test logs the existing React Router `useLayoutEffect` warning from `MemoryRouter`; it does not fail the test and is not a `/today` runtime issue.

## Build Result

```text
npm run build
```

Result: passed (`tsc && vite build`, then GitHub Pages fallback generated).

Build logs still include existing maintenance warnings about browser data age, chunk size, and a `mealService` dynamic/static import overlap. They are not specific to this `/today` polish and did not fail the build.

## Known Limitations

- This is still a UI foundation; all three paid directions remain placeholders.
- No production smoke was run in this package because no deploy was requested.

## Recommendation

After owner visual approval, the next implementation package should pick one paid direction to specify first: AI Today, ready-made programs, or human coach flow.
