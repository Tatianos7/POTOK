import requests from './stagingVegetableIdentityRequests.json';
import { supabase } from './lib/supabaseClient';
import { verifyFoodEvidenceReceiptV1 } from './server/foodEvidenceReviewGatewayV1';
import { decodeFoodEvidenceReviewRequestRawV1 } from './server/foodEvidenceReviewRequestV1';


const button = document.querySelector<HTMLButtonElement>('#check');
const result = document.querySelector<HTMLParagraphElement>('#result');
const recipeReview = document.querySelector<HTMLElement>('#recipe-review');
const approveCards = document.querySelector<HTMLButtonElement>('#approve-cards');
const recipeResult = document.querySelector<HTMLParagraphElement>('#recipe-review-result');
async function withDeadline<T>(work: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error('REQUEST_TIMEOUT')), 12000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const stagingUrl = 'https://ozidryfvhkcbtpnulakq.supabase.co';

if (button && result && supabase && import.meta.env.MODE === 'staging-preview'
  && import.meta.env.VITE_POTOK_STAGING_PREVIEW === 'true'
  && import.meta.env.VITE_SUPABASE_URL === stagingUrl) {
  const client = supabase;
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (recipeReview) recipeReview.hidden = true;
    result.textContent = 'Проверяем…';

    try {
      const { data: { session } } = await withDeadline(client.auth.getSession());
      if (!session) {
        result.textContent = 'В этом браузере нужна действующая сессия тестового POTOK.';
        return;
      }

      // The database checks authority before parsing. The empty object cannot create a review.
      const { error } = await withDeadline(client.rpc('food_evidence_review_v1', { p_request_text: '{}' })
        .abortSignal(AbortSignal.timeout(12000)));
      if (error?.code === '22023' && error.message === 'EVENT_VARIANT_INVALID') {
        result.textContent = 'Право администратора подтверждено. Данные каталога не менялись.';
        if (recipeReview) recipeReview.hidden = false;
      } else if (error?.code === '42501' && error.message === 'VERIFIED_ADMIN_REQUIRED') {
        result.textContent = 'Обычный аккаунт. Сервер отказал в утверждении продуктов.';
      } else if (error?.code === 'PGRST301' || (error?.code === '42501'
        && ['AUTH_REQUIRED', 'JWT_EXPIRED', 'LIVE_AUTH_SESSION_REQUIRED'].includes(error.message))) {
        result.textContent = 'В этом браузере нужна действующая сессия тестового POTOK.';
      } else {
        result.textContent = 'Сервер вернул неожиданный ответ. Проверка не завершена.';
      }
    } catch {
      result.textContent = 'Проверка не получила ответ вовремя. Кнопка снова доступна.';
    } finally {
      button.disabled = false;
    }
  });

  if (approveCards && recipeResult) {
    approveCards.addEventListener('click', async () => {
      approveCards.disabled = true;
      button.disabled = true;
      recipeResult.textContent = 'Подтверждаем карточки…';
      let confirmed = 0;
      try {
        const { data: { session } } = await withDeadline(client.auth.getSession());
        if (!session) throw Error('AUTH_REQUIRED');
        for (const item of requests) {
          const raw = JSON.stringify(item);
          const { data, error } = await withDeadline(client.rpc('food_evidence_review_v1', { p_request_text: raw })
            .abortSignal(AbortSignal.timeout(12000)));
          if (error) throw error;
          await verifyFoodEvidenceReceiptV1(await decodeFoodEvidenceReviewRequestRawV1(raw), session.user.id, data);
          confirmed++;
        }
        recipeResult.textContent = 'Сервер подтвердил все три карточки.';
      } catch {
        recipeResult.textContent = `Сервер подтвердил ${confirmed} из трёх карточек. Можно повторить запрос с тем же пакетом.`;
        approveCards.disabled = false;
      } finally {
        button.disabled = false;
      }
    });
  }
} else if (result) {
  result.textContent = 'Подтверждение доступно в тестовой сборке POTOK.';
}
