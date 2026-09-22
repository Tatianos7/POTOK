# Adaptive Nutrition retained STAGING browser smoke — owner runbook v1

Status: **OWNER-RUN ONLY / NOT RUN BY CODEX**. The retained setup is reported by
the owner as successfully applied on Supabase STAGING project
`ozidryfvhkcbtpnulakq`. Production is excluded.

Exact retained identities:

- account: `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`
- selection: `7e710000-0000-4000-8000-000000000001`

This runbook performs the approved browser actions `SKIPPED` and
`UNDO_ANNOTATION`. They create retained append-only STAGING operation/event rows.
Run it only when ready to complete the whole checklist. Do not run setup again,
enable demo Premium, test REPLACE, or use any FACT action.

## 1. Values and secret boundary

Already known and fixed in the checked-in smoke contract:

| Setting | Exact value |
| --- | --- |
| Supabase project ref | `ozidryfvhkcbtpnulakq` |
| Supabase URL | `https://ozidryfvhkcbtpnulakq.supabase.co` |
| Auth account UUID | `88c26f6b-ebc8-4bff-864d-9194fbd27f8d` |
| Retained selection UUID | `7e710000-0000-4000-8000-000000000001` |
| Runtime gate | `true` |
| STAGING smoke gate | `true` |

The owner must obtain two items from the exact STAGING project in Supabase
Dashboard:

1. In **Project Settings → API Keys**, copy only the key labelled **Publishable**
   (`sb_publishable_...`) or the legacy **anon public** key. Put it in
   `VITE_SUPABASE_ANON_KEY`. Never use a Secret key, `service_role`, a JWT from a
   signed-in user, or a database password.
2. In **Authentication → Users**, find the row whose user ID is exactly
   `88c26f6b-ebc8-4bff-864d-9194fbd27f8d`. Use only the existing email or phone
   attached to that row for OTP login. Do not guess or type a different identifier:
   this login screen currently permits Auth-user creation for an unknown identifier.

Do not paste the key, login email/phone, OTP, JWT, cookies, or request headers into
the smoke report or this chat.

## 2. Create the ignored local environment

In Terminal, run exactly:

```bash
cd /Users/urijurij/Desktop/POTOK/.worktrees/workout-muscle-map-foundation
cp docs/premium/drafts/adaptive-nutrition-retained-staging-smoke-v1.env.example .env.adaptive-smoke.local
chmod 600 .env.adaptive-smoke.local
git check-ignore -v .env.adaptive-smoke.local
nano .env.adaptive-smoke.local
```

`git check-ignore` must report that `*.local` ignores the file. In `nano`, replace
only `<STAGING_PUBLIC_ANON_OR_PUBLISHABLE_KEY>` with the public key copied from the
Dashboard. Save with `Ctrl+O`, Enter, and exit with `Ctrl+X`.

The complete file must have this shape:

```dotenv
VITE_SUPABASE_URL=https://ozidryfvhkcbtpnulakq.supabase.co
VITE_SUPABASE_ANON_KEY=<STAGING_PUBLIC_ANON_OR_PUBLISHABLE_KEY>
VITE_ADAPTIVE_NUTRITION_RUNTIME_V1=true
VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1=true
VITE_ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF=ozidryfvhkcbtpnulakq
VITE_ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID=88c26f6b-ebc8-4bff-864d-9194fbd27f8d
VITE_ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID=7e710000-0000-4000-8000-000000000001
```

Do not add a service-role/secret variable. Do not move these values into `.env`,
`.env.local`, a production environment, query parameters, or localStorage. Do not
commit the populated file.

## 3. Start the exact local mode

From the same directory, run:

```bash
env -u VITE_SUPABASE_URL -u VITE_SUPABASE_ANON_KEY -u VITE_ADAPTIVE_NUTRITION_RUNTIME_V1 -u VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1 -u VITE_ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF -u VITE_ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID -u VITE_ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID npm run dev -- --mode adaptive-smoke --host 127.0.0.1 --port 5173 --strictPort
```

The `env -u` prefixes prevent stale shell variables from overriding the reviewed
mode file. `--strictPort` prevents Vite from silently moving to a different URL.

Use these exact local URLs:

- login: `http://127.0.0.1:5173/auth`
- Today: `http://127.0.0.1:5173/today`
- home/menu for logout: `http://127.0.0.1:5173/`

Keep the Terminal process running. Use a fresh private/incognito browser window so
an old POTOK session, PIN, demo-Premium marker, or another account cannot affect the
smoke.

## 4. Login as the exact STAGING account

1. Open `http://127.0.0.1:5173/auth`.
2. Choose **Email** or **Телефон** to match the identifier already verified for the
   exact Dashboard user ID. Do not use Google login and do not enter an unverified
   identifier.
3. Enter the existing email or phone and click **Получить код**.
4. Enter **Код из письма** or **Код из SMS**, then click **Войти**.
5. If **Создать PIN-код?** appears, click **Пропустить** for this isolated smoke.
6. Open `http://127.0.0.1:5173/today` directly.

The account match is enforced by the smoke gate against the authenticated Supabase
user ID. If the app redirects to `/paywall`, shows a configuration/account warning,
or does not show the runtime week, stop. Do not enable demo Premium and do not alter
the configured UUIDs.

## 5. Exact Today checklist

Use one synthetic slot dated today or earlier; future-slot action buttons are
intentionally disabled.

1. **Current week load.** Wait for **Загружаем подтверждённый план…** to disappear.
   Require the **Активная неделя** heading and a local Monday–Sunday range containing
   today. A different week is a failure.
2. **Seven slots.** Open each day button **Пн–Вс**. Require exactly one synthetic
   planned card on every day, seven total. The neutral card title may be
   **Блюдо подтверждено сервером**.
3. **SKIPPED.** Return to today or an earlier day and click **Не ел(а)** once on its
   only slot. Do not double-click or start another action.
4. **Receipt-bound reconciliation.** First expect
   **Сохраняем изменение и сверяем план…**. Count the action as accepted only after
   **Изменение подтверждено сервером, план обновлён.** appears and the slot offers
   **Отменить отметку**. No UUID, digest, receipt ID, or hash should be visible.
5. **Refresh after SKIPPED.** Reload the page. The same slot must still show
   **Отменить отметку** after the authoritative read completes.
6. **UNDO.** Click **Отменить отметку** once. Again wait through saving and require
   the server-confirmed message before continuing.
7. **Refresh after UNDO.** Reload the page. The same slot must again offer
   **Не ел(а)**; there must be no live skip annotation.
8. **Logout/login.** Only after UNDO is settled, open
   `http://127.0.0.1:5173/`, open **Меню**, click **ВЫХОД**, and repeat the exact OTP
   login for the same account. Reopen `/today` and require the same final
   authoritative state. Never log in as a second account during this retained smoke.
9. **FACT absent.** Across the runtime week, require no controls for
   **Съел(а) по плану**, **Съел(а) с изменениями**, or **+ Было что-то ещё** and no
   diary/consumption confirmation.
10. **REPLACE absent.** Require no **Заменить блюдо** control. A validated-offer
    producer does not exist and REPLACE is outside this smoke.

### UNKNOWN handling

If the page shows **Результат операции пока неизвестен**, do not repeat the original
action, refresh, logout, close the tab, or restart Vite. Click **Проверить результат**
once so lookup uses the original idempotency key and payload. Continue only if it
settles into the server-confirmed state. If it remains UNKNOWN, stop and return to
the chat while keeping the browser tab and Vite process open. The current recovery
key is process-memory state and is not a durable browser-restart outbox.

## 6. PASS and FAIL

The browser smoke is **PASS** only when all ten checklist items pass in order:

- the authoritative active week has seven day buttons and exactly seven slots;
- SKIPPED is acknowledged only after receipt-bound exact reconciliation and survives
  refresh;
- UNDO is acknowledged only after reconciliation, survives refresh, and leaves no
  live annotation;
- logout/login to the same account restores that final state;
- FACT and REPLACE controls remain absent;
- no conflict, denied, unavailable, account/config mismatch, unresolved UNKNOWN,
  or technical identifier appears in the UI.

Any missing item is **FAIL**. Stop immediately on one of these states:

- **План изменился…**, **Premium-доступ сейчас не подтверждён…**,
  **Подтверждённый серверный план сейчас недоступен…**, or
  **Тестовый серверный план недоступен для текущего аккаунта или окружения**;
- redirect to `/paywall`, wrong Monday–Sunday week, a day without exactly one slot,
  an unexpected FACT/REPLACE control, or state lost after refresh/login;
- OTP cannot be received or verified for the exact account;
- the grant has expired, the fixed port is occupied, dependencies are missing, or
  Vite reports that it cannot load the mode environment;
- UNKNOWN does not settle after one **Проверить результат** lookup.

Do not rerun setup, extend/regrant Premium, edit SQL, change UUIDs, use demo access,
clear browser data, install/update dependencies, or retry with a new account/key to
work around a failure.

## 7. Evidence to return without credentials

Copy back only:

- run date/time and local timezone;
- `git rev-parse HEAD` output and the exact Vite command from this runbook;
- browser name/version and OS;
- safe project ref, account UUID, and selection UUID listed above;
- PASS/FAIL for each numbered checklist item;
- exact visible POTOK status/error text and the step where it appeared;
- whether UNKNOWN appeared, whether the single lookup settled it, and whether each
  refresh/login preserved the expected state;
- if needed, sanitized console error names or RPC names/status codes, with all
  request/response bodies and headers omitted.

Never copy the public key, email/phone, OTP, access/refresh token, Authorization or
`apikey` header, cookies, local/session storage contents, or full Network request /
response payloads. A screenshot is optional and must be cropped/redacted so none of
those values or personal identifiers are visible.

After recording evidence, press `Ctrl+C` in the Vite Terminal. Keep the ignored env
file until the result has been reported in case a safe local configuration check is
needed. Do not run the post-smoke SQL, retirement SQL, or post-retirement SQL as part
of this browser runbook. Return to the chat for the next explicit checkpoint.
