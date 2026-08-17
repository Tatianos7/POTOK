import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import type { ProgressDailyGoalState } from '../utils/progressDailyGoal';

interface ProgressDailyGoalCardProps {
  state: ProgressDailyGoalState;
}

const ProgressDailyGoalCard = ({ state }: ProgressDailyGoalCardProps) => {
  return (
    <section className="progress-daily-goal-card" aria-label={state.title}>
      <div className="progress-daily-goal-header">
        <div className="min-w-0">
          <p className="progress-summary-kicker">Сегодня</p>
          <h2 className="progress-summary-title">{state.title}</h2>
          <p className="progress-daily-goal-subtitle">{state.subtitle}</p>
        </div>
        <div className="progress-daily-goal-score" aria-label={state.progressText}>
          {state.completedCount}/{state.totalCount}
        </div>
      </div>

      <div className="progress-daily-goal-meter" aria-hidden="true">
        <div style={{ width: `${(state.completedCount / state.totalCount) * 100}%` }} />
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
    </section>
  );
};

export default ProgressDailyGoalCard;
