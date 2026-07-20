import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { webkit, type Request } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'ozidryfvhkcbtpnulakq';
const PRODUCTION_REF = 'dtsdnhbcwpbfrhcazqkb';
const REPORT_JSON = path.resolve(process.cwd(), 'reports/food-fiber-browser-regression-result.json');

const queries = [
  'Яйцо куриное',
  'Куриная грудка',
  'Куриное филе',
  'Помидор',
  'Картофель',
  'Огурец',
  'Яблоко',
  'Кефир 1,5%',
  'Кофе по-венски',
  'Баклажаны по-корейски',
];

declare global {
  interface Window {
    __fiberSmoke: {
      selected: any;
      setQuery: ((query: string) => void) | null;
      viteSupabaseUrl?: string;
    };
    __fiberSmokeSearch: (query: string) => Promise<any[]>;
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
    throw new Error('STAGING_SUPABASE_ANON_KEY is required');
  }
  if (stagingAnon === process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('staging anon key must not equal service-role key');
  }
  process.env.VITE_SUPABASE_URL = stagingUrl;
  process.env.VITE_SUPABASE_ANON_KEY = stagingAnon;
  delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  return { stagingUrl: stagingUrl as string, stagingRef };
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

const startVite = async (): Promise<{ server: ViteDevServer; url: string }> => {
  const html = `
<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module">
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import ProductSearch from '/src/components/ProductSearch.tsx';
      import { foodService } from '/src/services/foodService.ts';

      window.__fiberSmoke = { selected: null, setQuery: null, viteSupabaseUrl: import.meta.env?.VITE_SUPABASE_URL ?? '' };

      function SmokeApp() {
        const [query, setQuery] = useState('');
        window.__fiberSmoke.setQuery = setQuery;
        return React.createElement(ProductSearch, {
          value: query,
          onChangeQuery: setQuery,
          onSelect: (food) => { window.__fiberSmoke.selected = food; }
        });
      }

      window.__fiberSmokeSearch = async (query) => {
        const results = await foodService.search(query, { limit: 10 });
        return results.map((food) => ({
          id: food.id,
          canonical_food_id: food.canonical_food_id,
          name: food.name,
          fiber: food.fiber ?? null,
          calories: food.calories,
          protein: food.protein,
          fat: food.fat,
          carbs: food.carbs
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
        name: 'fiber-nullability-smoke-page',
        configureServer(viteServer) {
          viteServer.middlewares.use(async (req, res, next) => {
            if (req.url !== '/__fiber-nullability-smoke') {
              next();
              return;
            }
            const transformed = await viteServer.transformIndexHtml('/__fiber-nullability-smoke', html);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(transformed);
          });
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5187,
      strictPort: false,
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5187;
  return { server, url: `http://127.0.0.1:${port}/__fiber-nullability-smoke` };
};

async function main() {
  const { stagingUrl, stagingRef } = ensureStagingBrowserEnv();
  const serviceRole = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error('STAGING_SUPABASE_SERVICE_ROLE_KEY is required for read-only count checks');

  const initialCounts = await dbCounts(stagingUrl, serviceRole);
  const { server, url } = await startVite();
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);

  const productionRequests: string[] = [];
  const writeRequests: string[] = [];
  const networkErrors: string[] = [];
  const consoleErrors: string[] = [];
  const serviceRoleExposure = { detected: false };

  page.on('request', (request: Request) => {
    const requestUrl = request.url();
    if (requestUrl.includes(PRODUCTION_REF)) productionRequests.push(`${request.method()} ${requestUrl}`);
    if (requestUrl.includes(STAGING_REF) && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method())) {
      writeRequests.push(`${request.method()} ${requestUrl}`);
    }
    const auth = request.headers().authorization ?? '';
    if (auth.includes(serviceRole)) serviceRoleExposure.detected = true;
  });
  page.on('requestfailed', (request) => {
    networkErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    const loadedRef = await page.evaluate(() => {
      const raw = window.__fiberSmoke?.viteSupabaseUrl ?? '';
      return String(raw).match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1] ?? null;
    });

    const selections = [];
    for (const query of queries) {
      const results = await page.evaluate((value: string) => window.__fiberSmokeSearch(value), query);
      await page.evaluate((value: string) => {
        window.__fiberSmoke.selected = null;
        window.__fiberSmoke.setQuery?.(value);
      }, query);
      await page.waitForTimeout(900);
      await page.locator('button').filter({ hasText: 'Данные носят справочный характер' }).first().click();
      const selected = await page.evaluate(() => {
        const food = window.__fiberSmoke.selected;
        if (!food) return null;
        return {
          id: food.id ?? null,
          canonical_food_id: food.canonical_food_id ?? null,
          name: food.name ?? null,
          fiber: food.fiber == null ? null : food.fiber,
          calories: Number.isFinite(food.calories) ? food.calories : null,
          protein: Number.isFinite(food.protein) ? food.protein : null,
          fat: Number.isFinite(food.fat) ? food.fat : null,
          carbs: Number.isFinite(food.carbs) ? food.carbs : null,
        };
      });
      selections.push({ query, firstResult: results[0] ?? null, selected });
    }

    const finalCounts = await dbCounts(stagingUrl, serviceRole);
    const failedSelections = selections.filter(({ firstResult, selected }) => (
      !firstResult ||
      !selected ||
      !isUuid(selected.id) ||
      !isUuid(selected.canonical_food_id) ||
      firstResult.fiber !== null ||
      selected.fiber !== null ||
      [selected.calories, selected.protein, selected.fat, selected.carbs].some((value) => value === null)
    ));
    const critical =
      loadedRef !== STAGING_REF ||
      productionRequests.length > 0 ||
      writeRequests.length > 0 ||
      serviceRoleExposure.detected ||
      networkErrors.length > 0 ||
      consoleErrors.length > 0 ||
      failedSelections.length > 0 ||
      JSON.stringify(initialCounts) !== JSON.stringify(finalCounts);

    const report = {
      verdict: critical ? 'FIBER_BROWSER_REGRESSION_FAIL' : 'FIBER_BROWSER_REGRESSION_PASS',
      localUrl: url,
      loadedProjectRef: loadedRef,
      targetProjectRef: stagingRef,
      productionRequests,
      writeRequests,
      serviceRoleExposed: serviceRoleExposure.detected,
      networkErrors,
      consoleErrors,
      initialCounts,
      finalCounts,
      selections,
      failedSelections,
    };
    fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      verdict: report.verdict,
      localUrl: url,
      loadedProjectRef: loadedRef,
      selections: `${selections.length - failedSelections.length}/${selections.length}`,
      productionRequests: productionRequests.length,
      writeRequests: writeRequests.length,
      serviceRoleExposed: serviceRoleExposure.detected,
      initialCounts,
      finalCounts,
      report: REPORT_JSON,
    }, null, 2));
    if (critical) process.exitCode = 1;
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
