import { supabase } from './lib/supabaseClient';
import { verifyFoodEvidenceReceiptV1 } from './server/foodEvidenceReviewGatewayV1';
import { decodeFoodEvidenceReviewRequestRawV1 } from './server/foodEvidenceReviewRequestV1';
import { verifyExactFoodNutritionReceiptV2 } from './server/exactFoodNutritionReviewGatewayV2';
import { exactFoodNutritionRequestContractV2 } from './server/exactFoodNutritionReviewRequestV2';
import { prepareStagingRecipe27Nutrition, stagingRecipe27ReviewBatch } from './server/stagingRecipe27ReviewBatch';

const button = document.querySelector<HTMLButtonElement>('#check');
const result = document.querySelector<HTMLParagraphElement>('#result');
const recipeReview = document.querySelector<HTMLElement>('#recipe-review');
const approveCards = document.querySelector<HTMLButtonElement>('#approve-cards');
const approveNutrition = document.querySelector<HTMLButtonElement>('#approve-nutrition');
const recipeResult = document.querySelector<HTMLParagraphElement>('#recipe-review-result');
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
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        result.textContent = 'В этом браузере нужна действующая сессия тестового POTOK.';
        return;
      }

      // The database checks authority before parsing. The empty object cannot create a review.
      const { error } = await client.rpc('food_evidence_review_v1', { p_request_text: '{}' });
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
      result.textContent = 'Не удалось связаться с тестовым сервером.';
    } finally {
      button.disabled = false;
    }
  });

  if (approveCards && approveNutrition && recipeResult) {
    let canonicalRows: Array<{ canonicalFoodId: string; digest: string }> = [];
    approveCards.addEventListener('click', async () => {
      approveCards.disabled = true;
      approveNutrition.disabled = true;
      canonicalRows = [];
      recipeResult.textContent = 'Утверждаем карточки…';
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) throw Error('AUTH_REQUIRED');
        for (const item of stagingRecipe27ReviewBatch) {
          const raw = JSON.stringify(item.request);
          const { data, error } = await client.rpc('food_evidence_review_v1', { p_request_text: raw });
          if (error) throw error;
          await verifyFoodEvidenceReceiptV1(await decodeFoodEvidenceReviewRequestRawV1(raw), session.user.id, data);
          canonicalRows.push(data.revision);
        }
        recipeResult.textContent = 'Три карточки утверждены. Сообщи об этом, чтобы подготовить сохранение КБЖУ.';
        approveNutrition.disabled = false;
      } catch {
        recipeResult.textContent = `Сервер подтвердил ${canonicalRows.length} из трёх карточек. Сообщи результат для сверки.`;
        approveCards.disabled = false;
      }
    });

    approveNutrition.addEventListener('click', async () => {
      approveNutrition.disabled = true;
      recipeResult.textContent = 'Сохраняем КБЖУ…';
      let saved = 0;
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session || canonicalRows.length !== stagingRecipe27ReviewBatch.length) throw Error('RECIPE_27_CARDS_REQUIRED');
        for (const [index, item] of stagingRecipe27ReviewBatch.entries()) {
          const { proposal } = await prepareStagingRecipe27Nutrition(item, canonicalRows[index]);
          const raw = JSON.stringify({
            contract: exactFoodNutritionRequestContractV2,
            kind: 'REVIEW_APPROVED',
            idempotencyReference: item.nutritionOperationId,
            sourceProposalDigest: proposal.digest,
            expectedHead: null,
          });
          const { data, error } = await client.rpc('food_nutrition_review_v2', { p_request_text: raw });
          if (error) throw error;
          await verifyExactFoodNutritionReceiptV2(raw, session.user.id, data);
          saved++;
        }
        recipeResult.textContent = 'КБЖУ трёх продуктов сохранены в Staging.';
      } catch {
        recipeResult.textContent = `Сервер подтвердил КБЖУ ${saved} из трёх продуктов. Сообщи результат для сверки.`;
        approveNutrition.disabled = false;
      }
    });
  }
} else if (result) {
  result.textContent = 'Проверка доступна в тестовой сборке POTOK.';
}
