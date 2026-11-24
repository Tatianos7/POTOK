import type {stagingChickenPrepPair} from '../services/stagingWeekSideDishes';

type Prep = NonNullable<ReturnType<typeof stagingChickenPrepPair>>;

export default function StagingChickenPrepCard({prep}: {prep: Prep}) {
  return <section className="mt-3 space-y-1 rounded-lg border p-3 text-sm" aria-label="Заготовка на два дня">
    <p className="font-semibold">Заготовка на два дня · тестовый расчёт</p>
    <p>{prep.preparesBase
      ? 'На два обеда запланированы 2 порции основы: 1 сегодня и 1 на следующий день.'
      : 'На сегодня запланирована 1 порция основы из общей заготовки.'}</p>
    {prep.preparesBase && <ul className="ml-4 list-disc">{prep.ingredients.map(ingredient =>
      <li key={ingredient.id}>{ingredient.name}{ingredient.weightG === null ? '' : ` — ${ingredient.weightG} г`}</li>
    )}</ul>}
    <p>Гарнир на сегодня — {prep.sideName}, {prep.sideDryGrams} г в сухом виде.</p>
    {prep.preparesBase
      ? <p>Порцию на завтра убери в холодильник при 4 °C или ниже в неглубоком закрытом контейнере. Сделай это в течение 2 часов после приготовления, а при жаре выше 32 °C — в течение часа.</p>
      : <p>Перед подачей разогрей основу до 74 °C по всей порции.</p>}
  </section>;
}
