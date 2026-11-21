import { supabase } from './lib/supabaseClient';

const button = document.querySelector<HTMLButtonElement>('#check');
const result = document.querySelector<HTMLParagraphElement>('#result');
const stagingUrl = 'https://ozidryfvhkcbtpnulakq.supabase.co';

if (button && result && supabase && import.meta.env.MODE === 'staging-preview'
  && import.meta.env.VITE_POTOK_STAGING_PREVIEW === 'true'
  && import.meta.env.VITE_SUPABASE_URL === stagingUrl) {
  const client = supabase;
  button.disabled = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
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
} else if (result) {
  result.textContent = 'Проверка доступна в тестовой сборке POTOK.';
}
