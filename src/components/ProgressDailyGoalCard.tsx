import { CheckCircle2, Circle, MinusCircle, Settings2 } from 'lucide-react';
import { useState } from 'react';
import {
  PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS,
  normalizeProgressDailyGoalPreferences,
  type ProgressDailyGoalItemId,
  type ProgressDailyGoalPreferences,
  type ProgressDailyGoalState,
} from '../utils/progressDailyGoal';

interface ProgressDailyGoalCardProps {
  state: ProgressDailyGoalState;
  onPreferencesChange?: (preferences: ProgressDailyGoalPreferences) => void;
}

const ITEM_OPTIONS: Array<{ id: ProgressDailyGoalItemId; label: string; helper: string }> = [
  { id: 'nutrition', label: 'Питание в рамках цели', helper: 'Влияет на сегодня и месяц' },
  { id: 'activity', label: 'Тренировка / активность', helper: 'Влияет на сегодня и месяц' },
  { id: 'water', label: 'Вода', helper: 'Только сегодня' },
  { id: 'progress', label: 'Проверить Progress', helper: 'UI-only' },
];

const OBJECTIVE_SETUP_ITEMS = new Set<ProgressDailyGoalItemId>(['nutrition', 'activity']);

const ProgressDailyGoalCard = ({ state, onPreferencesChange }: ProgressDailyGoalCardProps) => {
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [draftSelectedItemIds, setDraftSelectedItemIds] = useState<ProgressDailyGoalItemId[]>(state.selectedItemIds);
  const draftSelectedSet = new Set(draftSelectedItemIds);
  const hasDraftObjectiveItem = draftSelectedItemIds.some((itemId) => OBJECTIVE_SETUP_ITEMS.has(itemId));
  const canSaveSetup = draftSelectedItemIds.length > 0 && hasDraftObjectiveItem;

  const savePreferences = (preferences: ProgressDailyGoalPreferences) => {
    onPreferencesChange?.(normalizeProgressDailyGoalPreferences(preferences));
  };

  const openSetup = () => {
    setDraftSelectedItemIds(state.selectedItemIds);
    setIsSetupOpen(true);
  };

  const toggleEnabled = () => {
    if (state.enabled) {
      savePreferences({ enabled: false, selectedItemIds: state.selectedItemIds });
      setIsSetupOpen(false);
      return;
    }

    setDraftSelectedItemIds(state.selectedItemIds.length > 0 ? state.selectedItemIds : PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS);
    setIsSetupOpen(true);
  };

  const toggleDraftItem = (itemId: ProgressDailyGoalItemId) => {
    setDraftSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return PROGRESS_DAILY_GOAL_DEFAULT_SELECTED_ITEM_IDS.filter((defaultItemId) => next.has(defaultItemId));
    });
  };

  const saveSetup = () => {
    if (!canSaveSetup) return;
    savePreferences({ enabled: true, selectedItemIds: draftSelectedItemIds });
    setIsSetupOpen(false);
  };

  return (
    <section className="progress-daily-goal-card" aria-label={state.title}>
      <div className="progress-daily-goal-header">
        <div className="min-w-0">
          <p className="progress-summary-kicker">Сегодня</p>
          <h2 className="progress-summary-title">{state.title}</h2>
          <p className="progress-daily-goal-subtitle">{state.subtitle}</p>
        </div>
        <div className="progress-daily-goal-actions">
          <button
            type="button"
            className="progress-daily-goal-toggle"
            onClick={toggleEnabled}
            aria-pressed={state.enabled}
            aria-label={state.enabled ? 'Цель дня включена' : 'Цель дня выключена'}
          >
            {state.enabled ? 'Вкл' : 'Выкл'}
          </button>
          {state.enabled ? (
            <div className="progress-daily-goal-score" aria-label={state.progressText}>
              {state.completedCount}/{state.totalCount}
            </div>
          ) : null}
        </div>
      </div>

      {!state.enabled ? (
        <div className="progress-daily-goal-collapsed">
          <p>Помогает отмечать базовые действия и видеть прогресс за месяц.</p>
        </div>
      ) : (
        <>
          <div className="progress-daily-goal-meter" aria-hidden="true">
            <div style={{ width: `${state.totalCount > 0 ? (state.completedCount / state.totalCount) * 100 : 0}%` }} />
          </div>

          <div className="progress-daily-goal-list">
            {state.items.map((item) => {
              const Icon = item.completed ? CheckCircle2 : item.disabled ? MinusCircle : Circle;
              return (
                <div
                  key={item.id}
                  className={`progress-daily-goal-item ${item.completed ? 'is-complete' : ''} ${item.disabled ? 'is-disabled' : ''}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="progress-daily-goal-item-content">
                    <span className="progress-daily-goal-item-label">{item.label}</span>
                    {item.note ? <em className="progress-daily-goal-item-note">{item.note}</em> : null}
                  </span>
                </div>
              );
            })}
          </div>

          {state.periodMetrics ? (
            <div className="progress-daily-goal-periods" aria-label="Динамика цели дня за месяц">
              <span>
                <strong>Месяц</strong>
                {state.periodMetrics.monthCompletedDays}/{state.periodMetrics.monthTotalDays} дней
              </span>
            </div>
          ) : null}

          <div className={`progress-daily-goal-message ${state.isComplete ? 'is-success' : ''}`}>
            <strong>{state.messageTitle}</strong>
            <p>{state.periodMetrics?.conclusion ?? state.messageBody}</p>
          </div>

          <button type="button" className="progress-daily-goal-settings-button" onClick={openSetup}>
            <Settings2 size={15} aria-hidden="true" />
            Настроить пункты
          </button>
        </>
      )}

      {isSetupOpen ? (
        <div className="progress-daily-goal-setup" aria-label="Настройка цели дня">
          <div className="progress-daily-goal-setup-header">
            <strong>Пункты цели дня</strong>
            <span>Выберите, что показывать в карточке.</span>
          </div>
          <div className="progress-daily-goal-setup-options">
            {ITEM_OPTIONS.map((option) => (
              <label key={option.id} className="progress-daily-goal-setup-option">
                <input
                  type="checkbox"
                  checked={draftSelectedSet.has(option.id)}
                  onChange={() => toggleDraftItem(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <em>{option.helper}</em>
                </span>
              </label>
            ))}
          </div>
          {!canSaveSetup ? (
            <p className="progress-daily-goal-setup-warning">Оставьте питание или активность, чтобы месяц считался по фактам.</p>
          ) : null}
          <div className="progress-daily-goal-setup-actions">
            <button type="button" className="progress-daily-goal-secondary-action" onClick={() => setIsSetupOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="progress-daily-goal-primary-action"
              onClick={saveSetup}
              disabled={!canSaveSetup}
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ProgressDailyGoalCard;
