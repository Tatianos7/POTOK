import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { features } from '../../data/features';
import { FEATURE_CARDS, getHomeFeatureCards } from '../../utils/constants';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(resolve(currentDir, '../Dashboard.tsx'), 'utf8');

const expectedFreeHomeCards = [
  { title: 'ТРЕНИРОВКИ', route: '/workouts' },
  { title: 'ПРОГРЕСС', route: '/progress' },
] as const;

test('dashboard workout and progress cards are not marked premium', () => {
  for (const { title, route } of expectedFreeHomeCards) {
    const dashboardCard = FEATURE_CARDS.find((card) => card.title === title);
    const featureCard = features.find((card) => card.title === title);

    assert.ok(dashboardCard, `${title} exists in dashboard constants`);
    assert.equal(dashboardCard.isPremium, false);
    assert.equal(dashboardCard.route, route);
    assert.equal(dashboardCard.premiumColor, undefined);

    assert.ok(featureCard, `${title} exists in shared feature data`);
    assert.equal(featureCard.isPremium, false);
    assert.equal(featureCard.route, route);
  }
});

test('home cards show POTOK Premium entry before purchase', () => {
  const cards = getHomeFeatureCards({ hasPremium: false });
  const premiumEntry = cards[0];

  assert.equal(premiumEntry.title, 'POTOK Premium');
  assert.equal(premiumEntry.subtitle, 'Готовый план питания и тренировок под вашу цель');
  assert.equal(premiumEntry.route, '/paywall');
  assert.equal(cards.some((card) => card.title === 'Мой Поток'), false);
  assert.equal(cards.some((card) => card.title === 'Сборник рецептов'), false);
});

test('dashboard uses demo premium access as effective premium state', () => {
  assert.match(dashboardSource, /hasDemoPremiumAccess/);
  assert.match(dashboardSource, /effectiveHasPremium = Boolean\(user\?\.hasPremium \|\| hasDemoPremiumAccess\(\)\)/);
  assert.match(dashboardSource, /getHomeFeatureCards\(\{ hasPremium: effectiveHasPremium \}\)/);
});

test('home cards show My Potok and premium recipes after purchase', () => {
  const cards = getHomeFeatureCards({ hasPremium: true });
  const myPotokEntry = cards[0];
  const premiumRecipesEntry = cards.find((card) => card.title === 'Сборник рецептов');

  assert.equal(myPotokEntry.title, 'Мой Поток');
  assert.equal(myPotokEntry.subtitle, 'Ваше питание, тренировки и рекомендации на сегодня');
  assert.equal(myPotokEntry.route, '/today');
  assert.ok(premiumRecipesEntry);
  assert.equal(premiumRecipesEntry.subtitle, 'Готовые рецепты с КБЖУ и граммовками');
  assert.equal(premiumRecipesEntry.route, '/premium-recipes');
  assert.equal(cards.some((card) => card.title === 'POTOK Premium'), false);
});

test('home cards keep workouts and progress without premium badges in both states', () => {
  for (const hasPremium of [false, true]) {
    const cards = getHomeFeatureCards({ hasPremium });

    for (const { title, route } of expectedFreeHomeCards) {
      const card = cards.find((item) => item.title === title);

      assert.ok(card, `${title} exists when hasPremium=${hasPremium}`);
      assert.equal(card.isPremium, false);
      assert.equal(card.route, route);
      assert.equal(card.premiumColor, undefined);
    }
  }
});
