import { supabase } from './lib/supabaseClient';
import saltReviewRequest from './stagingSaltReviewRequest.json';

const button = document.querySelector<HTMLButtonElement>('#check');
const result = document.querySelector<HTMLParagraphElement>('#result');
const saltReview = document.querySelector<HTMLElement>('#salt-review');
const approveSalt = document.querySelector<HTMLButtonElement>('#approve-salt');
const saltResult = document.querySelector<HTMLParagraphElement>('#salt-review-result');
const stagingUrl = 'https://ozidryfvhkcbtpnulakq.supabase.co';

if (button && result && supabase && import.meta.env.MODE === 'staging-preview'
  && import.meta.env.VITE_POTOK_STAGING_PREVIEW === 'true'
  && import.meta.env.VITE_SUPABASE_URL === stagingUrl) {
  const client = supabase;
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (saltReview) saltReview.hidden = true;
    result.textContent = 'Проверяем…';

    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        result.textContent = 'В этом браузере нужна действующая сессия тестового POTOK.';
        return;
      }

      // The database checks authority before parsing. The empty object cannot create a review.
      const { error } = await client.rpc('food_evidence_review_v1', { p_request_text: '{}' });
      if (error?.code === '22023' && error.message === 'EVENT_VARIANT_INVALID') {
        result.textContent = 'Право администратора подтверждено. Данные каталога не менялись.';
        if (saltReview) saltReview.hidden = false;
      } else if (error?.code === '42501' && error.message === 'VERIFIED_ADMIN_REQUIRED') {
        result.textContent = 'Обычный аккаунт. Сервер отказал в утверждении продуктов.';
      } else if (error?.code === 'PGRST301' || (error?.code === '42501'
        && ['AUTH_REQUIRED', 'JWT_EXPIRED', 'LIVE_AUTH_SESSION_REQUIRED'].includes(error.message))) {
        result.textContent = 'В этом браузере нужна действующая сессия тестового POTOK.';
      } else {
        result.textContent = 'Сервер вернул неожиданный ответ. Проверка не завершена.';
      }
    } catch {
      result.textContent = 'Не удалось связаться с тестовым сервером.';
    } finally {
      button.disabled = false;
    }
  });

  if (approveSalt && saltResult) {
    approveSalt.addEventListener('click', async () => {
      approveSalt.disabled = true;
      saltResult.textContent = 'Отправляем запрос…';

      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          saltResult.textContent = 'Войди в тестовый POTOK и проверь права ещё раз.';
          return;
        }

        const response = await fetch('/api/staging-food-evidence-review', {
          method: 'POST',
          credentials: 'same-origin',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(saltReviewRequest),
        });
        const receipt = await response.json().catch(() => null);
        if (response.ok && receipt?.contract === 'potok-food-evidence-review-receipt-v1'
          && receipt.event?.idempotencyReference === saltReviewRequest.idempotencyReference
          && receipt.revision?.canonicalFoodId === saltReviewRequest.proposal.canonicalFoodId) {
          saltResult.textContent = 'Сервер подтвердил утверждение поваренной соли.';
          return;
        }

        saltResult.textContent = response.status === 401 || response.status === 403
          ? 'Сервер отказал. Проверь, что вход выполнен под действующим администратором Staging.'
          : 'Сервер не подтвердил запись. Сообщи этот результат для проверки журнала.';
      } catch {
        saltResult.textContent = 'Ответ сервера не получен. Сообщи этот результат для проверки журнала.';
      }
    });
  }
} else if (result) {
  result.textContent = 'Проверка доступна в тестовой сборке POTOK.';
}
