import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Paywall from '../Paywall';

const currentDir = dirname(fileURLToPath(import.meta.url));
const paywallSource = readFileSync(resolve(currentDir, '../Paywall.tsx'), 'utf8');

function renderPaywall() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(Paywall))
  );
}

test('paywall uses owner-approved Premium value proposition copy', () => {
  const html = renderPaywall();

  assert.match(html, /POTOK Premium/);
  assert.match(html, /Меньше думайте — больше выполняйте/);
  assert.match(html, /Сейчас демо помогает оценить/);
  assert.match(html, /Подписка скоро/);
  assert.match(html, /Покупки скоро/);
  assert.match(html, /Посмотреть демо Premium/);
  assert.match(html, /Демо Premium можно открыть без покупки/);
  assert.match(html, /Готовые планы питания и тренировок/);
  assert.match(html, /Рецепты с КБЖУ/);
  assert.match(html, /Замены блюд/);
  assert.match(html, /Список покупок/);
  assert.match(paywallSource, /variant="primary" size="md" disabled/);
  assert.match(paywallSource, /variant="outline" size="md" disabled/);
});

test('paywall does not render technical, AI, or Coach copy', () => {
  const html = renderPaywall();
  const forbidden = `${paywallSource}\n${html}`;

  assert.doesNotMatch(forbidden, /Почему доступ ограничен/);
  assert.doesNotMatch(forbidden, /Причина/);
  assert.doesNotMatch(forbidden, /paywall:default/);
  assert.doesNotMatch(forbidden, /Уверенность/);
  assert.doesNotMatch(forbidden, /Trust/);
  assert.doesNotMatch(forbidden, /Safety/);
  assert.doesNotMatch(forbidden, /Explainability/);
  assert.doesNotMatch(forbidden, /Manual Mode/);
  assert.doesNotMatch(forbidden, /Follow Plan/);
  assert.doesNotMatch(forbidden, /Coach Layer/);
  assert.doesNotMatch(forbidden, /POTOK AI|AI generation|generateDailyPlan|openai/i);
  assert.doesNotMatch(forbidden, /CoachMessageCard|CoachNetwork|trainerMarketplace|Coach|коуч/i);
  assert.doesNotMatch(forbidden, /Поддержка/);
  assert.doesNotMatch(forbidden, /Произошла ошибка/);
});

test('paywall demo Premium button enables only local demo access and navigates to Today', () => {
  assert.match(paywallSource, /enableDemoPremiumAccess/);
  assert.match(paywallSource, /navigate\('\/today'\)/);
  assert.match(paywallSource, /Посмотреть демо Premium/);
  assert.match(paywallSource, /clearDemoPremiumAccess/);
  assert.match(paywallSource, /Выйти из демо Premium/);
  assert.doesNotMatch(paywallSource, /updatePremiumStatus/);
  assert.doesNotMatch(paywallSource, /profileService/);
  assert.doesNotMatch(paywallSource, /PaymentModal|SubscriptionManagement|ChangeSubscriptionModal/);
  assert.doesNotMatch(paywallSource, /stripe|checkout|payment|subscribe/i);
});
