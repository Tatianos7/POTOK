import type {AuthoringRecipe} from './authoringRecipeCatalog';

const number = (n: number) => n.toLocaleString('ru-RU', {maximumFractionDigits: 3});
const units: Record<string, string> = {G: 'г', ML: 'мл', PCS: 'шт.', PIECE: 'шт.', TSP: 'ч. л.', TBSP: 'ст. л.'};
export default function AuthoringRecipeDetails({recipe}: {recipe: AuthoringRecipe}) {
  return <section aria-label={`Рецепт: ${recipe.name}`} className="mt-3 space-y-3 text-sm">
    <p>Черновик из сборника · статус исходника: {recipe.status}. Данные ещё не подтверждены.</p>
    <p className="font-semibold">Ингредиенты на весь рецепт. В меню — одна порция по источнику.</p>
    <p>Заявлено порций: {recipe.servings === null ? 'не указано' : number(recipe.servings)}.
      {' '}Заявленный выход: {recipe.declaredYieldG === null ? 'не указан' : `${number(recipe.declaredYieldG)} г (по источнику)`}.
      {' '}Фактический выход и вес порции не подтверждены.</p>
    {!recipe.ingredients.length ? <p>Ингредиенты в исходнике отсутствуют.</p> : <ul className="list-disc space-y-2 pl-5">
      {recipe.ingredients.map(i => <li key={i.id}>
        <strong>{i.name}</strong>{i.optional ? ' · по желанию' : ''}
        <p>Количество: {i.amount === null ? 'не указано' : number(i.amount)}{i.unit ? ` ${units[i.unit] ?? i.unit}` : ' · единица не указана'}.
          {' '}Масса по источнику: {i.weightG === null ? 'не указана' : `${number(i.weightG)} г`}.</p>
        <p>Подготовка по источнику: {i.preparation ?? 'не уточнена'}.</p>
        {i.notes && <p className="whitespace-pre-wrap break-words">Примечание исходника: {i.notes}</p>}
      </li>)}
    </ul>}
    <p>Состояние для взвешивания показывается только там, где оно описано в исходнике. Миллилитры и штуки автоматически в граммы не переводятся.</p>
    <h5 className="font-semibold">Приготовление</h5>
    {!recipe.steps.length ? <p>Шаги приготовления в исходнике отсутствуют.</p> : <ol className="space-y-3">
      {recipe.steps.map(s => <li key={s.id}>
        <p className="whitespace-pre-wrap break-words"><strong>Шаг {s.order}.</strong> {s.instruction}</p>
        {s.duration !== null && <p>Время по источнику: {number(s.duration)} мин.</p>}
        {s.temperature !== null && <p>Температура по источнику: {number(s.temperature)} °C.</p>}
        {s.notes && <p className="whitespace-pre-wrap break-words">Примечание исходника: {s.notes}</p>}
      </li>)}
    </ol>}
    {recipe.notes && <details><summary>Заметки исходника — требуют проверки</summary><p className="whitespace-pre-wrap break-words">{recipe.notes}</p></details>}
  </section>;
}
