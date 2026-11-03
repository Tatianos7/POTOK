# Local authoring week viewer

The next step after PR296 is a separate local React viewer for its versioned JSON reports. Run `npm run dev` and open `/authoring-week-preview.html`. Choose a report generated with `recipe-authoring-week-preview-v1.ts`. No source recipes or private report contents are committed.

This HTML is intentionally absent from the production Rollup inputs. It does not import App, authentication, Supabase clients, the trusted generator, persistence or the diary. It displays only user-selected files held in component memory, without localStorage or an upload operation. Loading a new file clears the previous report immediately, including errors; asynchronous reads cannot replace a newer selection. The file limit is 2 MB.

The decoder requires the exact offline contract and non-publishable/non-activatable markers. It validates seven sequential dates and ordered slots for a successful week, numeric per-serving references, daily sums at the producer's three-decimal precision, repeat caps, and unverified whole portions with unknown measured grams. It rejects malformed reports rather than repairing them. This validation does not establish source authenticity, trusted-plan acceptance, dietary safety or actual measured yields. The displayed workbook hash is metadata from the report, not a cryptographic authenticity claim.

The viewer preserves all distinct no-week diagnostics, including the unsuccessful 2000-kcal evaluated shortlist. It does not relax targets or multiply/divide references by the recipe's declared total servings. Day tabs show recipe names, whole source portions, reference calories/macros/fiber, unconfirmed grams, the test category mapping and search limitations. Rendering file text uses React escaping.

This is a functional test harness using existing utility styles, not a new approved product screen or a design-token change. PLAN remains distinct from FACT. No hosted environment changes or generator activation are part of this step.

Validation: five contract/rendering tests, TypeScript, targeted ESLint and the full production build pass. Local Chromium loaded the actual private 1400/1600/1800 reports and switched through all 21 days with four cards each. The 2000 report displayed its no-day result; malformed JSON data cleared the previous menu. At 390 px the page had no horizontal overflow. No page errors or Auth/RPC/Supabase requests were observed. The production output contains neither this HTML entry nor the offline viewer code. These checks do not claim a hosted application or phone-device E2E.
