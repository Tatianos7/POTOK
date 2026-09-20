import type { MealConfirmationChoice } from '../utils/nutritionAdaptation';
import type { NutritionMealAction } from '../types/nutritionPersistence';

const descriptions: Record<MealConfirmationChoice, { action: NutritionMealAction; title: string; consequence: string; detail: string }> = {
  'ate-as-planned': { action: 'CONSUMED_AS_PLANNED', title: 'Съел(а) по плану',
    consequence: 'После подтверждения в дневник попадёт точный состав и порция из выбранной версии плана.',
    detail: 'Сначала нужно проверить состав и порцию. Само наличие блюда в плане не означает, что оно съедено.' },
  'ate-with-changes': { action: 'CONSUMED_MODIFIED', title: 'Съел(а) с изменениями',
    consequence: 'В дневник попадут только продукты и порции, которые вы явно укажете как съеденные.',
    detail: 'Плановая порция не подставляется как съеденная. Для записи нужно уточнить фактический состав.' },
  'did-not-eat': { action: 'SKIPPED', title: 'Не ел(а)',
    consequence: 'Это отметка в плане. Запись о съеденной еде в дневнике не создаётся.',
    detail: 'Пропущенный приём не станет записью с нулём калорий и не сократит питание завтра.' },
  'extra-food': { action: 'EXTRA_FOOD', title: 'Было что-то ещё',
    consequence: 'Еда вне плана станет отдельной записью после указания продуктов, порций и подтверждения.',
    detail: 'Следующие блюда и дни не уменьшаются автоматически. Возможные изменения можно будет рассмотреть отдельно.' },
};

/** Copy reflects owner semantics; no command, transport or fabricated snapshot is constructed. */
export default function NutritionMealActionPreview({ choice, onClose }: { choice: MealConfirmationChoice; onClose: () => void }) {
  const description = descriptions[choice];
  return <section aria-label="Предпросмотр отметки" role="status" className="space-y-3 rounded-2xl bg-emerald-50 p-4">
    <h2 className="font-semibold">{description.title}</h2>
    <p className="text-sm text-stone-700">Это выбранное действие, не сохранённый факт. План и дневник не изменены.</p>
    <p className="text-sm">{description.consequence}</p>
    <p className="text-sm text-stone-600">{description.detail}</p>
    <button type="button" disabled className="rounded-lg bg-stone-200 px-3 py-2 text-sm text-stone-500">Сохранение пока недоступно</button>
    <button type="button" onClick={onClose} className="ml-3 px-3 py-2 text-sm">Закрыть</button>
  </section>;
}
