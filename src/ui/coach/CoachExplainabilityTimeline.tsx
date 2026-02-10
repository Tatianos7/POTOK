import CoachMemoryCard from './CoachMemoryCard';
import type { CoachDecisionHistoryItem } from '../../services/coachRuntime';

interface CoachExplainabilityTimelineProps {
  items: CoachDecisionHistoryItem[];
}

const CoachExplainabilityTimeline = ({ items }: CoachExplainabilityTimelineProps) => {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        Пока нет объяснений. Коуч вмешивается только когда это уместно.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <CoachMemoryCard
          key={item.decisionId}
          dateLabel={item.dateLabel}
          situation={item.decisionType}
          message={item.summary}
          reason={item.reason}
          sources={item.data_sources}
          impact={item.impact}
          mode={item.uiMode ?? 'support'}
        />
      ))}
    </div>
  );
};

export default CoachExplainabilityTimeline;
