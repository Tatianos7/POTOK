import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import Button from '../ui/components/Button';
import {
  isPremiumCatalogStagingReadMode,
  premiumCatalogService,
  type PremiumRecipe as PremiumCatalogRecipe,
  type PremiumRecipeDetail as PremiumCatalogRecipeDetail,
} from '../services/premiumCatalogService';

interface PremiumRecipe {
  id: string;
  category: string;
  title: string;
  summary: string;
  time: string;
  note: string;
  calories: string;
  macros: string;
  ingredients: string[];
  portionHints: string[];
  steps: string[];
}

const categories = ['Завтраки', 'Обеды', 'Ужины', 'Перекусы', 'Быстро', 'Без сложной готовки'];

export const mockPremiumRecipes: PremiumRecipe[] = [
  {
    id: 'oatmeal-banana-yogurt',
    category: 'Завтрак',
    title: 'Овсянка с бананом и йогуртом',
    summary: 'Завтрак · 410 ккал · Б 24 · Ж 10 · У 58',
    time: '10 минут',
    note: 'без сложной готовки',
    calories: '410 ккал',
    macros: 'Б 24 · Ж 10 · У 58',
    ingredients: ['Овсянка — 50 г', 'Банан — 100 г', 'Йогурт — 150 г'],
    portionHints: ['Банан 100 г ≈ 1 средний банан', 'Йогурт 150 г ≈ небольшой стакан'],
    steps: [
      'Смешайте овсянку с йогуртом.',
      'Добавьте нарезанный банан.',
      'Оставьте на 5 минут или ешьте сразу.',
    ],
  },
  {
    id: 'chicken-rice-vegetables',
    category: 'Обед',
    title: 'Курица с рисом и овощами',
    summary: 'Обед · 520 ккал · Б 42 · Ж 14 · У 55',
    time: '25 минут',
    note: 'базовый рацион',
    calories: '520 ккал',
    macros: 'Б 42 · Ж 14 · У 55',
    ingredients: ['Курица — 160 г', 'Рис — 80 г', 'Овощи — 200 г'],
    portionHints: ['Курица 160 г ≈ ладонь', 'Рис 80 г ≈ небольшая миска'],
    steps: ['Приготовьте рис.', 'Добавьте курицу.', 'Подавайте с овощами.'],
  },
  {
    id: 'fish-salad',
    category: 'Ужин',
    title: 'Рыба с салатом',
    summary: 'Ужин · 430 ккал · Б 36 · Ж 18 · У 24',
    time: '20 минут',
    note: 'лёгкий ужин',
    calories: '430 ккал',
    macros: 'Б 36 · Ж 18 · У 24',
    ingredients: ['Рыба — 150 г', 'Салат — 180 г', 'Оливковое масло — 10 г'],
    portionHints: ['Рыба 150 г ≈ ладонь', 'Салат 180 г ≈ большая тарелка'],
    steps: ['Приготовьте рыбу.', 'Смешайте салат.', 'Добавьте масло и подавайте.'],
  },
  {
    id: 'cottage-cheese-berries',
    category: 'Перекус',
    title: 'Творог с ягодами',
    summary: 'Перекус · 290 ккал · Б 30 · Ж 8 · У 28',
    time: '5 минут',
    note: 'без готовки',
    calories: '290 ккал',
    macros: 'Б 30 · Ж 8 · У 28',
    ingredients: ['Творог — 180 г', 'Ягоды — 120 г', 'Орехи — 10 г'],
    portionHints: ['Творог 180 г ≈ небольшая пачка', 'Ягоды 120 г ≈ горсть'],
    steps: ['Выложите творог.', 'Добавьте ягоды.', 'Посыпьте орехами.'],
  },
];

function getInitialRecipeId(search: string) {
  return new URLSearchParams(search).get('recipe');
}

function formatMacroValue(value: number | null) {
  return value === null ? '0' : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCalories(value: number | null) {
  return `${value ?? 0} ккал`;
}

function mapCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized === 'breakfast') return 'Завтрак';
  if (normalized === 'lunch') return 'Обед';
  if (normalized === 'dinner') return 'Ужин';
  if (normalized === 'snack') return 'Перекус';
  return category || 'Рецепт';
}

function formatMacros(recipe: Pick<PremiumCatalogRecipe, 'protein' | 'fat' | 'carbs'>) {
  return `Б ${formatMacroValue(recipe.protein)} · Ж ${formatMacroValue(recipe.fat)} · У ${formatMacroValue(recipe.carbs)}`;
}

export function mapCatalogRecipeToPremiumRecipe(
  recipe: PremiumCatalogRecipe,
  detail?: PremiumCatalogRecipeDetail
): PremiumRecipe {
  const category = mapCategory(recipe.category);

  return {
    id: recipe.id,
    category,
    title: recipe.title,
    summary: `${category} · ${formatCalories(recipe.calories)} · ${formatMacros(recipe)}`,
    time: recipe.cookingTimeMin === null ? 'Без времени' : `${recipe.cookingTimeMin} минут`,
    note: recipe.difficultyLabel || 'Пока доступно как просмотр',
    calories: formatCalories(recipe.calories),
    macros: formatMacros(recipe),
    ingredients:
      detail?.ingredients.map((ingredient) => {
        const amount = ingredient.displayAmount || (ingredient.amountG === null ? '' : `${formatMacroValue(ingredient.amountG)} г`);
        return amount ? `${ingredient.name} — ${amount}` : ingredient.name;
      }) ?? [],
    portionHints: detail?.hints.map((hint) => hint.text) ?? [],
    steps: detail?.steps.map((step) => step.instruction) ?? [],
  };
}

const PremiumRecipes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const useStagingCatalog = isPremiumCatalogStagingReadMode();
  const [recipes, setRecipes] = useState<PremiumRecipe[]>(mockPremiumRecipes);
  const [recipeDetails, setRecipeDetails] = useState<Record<string, PremiumRecipe>>({});
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(() => getInitialRecipeId(location.search));
  const selectedRecipe = useMemo(
    () => (selectedRecipeId ? recipeDetails[selectedRecipeId] ?? recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null : null),
    [recipeDetails, recipes, selectedRecipeId]
  );

  useEffect(() => {
    if (!useStagingCatalog) return;

    let isCancelled = false;

    premiumCatalogService.getPremiumRecipeLibrary().then((result) => {
      if (isCancelled) return;
      if (result.ok && result.data.length > 0) {
        setRecipes(result.data.map((recipe) => mapCatalogRecipeToPremiumRecipe(recipe)));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [useStagingCatalog]);

  useEffect(() => {
    if (!useStagingCatalog || !selectedRecipeId || recipeDetails[selectedRecipeId]) return;

    let isCancelled = false;

    premiumCatalogService.getPremiumRecipeDetail(selectedRecipeId).then((result) => {
      if (isCancelled) return;
      if (result.ok && result.data) {
        const detail = result.data;
        setRecipeDetails((current) => ({
          ...current,
          [selectedRecipeId]: mapCatalogRecipeToPremiumRecipe(detail, detail),
        }));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [recipeDetails, selectedRecipeId, useStagingCatalog]);

  const renderHeader = (title: string, onBack?: () => void) => (
    <header className="relative flex h-12 items-center justify-center">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-stone-600"
          aria-label="Назад к сборнику"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <div className="absolute left-0 h-10 w-10" aria-hidden="true" />
      )}
      <h1 className="mx-12 max-w-[188px] truncate whitespace-nowrap text-center text-xl font-semibold leading-6 text-stone-950 min-[390px]:max-w-[260px]">
        {title}
      </h1>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute right-0 flex h-10 w-10 items-center justify-center rounded-full text-stone-600"
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </header>
  );

  if (selectedRecipe) {
    return (
      <div className="min-h-screen min-w-[320px] bg-stone-50">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-36 pt-[max(32px,env(safe-area-inset-top))]">
          {renderHeader(selectedRecipe.category, () => setSelectedRecipeId(null))}

          <main className="flex flex-1 flex-col gap-4 pb-8 pt-5">
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-lg font-semibold leading-6 text-stone-950">{selectedRecipe.title}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <p className="text-xs leading-4 text-emerald-700">Калории</p>
                  <p className="text-sm font-semibold leading-5 text-emerald-950">{selectedRecipe.calories}</p>
                </div>
                <div className="rounded-lg bg-stone-100 px-3 py-2">
                  <p className="text-xs leading-4 text-stone-500">КБЖУ</p>
                  <p className="text-sm font-semibold leading-5 text-stone-950">{selectedRecipe.macros}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-5 text-stone-600">
                {selectedRecipe.time} · {selectedRecipe.note}
              </p>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-semibold leading-5 text-stone-950">Ингредиенты</p>
              <div className="space-y-1.5">
                {selectedRecipe.ingredients.map((ingredient) => (
                  <div key={ingredient} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-5 text-stone-700">
                    {ingredient}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-semibold leading-5 text-stone-950">Подсказки без весов</p>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-sm leading-5 text-emerald-900">Без весов: используйте примерный ориентир.</p>
                <div className="mt-2 space-y-1 text-sm leading-5 text-emerald-800">
                  {selectedRecipe.portionHints.map((hint) => (
                    <p key={hint}>{hint}</p>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-2 pb-16">
              <p className="text-sm font-semibold leading-5 text-stone-950">Способ приготовления</p>
              <div className="space-y-1.5">
                {selectedRecipe.steps.map((step, index) => (
                  <div key={step} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-5 text-stone-700">
                    {index + 1}. {step}
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2">
            <p className="text-center text-xs leading-4 text-stone-500">
              Пока это просмотр: запись в план и дневник появится после подключения плана.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled fullWidth align="center">
                Добавить в план
              </Button>
              <Button variant="primary" size="sm" disabled fullWidth align="center">
                Добавить в дневник
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-[320px] bg-stone-50">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-8 pt-[max(32px,env(safe-area-inset-top))]">
        {renderHeader('Сборник рецептов')}

        <main className="flex flex-1 flex-col gap-4 pt-5">
          <p className="text-center text-sm leading-5 text-stone-600">
            Готовые рецепты POTOK с КБЖУ, граммовками и подсказками без весов.
          </p>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium leading-4 text-stone-700">
                {category}
              </span>
            ))}
          </div>

          <section className="space-y-2">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setSelectedRecipeId(recipe.id)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-sm"
              >
                <p className="text-sm font-semibold leading-5 text-stone-950">{recipe.title}</p>
                <p className="mt-1 text-xs leading-4 text-stone-600">{recipe.summary}</p>
                <p className="mt-1 text-xs leading-4 text-stone-500">
                  {recipe.time} · {recipe.note}
                </p>
              </button>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
};

export default PremiumRecipes;
