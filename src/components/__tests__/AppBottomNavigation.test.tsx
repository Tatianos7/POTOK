import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AppBottomNavigation, {
  getActiveBottomNavSection,
  getBottomNavOverflowItems,
  shouldShowBottomNavigation,
} from '../AppBottomNavigation';

const currentDir = dirname(fileURLToPath(import.meta.url));
const bottomNavigationSource = readFileSync(resolve(currentDir, '../AppBottomNavigation.tsx'), 'utf8');

test('bottom navigation visibility is limited to authenticated app shell routes', () => {
  assert.equal(shouldShowBottomNavigation('authenticated', '/'), true);
  assert.equal(shouldShowBottomNavigation('authenticated', '/goals'), true);
  assert.equal(shouldShowBottomNavigation('authenticated', '/nutrition'), true);
  assert.equal(shouldShowBottomNavigation('authenticated', '/workouts'), true);
  assert.equal(shouldShowBottomNavigation('authenticated', '/auth'), false);
  assert.equal(shouldShowBottomNavigation('authenticated', '/pin/unlock'), false);
  assert.equal(shouldShowBottomNavigation('unauthenticated', '/'), false);
  assert.equal(shouldShowBottomNavigation('booting', '/'), false);
});

test('bottom navigation resolves active top-level sections from routes', () => {
  assert.equal(getActiveBottomNavSection('/'), 'home');
  assert.equal(getActiveBottomNavSection('/goal/result'), 'goal');
  assert.equal(getActiveBottomNavSection('/nutrition/search'), 'nutrition');
  assert.equal(getActiveBottomNavSection('/workouts/history'), 'workouts');
  assert.equal(getActiveBottomNavSection('/measurements'), 'more');
  assert.equal(getActiveBottomNavSection('/progress/workouts'), 'more');
  assert.equal(getActiveBottomNavSection('/profile/edit'), 'more');
});

test('bottom navigation renders main tabs and more entry points', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/nutrition']}>
      <AppBottomNavigation />
    </MemoryRouter>,
  );

  assert.match(html, /Основная навигация/);
  assert.match(html, /Главная/);
  assert.match(html, /Цель/);
  assert.match(html, /Питание/);
  assert.match(html, /Тренировки/);
  assert.match(html, /Ещё/);
  assert.match(html, /aria-current="page"/);
});

test('more menu keeps measurements progress and profile available', () => {
  assert.match(bottomNavigationSource, /label: 'Замеры', to: '\/measurements'/);
  assert.match(bottomNavigationSource, /label: 'Прогресс', to: '\/progress'/);
  assert.match(bottomNavigationSource, /label: 'Профиль', to: '\/profile'/);
  assert.match(bottomNavigationSource, /setIsMoreOpen\(false\)/);
});

test('free more menu does not include premium recipe collection', () => {
  const items = getBottomNavOverflowItems(false);

  assert.deepEqual(items.map((item) => item.label), ['Замеры', 'Прогресс', 'Профиль']);
  assert.equal(items.some((item) => item.label === 'Сборник рецептов'), false);
});

test('premium more menu includes recipe collection route before shared items', () => {
  const items = getBottomNavOverflowItems(true);

  assert.equal(items[0]?.label, 'Сборник рецептов');
  assert.equal(items[0]?.to, '/premium-recipes');
  assert.deepEqual(items.slice(1).map((item) => item.label), ['Замеры', 'Прогресс', 'Профиль']);
});

test('more menu uses compact mobile popup sizing', () => {
  assert.match(bottomNavigationSource, /bottom-\[calc\(100%\+0\.35rem\)\]/);
  assert.match(bottomNavigationSource, /grid-cols-4/);
  assert.match(bottomNavigationSource, /min-h-\[52px\]/);
  assert.match(bottomNavigationSource, /h-4 w-4/);
});
