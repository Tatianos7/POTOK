import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const paths = {
  diary: '/nutrition',
  search: '/nutrition/search',
  custom: '/nutrition/create-custom-product',
  brand: '/nutrition/create-brand-product',
};

test('real nutrition pages share one measured dock across routes and viewport conditions', async () => {
  const server = await createServer({
    root,
    configFile: false,
    envDir: path.join(root, 'tests'),
    plugins: [react()],
    resolve: { alias: [{ find: /^(?:\.\.\/)+context\/AuthContext$/, replacement: path.join(root, 'tests/bottom-dock-auth.ts') }] },
    server: { host: '127.0.0.1', port: 0 },
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox'] });
    const address = server.resolvedUrls.local[0];
    const origin = new URL(address).origin;

    for (const width of [320, 390, 768]) {
      for (const safeArea of [0, 34]) {
        const normalDockHeights = new Map();
        for (const enlargedText of [false, true]) {
          const page = await browser.newPage({ viewport: { width, height: 640 } });
          const externalRequests = [];
          await page.route('**/*', (route) => {
            if (new URL(route.request().url()).origin === origin) return route.continue();
            externalRequests.push(route.request().url());
            return route.abort();
          });
          await page.addInitScript(() => {
            const recent = Array.from({ length: 18 }, (_, index) => ({
              foodId: '', foodName: `Тестовый продукт ${index + 1}`, weight: 100, lastUsedAt: '2025-01-01T00:00:00.000Z',
            }));
            localStorage.setItem('recent_food_searches_bottom-dock-synthetic-user', JSON.stringify(recent));
          });
          await page.goto(new URL('tests/bottom-dock.html', address).href);
          await page.locator('[data-app-bottom-dock] nav').waitFor();
          await page.addStyleTag({ content: `:root { --app-bottom-safe-area: ${safeArea}px; }` });
          if (enlargedText) {
            await page.addStyleTag({ content: '[data-app-bottom-dock] button, [data-app-bottom-dock] a, [data-app-bottom-dock] span { font-size: 20px !important; line-height: 1.25 !important; }' });
          }

          for (const [screen, pathname] of Object.entries(paths)) {
            await page.locator('[data-test-route-links]').getByRole('link', { name: screen }).click();
            await page.waitForFunction((expected) => {
              const dock = document.querySelector('[data-app-bottom-dock]');
              const shell = document.querySelector('#root > div:first-child');
              return document.querySelector('[data-path]')?.textContent === expected &&
                dock?.firstElementChild?.childElementCount === 1 &&
                Math.abs(parseFloat(getComputedStyle(shell).paddingBottom) - dock.getBoundingClientRect().height) < 1;
            }, pathname);

            const geometry = await page.evaluate((currentScreen) => {
              const dock = document.querySelector('[data-app-bottom-dock]');
              const nav = dock.querySelector('nav');
              const actions = dock.firstElementChild;
              const shell = document.querySelector('#root > div:first-child');
              const d = dock.getBoundingClientRect();
              const n = nav.getBoundingClientRect();
              const a = actions.getBoundingClientRect();
              const content = currentScreen === 'diary'
                ? document.querySelector('#root > div:first-child > div.min-h-screen.w-full > div')
                : document.querySelector('main');
              return {
                dockTop: d.top, dockHeight: d.height, navTop: n.top, navBottom: n.bottom,
                actionsBottom: a.bottom, actionsHeight: a.height,
                reserve: parseFloat(getComputedStyle(shell).paddingBottom),
                contentBottomPadding: content ? parseFloat(getComputedStyle(content).paddingBottom) : null,
                navBottomPadding: parseFloat(getComputedStyle(nav).paddingBottom),
                navLabelsVisible: [...nav.querySelectorAll('span')].every((label) =>
                  label.scrollHeight <= label.clientHeight + 1 && label.scrollWidth <= label.clientWidth + 1),
                viewport: innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
              };
            }, screen);
            assert.ok(geometry.actionsHeight > 0, `${width}/${safeArea}/${screen}: real page actions rendered`);
            assert.ok(Math.abs(geometry.actionsBottom - geometry.navTop) < 1, `${width}/${safeArea}/${screen}: actions meet navigation`);
            assert.ok(Math.abs(geometry.navBottom - geometry.viewport) < 1, `${width}/${safeArea}/${screen}: dock follows viewport`);
            assert.ok(Math.abs(geometry.reserve - geometry.dockHeight) < 1, `${width}/${safeArea}/${screen}: one measured shell reserve`);
            assert.ok(Math.abs(geometry.navBottomPadding - (8 + safeArea)) < 1, `${width}/${safeArea}/${screen}: one safe area inset`);
            assert.equal(geometry.navLabelsVisible, true, `${width}/${safeArea}/${screen}: navigation labels remain visible`);
            assert.equal(geometry.horizontalOverflow, false, `${width}/${safeArea}/${screen}: no horizontal overflow`);
            assert.ok(geometry.contentBottomPadding !== null && geometry.contentBottomPadding <= 24,
              `${width}/${safeArea}/${screen}: no second footer reserve`);
            if (enlargedText) {
              assert.ok(geometry.dockHeight > normalDockHeights.get(screen),
                `${width}/${safeArea}/${screen}: dock grows with enlarged text`);
            } else {
              normalDockHeights.set(screen, geometry.dockHeight);
            }

            const lastContent = screen === 'diary'
              ? page.locator('button.rounded-b-full').last()
              : screen === 'search'
                ? page.getByText('Тестовый продукт 18', { exact: true })
                : page.locator('main input[type="radio"][value="snack"]');
            await lastContent.waitFor();
            await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
            const box = await lastContent.boundingBox();
            assert.ok(box && box.y >= -1 && box.y + box.height <= geometry.dockTop + 1,
              `${width}/${safeArea}/${screen}: last content scrolls fully above dock`);
            const hit = await lastContent.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
              return top === element || element.contains(top);
            });
            assert.equal(hit, true, `${width}/${safeArea}/${screen}: last content receives pointer`);
            await page.evaluate(() => scrollTo(0, 0));

            if (screen === 'diary') {
              await page.getByRole('button', { name: 'ДОБАВИТЬ ПРОДУКТ', exact: true }).click();
              for (const label of ['Найти продукт', 'Мои продукты', 'Ввод продукта', 'Анализатор рецепта']) {
                assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1);
              }
              await page.getByRole('button', { name: 'Найти продукт', exact: true }).click();
              await page.waitForFunction(() => document.querySelector('[data-path]')?.textContent === '/nutrition/search');
              await page.locator('[data-test-route-links]').getByRole('link', { name: 'diary' }).click();
            } else if (screen === 'custom' || screen === 'brand') {
              await page.getByRole('checkbox', { name: 'Добавить в избранное' }).check();
              assert.equal(await page.getByRole('checkbox', { name: 'Добавить в избранное' }).isChecked(), true);
              assert.equal(await page.getByRole('button', { name: 'СОХРАНИТЬ' }).isDisabled(), true);
            }
          }

          await page.getByRole('button', { name: 'Ещё' }).click();
          await page.getByRole('link', { name: 'Профиль' }).click();
          await page.waitForFunction(() => document.querySelector('[data-path]')?.textContent === '/profile');
          await page.getByRole('link', { name: 'Профиль' }).waitFor({ state: 'detached' });
          await page.locator('[data-test-route-links]').getByRole('link', { name: 'search' }).click();
          await page.getByRole('textbox', { name: /Поиск еды/ }).focus();
          await page.setViewportSize({ width, height: 480 });
          const dockBottom = await page.locator('[data-app-bottom-dock]').evaluate((element) => element.getBoundingClientRect().bottom);
          assert.ok(Math.abs(dockBottom - 480) < 1, `${width}/${safeArea}: dock follows viewport resize with input focused`);
          assert.deepEqual(externalRequests, [], `${width}/${safeArea}: no external service requests`);
          await page.close();
        }
      }
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});
