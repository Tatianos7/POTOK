import { colors, radius, spacing, typography } from '../theme/tokens';

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
  active: colors.success,
  done: colors.text.muted,
  upcoming: colors.border,
};

const Timeline = ({ title, items }: TimelineProps) => {
  return (
    <div
      className="flex flex-col"
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      {title && <h3 style={{ ...typography.title, marginBottom: spacing.sm }}>{title}</h3>}
      <div className="flex flex-col" style={{ gap: spacing.sm }}>
        {items.map((item, index) => (
          <div key={`${item.title}-${index}`} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: radius.pill,
                  backgroundColor: statusColor[item.status || 'upcoming'],
                }}
              />
              {index < items.length - 1 && (
                <span style={{ width: 1, flex: 1, backgroundColor: colors.border }} />
              )}
            </div>
            <div>
              <p style={typography.body}>{item.title}</p>
              {item.subtitle && <p style={typography.subtitle}>{item.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
