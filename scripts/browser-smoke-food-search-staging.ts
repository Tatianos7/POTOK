import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, type Browser, type ConsoleMessage, type Request } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'ozidryfvhkcbtpnulakq';
const PRODUCTION_REF = 'dtsdnhbcwpbfrhcazqkb';
const REPORT_JSON = path.resolve(process.cwd(), 'reports/food-search-browser-staging-smoke-result.json');

type SearchProbe = {
  query: string;
  expected: string;
};

type QueryResult = {
  query: string;
  visibleCount: number;
  firstFive: string[];
  relevantPresent: boolean;
  relevantPosition: number | null;
  duplicateVisibleRows: boolean;
  duplicateCanonicalIds: boolean;
  uuidAttached: boolean;
  selected?: {
    id: string | null;
    canonical_food_id: string | null;
    name: string | null;
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    fiber: number | null;
  };
  serviceFirstIds: string[];
  serviceFirstCanonicalIds: string[];
  serviceFirstNames: string[];
  pass: boolean;
  notes: string[];
};

declare global {
  interface Window {
    __smoke: {
      selected: any;
      results: any[];
      setQuery: ((query: string) => void) | null;
      viteSupabaseUrl?: string;
    };
    __smokeSearch: (query: string) => Promise<any[]>;
  }
}

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
};

const getProjectRef = (url: string | null | undefined): string | null => {
  const match = String(url ?? '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match?.[1] ?? null;
};

const isUuid = (value: unknown): boolean =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const ensureStagingBrowserEnv = () => {
  ['.env.local', '.env', '.env.staging.local'].forEach((fileName) => {
    loadEnvFile(path.resolve(process.cwd(), fileName));
  });
  const stagingUrl = process.env.STAGING_SUPABASE_URL;
  const stagingAnon = process.env.STAGING_SUPABASE_ANON_KEY;
  const stagingRef = getProjectRef(stagingUrl);
  if (stagingRef !== STAGING_REF) {
    throw new Error(`staging project ref mismatch: expected ${STAGING_REF}, got ${stagingRef ?? 'missing'}`);
  }
  if (!stagingAnon) {
    throw new Error('STAGING_SUPABASE_ANON_KEY is required for browser smoke');
  }
  if (stagingAnon === process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('staging anon key must not equal service-role key');
  }
  process.env.VITE_SUPABASE_URL = stagingUrl;
  process.env.VITE_SUPABASE_ANON_KEY = stagingAnon;
  delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  return { stagingUrl: stagingUrl as string, stagingRef };
};

const startVite = async (): Promise<{ server: ViteDevServer; url: string }> => {
  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Food Search Smoke</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import ProductSearch from '/src/components/ProductSearch.tsx';
      import { foodService } from '/src/services/foodService.ts';

      window.__smoke = { selected: null, results: [], setQuery: null };
      window.__smoke.viteSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL ?? '';

      function SmokeApp() {
        const [query, setQuery] = useState('');
        window.__smoke.setQuery = setQuery;
        return React.createElement('div', { style: { padding: '16px', maxWidth: '680px' } },
          React.createElement('h1', null, 'Food Search Smoke'),
          React.createElement('div', { id: 'query-label' }, query),
          React.createElement(ProductSearch, {
            value: query,
            hideInput: false,
            onChangeQuery: setQuery,
            onSelect: (food) => {
              window.__smoke.selected = food;
            }
          })
        );
      }

      window.__smokeSearch = async (query) => {
        const results = await foodService.search(query, { limit: 30 });
        window.__smoke.results = results;
        return results.map((food) => ({
          id: food.id,
          canonical_food_id: food.canonical_food_id,
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          fat: food.fat,
          carbs: food.carbs,
          fiber: food.fiber ?? null,
          source: food.source
        }));
      };

      createRoot(document.getElementById('root')).render(React.createElement(SmokeApp));
    </script>
  </body>
</html>`;

  const server = await createServer({
    root: process.cwd(),
    configFile: false,
    plugins: [
      react(),
      {
        name: 'food-search-smoke-page',
        configureServer(viteServer) {
          viteServer.middlewares.use(async (req, res, next) => {
            if (req.url !== '/__food-search-smoke') {
              next();
              return;
            }
            const transformed = await viteServer.transformIndexHtml('/__food-search-smoke', html);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(transformed);
          });
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5177,
      strictPort: false,
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5177;
  return { server, url: `http://127.0.0.1:${port}/__food-search-smoke` };
};

const waitForResults = async (page: any, query: string) => {
  await page.waitForFunction((expected: string) => {
    return document.getElementById('query-label')?.textContent === expected;
  }, query, { timeout: 3000 });
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('Общая база') || text.includes('Продукты не найдены');
  }, null, { timeout: 7000 });
};

const runProbe = async (page: any, probe: SearchProbe, shouldSelect = false): Promise<QueryResult> => {
  await page.evaluate((query: string) => {
    window.__smoke.selected = null;
    window.__smoke.setQuery(query);
  }, probe.query);

  const serviceResults = await page.evaluate((query: string) => window.__smokeSearch(query), probe.query);
  await waitForResults(page, probe.query);
  const visibleRows = await page.locator('button').evaluateAll((buttons: HTMLElement[]) =>
    buttons
      .map((button) => button.innerText.trim().replace(/\s+/g, ' '))
      .filter((text) => text && (text.includes('Данные носят справочный характер') || /Б:\s/.test(text)))
  );
  const firstFive = visibleRows.slice(0, 5);
  if (shouldSelect && visibleRows.length > 0) {
    await page.locator('button').filter({ hasText: 'Данные носят справочный характер' }).first().click();
  }
  const selected = await page.evaluate(() => {
      const food = window.__smoke.selected;
      if (!food) return null;
      return {
      id: food.id ?? null,
      canonical_food_id: food.canonical_food_id ?? null,
      name: food.name ?? null,
      calories: Number.isFinite(food.calories) ? food.calories : null,
      protein: Number.isFinite(food.protein) ? food.protein : null,
      fat: Number.isFinite(food.fat) ? food.fat : null,
      carbs: Number.isFinite(food.carbs) ? food.carbs : null,
      fiber: food.fiber == null ? null : (Number.isFinite(Number(food.fiber)) ? Number(food.fiber) : null),
    };
  });

  const serviceFirstIds = serviceResults.slice(0, 10).map((food: any) => food.id).filter(Boolean);
  const serviceFirstCanonicalIds = serviceResults.slice(0, 10).map((food: any) => food.canonical_food_id).filter(Boolean);
  const serviceFirstNames = serviceResults.slice(0, 10).map((food: any) => food.name).filter(Boolean);
  const relevantIndex = serviceFirstNames.findIndex((name: string) => name.toLowerCase().includes(probe.expected.toLowerCase()));
  const duplicateVisibleRows = new Set(visibleRows).size !== visibleRows.length;
  const duplicateCanonicalIds = new Set(serviceFirstCanonicalIds).size !== serviceFirstCanonicalIds.length;
  const uuidAttached = serviceFirstIds.some(isUuid) || serviceFirstCanonicalIds.some(isUuid);
  const notes: string[] = [];
  if (visibleRows.length === 0 && probe.expected !== 'NONE') notes.push('no visible results');
  if (!uuidAttached && probe.expected !== 'NONE') notes.push('no UUID in service results');
  if (duplicateVisibleRows) notes.push('duplicate visible row text');
  if (duplicateCanonicalIds) notes.push('duplicate canonical UUIDs');
  if (selected && (!isUuid(selected.id) || !isUuid(selected.canonical_food_id))) notes.push('selected result lacks UUID identity');
  if (selected && [selected.calories, selected.protein, selected.fat, selected.carbs].some((value) => value === null)) {
    notes.push('selected result missing macros');
  }
  if (selected && selected.fiber !== null) {
    notes.push('selected Food Core result did not preserve null fiber');
  }

  const relevantPresent = probe.expected === 'NONE'
    ? visibleRows.length === 0 && serviceResults.length === 0
    : serviceFirstNames.some((name: string) => name.toLowerCase().includes(probe.expected.toLowerCase()));
  const pass = probe.expected === 'NONE'
    ? visibleRows.length === 0 && serviceResults.length === 0
    : visibleRows.length > 0 && relevantPresent && uuidAttached && !duplicateCanonicalIds && !notes.some((note) => note.startsWith('selected'));

  return {
    query: probe.query,
    visibleCount: visibleRows.length,
    firstFive,
    relevantPresent,
    relevantPosition: relevantIndex >= 0 ? relevantIndex + 1 : null,
    duplicateVisibleRows,
    duplicateCanonicalIds,
    uuidAttached,
    selected: selected ?? undefined,
    serviceFirstIds,
    serviceFirstCanonicalIds,
    serviceFirstNames,
    pass,
    notes,
  };
};

const dbCounts = async (url: string, key: string) => {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const out: Record<string, number> = {};
  for (const table of ['foods', 'food_aliases', 'food_diary_entries', 'recipes', 'recipe_ingredients', 'favorite_products']) {
    const { count, error } = await client.from(table).select('*', { head: true, count: 'exact' });
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    out[table] = count ?? 0;
  }
  return out;
};

async function main() {
  const { stagingUrl, stagingRef } = ensureStagingBrowserEnv();
  const initialCounts = await dbCounts(stagingUrl, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY as string);
  const { server, url } = await startVite();
  let browser: Browser | null = null;
  let browserName = 'chromium';
  const launchErrors: string[] = [];
  for (const [name, launcher] of [
    ['webkit', webkit],
    ['chromium', chromium],
    ['firefox', firefox],
  ] as const) {
    try {
      browser = await launcher.launch({ headless: true });
      browserName = name;
      break;
    } catch (error) {
      launchErrors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!browser) {
    throw new Error(`No Playwright browser could be launched: ${launchErrors.join(' | ')}`);
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const consoleMessages: Array<{ type: string; text: string }> = [];
  const networkErrors: string[] = [];
  const productionRequests: string[] = [];
  const writeRequests: string[] = [];
  const serviceRoleExposure = { detected: false };

  page.on('console', (message: ConsoleMessage) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on('requestfailed', (request: Request) => {
    networkErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
  });
  page.on('request', (request: Request) => {
    const requestUrl = request.url();
    if (requestUrl.includes(PRODUCTION_REF)) productionRequests.push(`${request.method()} ${requestUrl}`);
    if (requestUrl.includes(STAGING_REF) && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method())) {
      writeRequests.push(`${request.method()} ${requestUrl}`);
    }
    const auth = request.headers().authorization ?? '';
    if (process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY && auth.includes(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY)) {
      serviceRoleExposure.detected = true;
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    const loadedRef = await page.evaluate(() => {
      const raw = window.__smoke?.viteSupabaseUrl ?? '';
      return String(raw).match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1] ?? null;
    });

    const canonical = [
      { query: 'яйцо', expected: 'Яйцо' },
      { query: 'молоко', expected: 'Молоко' },
      { query: 'кефир', expected: 'Кефир' },
      { query: 'творог', expected: 'Творог' },
      { query: 'сыр', expected: 'Сыр' },
      { query: 'курица', expected: 'Курица' },
      { query: 'гречка', expected: 'Греч' },
      { query: 'рис', expected: 'Рис' },
      { query: 'яблоко', expected: 'Яблоко' },
      { query: 'картофель', expected: 'Картофель' },
    ];
    const aliases = [
      { query: 'ацидофилин 0,1%', expected: 'Ацидофилин' },
      { query: 'ацидофилин 0.1%', expected: 'Ацидофилин' },
      { query: 'баклажаны по-корейски', expected: 'Баклажаны' },
      { query: 'баклажаны по корейски', expected: 'Баклажаны' },
      { query: 'кус-кус приготовленный', expected: 'Кус-кус' },
      { query: 'кус кус приготовленный', expected: 'Кус-кус' },
      { query: 'кефир 1,5%', expected: 'Кефир' },
      { query: 'кефир 1.5%', expected: 'Кефир' },
      { query: 'кофе по-венски', expected: 'Кофе' },
      { query: 'кофе по венски', expected: 'Кофе' },
    ];
    const unresolved = [
      { query: 'zzzz-not-food', expected: 'NONE' },
      { query: 'несуществующий продукт xyz', expected: 'NONE' },
      { query: 'еда из параллельной вселенной', expected: 'NONE' },
      { query: 'юююююю продукт', expected: 'NONE' },
      { query: 'квертифуд', expected: 'NONE' },
    ];
    const ambiguous = [
      { query: 'мол', expected: 'Мол' },
      { query: 'кеф', expected: 'Кеф' },
      { query: 'сыр', expected: 'Сыр' },
      { query: 'кур', expected: 'Кур' },
      { query: 'хлеб', expected: 'Хлеб' },
    ];
    const quality = ['хлеб', 'кофе', 'чай', 'йогурт', 'сыр', 'молоко', 'курица', 'рыба', 'рис', 'овсянка']
      .map((query) => ({ query, expected: query[0].toUpperCase() + query.slice(1) }));

    const canonicalResults: QueryResult[] = [];
    const aliasResults: QueryResult[] = [];
    const unresolvedResults: QueryResult[] = [];
    const ambiguousResults: QueryResult[] = [];
    const qualityResults: QueryResult[] = [];
    const selectedResults: QueryResult[] = [];

    for (const probe of canonical) canonicalResults.push(await runProbe(page, probe, false));
    for (const probe of aliases) aliasResults.push(await runProbe(page, probe, false));
    for (const probe of unresolved) unresolvedResults.push(await runProbe(page, probe, false));
    for (const probe of ambiguous) ambiguousResults.push(await runProbe(page, probe, false));
    for (const probe of quality) qualityResults.push(await runProbe(page, probe, false));
    for (const probe of [...canonical.slice(0, 5), ...aliases.slice(0, 5)]) {
      selectedResults.push(await runProbe(page, probe, true));
    }

    const finalCounts = await dbCounts(stagingUrl, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY as string);
    const report = {
      verdict: 'BROWSER_SEARCH_STAGING_PASS',
      browserLaunchCommand: 'node scripts/browser-smoke-food-search-staging.ts',
      browserName,
      browserLaunchErrors: launchErrors,
      localUrl: url,
      environmentMode: 'vite dev with explicit staging VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY',
      loadedProjectRef: loadedRef,
      targetProjectRef: stagingRef,
      productionRequests,
      serviceRoleExposed: serviceRoleExposure.detected,
      writeRequests,
      uiEntryPoint: 'virtual Vite smoke page importing real ProductSearch and foodService.search',
      initialCounts,
      finalCounts,
      canonicalResults,
      aliasResults,
      unresolvedResults,
      ambiguousResults,
      selectionResults: selectedResults,
      qualityResults,
      consoleMessages,
      networkErrors,
    };

    const critical =
      loadedRef !== STAGING_REF ||
      productionRequests.length > 0 ||
      serviceRoleExposure.detected ||
      writeRequests.length > 0 ||
      canonicalResults.some((item) => !item.pass) ||
      aliasResults.some((item) => !item.pass) ||
      unresolvedResults.some((item) => !item.pass) ||
      ambiguousResults.some((item) => !item.pass) ||
      selectedResults.some((item) => !item.selected || !isUuid(item.selected.id) || !isUuid(item.selected.canonical_food_id) || item.selected.fiber !== null) ||
      JSON.stringify(initialCounts) !== JSON.stringify(finalCounts);

    if (critical) {
      report.verdict = writeRequests.length > 0
        ? 'BROWSER_SMOKE_UNEXPECTED_DB_WRITE'
        : productionRequests.length > 0
          ? 'BROWSER_SMOKE_BLOCKED_PRODUCTION_REQUEST'
          : 'BROWSER_SEARCH_RUNTIME_FAIL';
      process.exitCode = 1;
    }

    fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      verdict: report.verdict,
      localUrl: url,
      loadedProjectRef: loadedRef,
      browserName,
      canonical: `${canonicalResults.filter((item) => item.pass).length}/${canonicalResults.length}`,
      aliases: `${aliasResults.filter((item) => item.pass).length}/${aliasResults.length}`,
      unresolved: `${unresolvedResults.filter((item) => item.pass).length}/${unresolvedResults.length}`,
      ambiguous: `${ambiguousResults.filter((item) => item.pass).length}/${ambiguousResults.length}`,
      selection: `${selectedResults.filter((item) => item.selected && isUuid(item.selected.id) && isUuid(item.selected.canonical_food_id)).length}/${selectedResults.length}`,
      productionRequests: productionRequests.length,
      writeRequests: writeRequests.length,
      serviceRoleExposed: serviceRoleExposure.detected,
      initialCounts,
      finalCounts,
      report: REPORT_JSON,
    }, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
}

const isCliEntry = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isCliEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
