/**
 * Автотесты для парсера ингредиентов
 * Запуск: импортировать runParserTests и вызвать в консоли браузера
 */

import { parseRecipeText } from './recipeParser';

interface TestCase {
  input: string;
  expected: {
    name: string;
    amount: number | null;
    unit: 'g' | 'ml' | 'pcs' | null;
    amountText?: string;
  };
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    input: '250 г говядина постная',
    expected: { name: 'говядина постная', amount: 250, unit: 'g', amountText: '250 г' },
    description: 'Граммы перед названием',
  },
  {
    input: 'говядина постная 250 г',
    expected: { name: 'говядина постная', amount: 250, unit: 'g', amountText: '250 г' },
    description: 'Граммы после названия',
  },
  {
    input: '1–2 шт. морковки',
    expected: { name: 'морковь', amount: 1.5, unit: 'pcs', amountText: '1.5 шт' },
    description: 'Диапазон и штуки',
  },
  {
    input: 'чеснока 3 дольки',
    expected: { name: 'чеснок', amount: 3, unit: 'pcs', amountText: '3 шт' },
    description: 'Дольки чеснока',
  },
  {
    input: '1 ч.л. масла',
    expected: { name: 'масло', amount: 5, unit: 'ml', amountText: '1 ч.л.' },
    description: 'Чайная ложка перед названием',
  },
  {
    input: 'масла оливкового 1 ч.л.',
    expected: { name: 'масло оливковое', amount: 5, unit: 'ml', amountText: '1 ч.л.' },
    description: 'Чайная ложка после названия',
  },
  {
    input: '2 ст.л. муки',
    expected: { name: 'мука', amount: 30, unit: 'ml', amountText: '2 ст.л.' },
    description: 'Столовая ложка',
  },
  {
    input: '1 л молока',
    expected: { name: 'молоко', amount: 1000, unit: 'ml', amountText: '1000 мл' },
    description: 'Литры перед названием',
  },
  {
    input: 'молока 1 л',
    expected: { name: 'молоко', amount: 1000, unit: 'ml', amountText: '1000 мл' },
    description: 'Литры после названия',
  },
  {
    input: '10 гр сыра',
    expected: { name: 'сыр', amount: 10, unit: 'g', amountText: '10 г' },
    description: 'Сокращение "гр"',
  },
  {
    input: '0.5 ч.л. куркумы',
    expected: { name: 'куркума', amount: 2.5, unit: 'ml', amountText: '0.5 ч.л.' },
    description: 'Дробное количество ложек',
  },
  {
    input: '250-грамм говядина',
    expected: { name: 'говядина', amount: 250, unit: 'g', amountText: '250 г' },
    description: 'Число с дефисом и единицей',
  },
];

/**
 * Запуск всех тестов
 */
export function runAllTests(): { passed: number; failed: number; results: Array<{ test: TestCase; passed: boolean; error?: string }> } {
  console.log('🧪 Запуск автотестов парсера ингредиентов...\n');

  const results: Array<{ test: TestCase; passed: boolean; error?: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    try {
      const parsed = parseRecipeText(test.input);
      const result = parsed[0];

      if (!result) {
        results.push({
          test,
          passed: false,
          error: 'Не распарсилось',
        });
        failed++;
        continue;
      }

      const checks = [
        result.name === test.expected.name,
        result.amount === test.expected.amount,
        result.unit === test.expected.unit,
      ];

      // Проверяем amountText, если указан
      if (test.expected.amountText) {
        checks.push(result.amountText === test.expected.amountText);
      }

      const allPassed = checks.every((c) => c);

      if (allPassed) {
        results.push({ test, passed: true });
        passed++;
        console.log(`✅ PASS: "${test.input}" (${test.description})`);
        console.log(`   → name: "${result.name}", amount: ${result.amount}, unit: ${result.unit}`);
      } else {
        const errors: string[] = [];
        if (result.name !== test.expected.name) {
          errors.push(`name: ожидалось "${test.expected.name}", получено "${result.name}"`);
        }
        if (result.amount !== test.expected.amount) {
          errors.push(`amount: ожидалось ${test.expected.amount}, получено ${result.amount}`);
        }
        if (result.unit !== test.expected.unit) {
          errors.push(`unit: ожидалось ${test.expected.unit}, получено ${result.unit}`);
        }
        if (test.expected.amountText && result.amountText !== test.expected.amountText) {
          errors.push(`amountText: ожидалось "${test.expected.amountText}", получено "${result.amountText}"`);
        }

        results.push({
          test,
          passed: false,
          error: errors.join('; '),
        });
        failed++;
        console.error(`❌ FAIL: "${test.input}" (${test.description})`);
        console.error(`   ${errors.join('; ')}`);
      }
    } catch (error) {
      results.push({
        test,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
      console.error(`❌ ERROR: "${test.input}" - ${error}`);
    }
  }

  console.log(`\n📊 Результаты: ${passed} прошло, ${failed} провалено из ${TEST_CASES.length}`);

  return { passed, failed, results };
}

// Экспортируем тесты для использования в консоли браузера
if (typeof window !== 'undefined') {
  (window as any).runParserTests = runAllTests;
}

