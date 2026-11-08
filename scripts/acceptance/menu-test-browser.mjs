import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve, extname} from 'node:path';

const root = resolve('dist-manual-test');
const server = createServer((req, res) => {
  const path = resolve(root, '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!path.startsWith(root + '/')) {res.writeHead(403).end(); return;}
  try {
    res.setHeader('Content-Type', ({'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html'})[extname(path)] ?? 'application/octet-stream');
    res.end(readFileSync(path));
  } catch {res.writeHead(404).end();}
});
if (!process.argv[2]) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = process.argv[2] ?? `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
const results = [];
try {
  for (const width of [360, 393, 430]) {
    const context = await browser.newContext({viewport: {width, height: 852}});
    const page = await context.newPage();
    const external = [], errors = [];
    page.on('request', r => {if (new URL(r.url()).origin !== new URL(url).origin) external.push(r.url());});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.getByRole('button', {name: 'Открыть комплектный тестовый каталог'}).click();
    await page.getByText('Каталог загружен: 132 рецептов. Данные черновые.', {exact: true}).waitFor();
    await page.locator('input[type=date]').fill('2026-11-09');
    for (const target of [1400, 1600, 1800, 2000]) {
      await page.getByLabel('Тестовый сценарий', {exact: true}).selectOption(String(target));
      assert.equal(await page.locator('article').count(), 0, 'Old week clears on target change');
      await page.getByRole('button', {name: 'Подобрать тестовую неделю', exact: true}).click();
      if (target === 2000) {
        await page.getByText('В проверенных списках не найден подходящий день.', {exact: false}).waitFor();
        assert.equal(await page.locator('article').count(), 0);
      } else {
        const days = page.getByRole('navigation', {name: 'Дни недели'}).getByRole('button');
        assert.equal(await days.count(), 7);
        for (let i = 0; i < 7; i++) {
          await days.nth(i).click();
          assert.equal(await page.locator('article').count(), 4);
          const recipe = page.getByText('Открыть рецепт', {exact: true}).first();
          await recipe.click();
          assert.ok(await page.locator('article').first().innerText().then(x => x.includes('Ингредиенты')));
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({width, target, status: target === 2000 ? 'EXPECTED_EMPTY_BOUNDED_SEARCH' : 'SEVEN_DAYS_FOUR_MEALS_RECIPE_DETAILS'});
    }
    await page.locator('input[type=file]').first().setInputFiles({name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}')});
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('article').count(), 0);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(JSON.stringify({status: 'PASS', scenarios: results, externalRequests: 0, pageErrors: 0}, null, 2));
} finally {await browser.close(); server.close();}
