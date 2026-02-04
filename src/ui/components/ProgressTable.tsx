import { colors, radius, spacing, typography } from '../theme/tokens';
import type { TrendDirection } from '../../types/progressDashboard';

export interface ProgressTableCell {
  value: string;
  trend?: TrendDirection;
}

export interface ProgressTableRow {
  id: string;
  label: string;
  cells: Record<string, ProgressTableCell | null>;
}

interface ProgressTableProps {
  columns: string[];
  rows: ProgressTableRow[];
  rowHeaderLabel?: string;
  emptyLabel?: string;
  layout?: 'table' | 'stacked';
}

const trendSymbol: Record<TrendDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

const trendColor: Record<TrendDirection, string> = {
  up: colors.success,
  down: colors.danger,
  flat: colors.text.muted,
};

const ProgressTable = ({
  columns,
  rows,
  rowHeaderLabel = 'Показатель',
  emptyLabel,
  layout = 'table',
}: ProgressTableProps) => {
  if (rows.length === 0) {
    return (
      <div style={{ ...typography.subtitle, padding: spacing.sm }}>
        {emptyLabel || 'Нет данных для таблицы.'}
      </div>
    );
  }

  if (layout === 'stacked') {
    return (
      <div className="flex flex-col" style={{ gap: spacing.sm }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              padding: spacing.sm,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.xs,
            }}
          >
            <div style={typography.body}>{row.label}</div>
            {columns.map((column) => {
              const cell = row.cells[column];
              return (
                <div
                  key={`${row.id}-${column}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                  }}
                >
                  <span style={typography.micro}>{column}</span>
                  <span style={typography.body}>{cell?.value ?? '—'}</span>
                  {cell?.trend && (
                    <span style={{ fontSize: typography.micro.fontSize, color: trendColor[cell.trend] }}>
                      {trendSymbol[cell.trend]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 520 }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `160px repeat(${columns.length}, minmax(120px, 1fr))`,
            gap: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          <div style={{ ...typography.micro, padding: `0 ${spacing.sm}px` }}>{rowHeaderLabel}</div>
          {columns.map((label) => (
            <div key={label} style={{ ...typography.micro, textAlign: 'center' }}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex flex-col" style={{ gap: spacing.xs }}>
          {rows.map((row) => (
            <div
              key={row.id}
              className="grid"
              style={{
                gridTemplateColumns: `160px repeat(${columns.length}, minmax(120px, 1fr))`,
                gap: spacing.xs,
              }}
            >
              <div
                style={{
                  ...typography.body,
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  borderRadius: radius.sm,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                {row.label}
              </div>
              {columns.map((column) => {
                const cell = row.cells[column];
                return (
                  <div
                    key={`${row.id}-${column}`}
                    style={{
                      borderRadius: radius.sm,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surface,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.xs,
                      minHeight: 32,
                    }}
                  >
                    <span style={typography.body}>{cell?.value ?? '—'}</span>
                    {cell?.trend && (
                      <span style={{ fontSize: typography.micro.fontSize, color: trendColor[cell.trend] }}>
                        {trendSymbol[cell.trend]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProgressTable;
