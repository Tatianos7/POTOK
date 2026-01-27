import { borders, surfaces, typography } from '../theme/tokens';

interface TimelineItem {
  title: string;
  subtitle?: string;
  status?: 'active' | 'done' | 'upcoming';
}

interface TimelineProps {
  title?: string;
  items: TimelineItem[];
}

const statusColor: Record<NonNullable<TimelineItem['status']>, string> = {
  active: 'bg-emerald-500',
  done: 'bg-gray-400',
  upcoming: 'bg-gray-200',
};

const Timeline = ({ title, items }: TimelineProps) => {
  return (
    <div className={`rounded-2xl ${surfaces.card} ${borders.base} p-4`}>
      {title && <h3 className={`${typography.title} mb-3`}>{title}</h3>}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`w-3 h-3 rounded-full ${statusColor[item.status || 'upcoming']}`}
              />
              {index < items.length - 1 && <span className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />}
            </div>
            <div>
              <p className={typography.body}>{item.title}</p>
              {item.subtitle && <p className={typography.subtitle}>{item.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
