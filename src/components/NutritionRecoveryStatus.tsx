import type { nutritionRecoveryPreviewView } from '../utils/nutritionRecovery';

type RecoveryPreviewView = ReturnType<typeof nutritionRecoveryPreviewView>;
const messages: Record<RecoveryPreviewView['phase'], string> = {
  empty: 'Данные плана пока недоступны для текущего аккаунта и недели.',
  loading: 'Проверяется актуальная версия плана. Действия временно недоступны.',
  unavailable: 'Не удалось получить актуальный план. Предыдущая версия не используется для новых отметок.',
  conflict: 'Версии плана не согласованы. Нужно обновить данные и заново проверить действие.',
  'outcome-unknown': 'Результат действия неизвестен. Это не подтверждение сохранения и не подтверждение ошибки. Не создавайте повторное действие.',
  'awaiting-outcome': 'Сценарий ожидает результат действия. Повторная отметка пока недоступна.',
  'refresh-required': 'Нужно получить свежую версию плана, согласованную с результатом действия.',
  'revision-mismatch': 'Экран относится к другой версии плана или цели. Старые отметки недоступны.',
  'graph-mismatch': 'Состав недельного экрана не совпадает с подтверждённой моделью. Действия пока недоступны.',
  ready: 'Версия недельного экрана согласована с моделью сценария. Доступен локальный предпросмотр действий.',
};

export default function NutritionRecoveryStatus({ view }: { view: RecoveryPreviewView }) {
  return <section role="status" aria-label="Состояние восстановления плана" className="space-y-2 rounded-xl bg-stone-100 p-4 text-sm text-stone-700">
    <p className="font-medium">Локальный сценарий восстановления</p>
    <p>{messages[view.phase]}</p>
    <p className="text-xs text-stone-500">Отправка запросов и запись в дневник выключены.</p>
    {view.phase === 'outcome-unknown' && <p>Повторная проверка должна использовать исходное действие, без создания новой записи.</p>}
  </section>;
}
