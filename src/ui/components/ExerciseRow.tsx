import { useEffect, useRef, useState } from 'react';
import Button from './Button';
import ExerciseActionMenu from './ExerciseActionMenu';
import { colors, spacing, typography } from '../theme/tokens';
import {
  WORKOUT_METRIC_OPTIONS,
  normalizeWorkoutMetricType,
} from '../../utils/workoutEntryMetric';
import type { WorkoutMetricType } from '../../types/workout';

type MetricPopupPlacement = {
  left: number;
  top: number;
};

const METRIC_POPUP_WIDTH = 152;
const METRIC_POPUP_ESTIMATED_HEIGHT = 220;
const METRIC_POPUP_MARGIN = 8;

function getCompactMetricLabel(metricType: WorkoutMetricType): string {
  switch (metricType) {
    case 'distance':
      return 'Дист';
    case 'bodyweight':
      return 'Свой вес';
    case 'time':
      return 'Время';
    case 'none':
      return 'Без метрики';
    case 'weight':
    default:
      return 'Вес';
  }
}

export function resolveExerciseMetricPopupPlacement(
  anchorRect: { left: number; right: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  popupSize: { width: number; height: number },
): MetricPopupPlacement {
  const left = Math.min(
    Math.max(METRIC_POPUP_MARGIN, anchorRect.right - popupSize.width),
    viewport.width - popupSize.width - METRIC_POPUP_MARGIN,
  );
  const downTop = anchorRect.bottom + 6;
  const upTop = anchorRect.top - popupSize.height - 6;
  const top = downTop + popupSize.height <= viewport.height - METRIC_POPUP_MARGIN
    ? Math.max(METRIC_POPUP_MARGIN, downTop)
    : Math.max(METRIC_POPUP_MARGIN, upTop);

  return { left, top };
}

interface ExerciseRowProps {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  unit?: string;
  valueText?: string;
  metricType?: WorkoutMetricType;
  onMetricTypeChange?: (metricType: WorkoutMetricType) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onNote?: () => void;
  onMedia?: () => void;
  onOpen?: () => void;
}

const ExerciseRow = ({
  name,
  sets,
  reps,
  weight,
  unit = 'кг',
  valueText,
  metricType = 'weight',
  onMetricTypeChange,
  onEdit,
  onDelete,
  onNote,
  onMedia,
  onOpen,
}: ExerciseRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [metricPopupOpen, setMetricPopupOpen] = useState(false);
  const [metricDraft, setMetricDraft] = useState<WorkoutMetricType>(normalizeWorkoutMetricType(metricType));
  const [metricPopupPlacement, setMetricPopupPlacement] = useState<MetricPopupPlacement>({ left: METRIC_POPUP_MARGIN, top: METRIC_POPUP_MARGIN });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const metricButtonRef = useRef<HTMLButtonElement | null>(null);
  const metricPopupRef = useRef<HTMLDivElement | null>(null);

  const handleEdit = onEdit ?? (() => console.log('edit', name));
  const handleDelete = onDelete ?? (() => console.log('delete', name));
  const handleNote = onNote ?? (() => console.log('note', name));
  const handleMedia = onMedia ?? (() => console.log('media', name));
  const safeMetricType = normalizeWorkoutMetricType(metricType);
  const hasMetricSelector = typeof onMetricTypeChange === 'function';
  const isOpenable = typeof onOpen === 'function';
  const handleOpen = () => onOpen?.();

  useEffect(() => {
    setMetricDraft(safeMetricType);
  }, [safeMetricType]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleScroll = () => setMenuOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!metricPopupOpen) return;
    const updatePlacement = () => {
      if (!metricButtonRef.current) return;
      const rect = metricButtonRef.current.getBoundingClientRect();
      setMetricPopupPlacement(
        resolveExerciseMetricPopupPlacement(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          { width: METRIC_POPUP_WIDTH, height: metricPopupRef.current?.offsetHeight ?? METRIC_POPUP_ESTIMATED_HEIGHT },
        ),
      );
    };
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (metricButtonRef.current?.contains(target)) return;
      if (metricPopupRef.current?.contains(target)) return;
      setMetricPopupOpen(false);
    };
    const handleScroll = () => updatePlacement();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMetricPopupOpen(false);
    };
    updatePlacement();
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [metricPopupOpen]);

  return (
    <div
      ref={rowRef}
      style={{ position: 'relative' }}
    >
      {menuOpen && (
        <ExerciseActionMenu
          open={menuOpen}
          anchorRef={rowRef}
          menuRef={menuRef}
          onClose={() => setMenuOpen(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNote={handleNote}
          onMedia={handleMedia}
        />
      )}
      {hasMetricSelector && metricPopupOpen && (
        <div
          ref={metricPopupRef}
          style={{
            position: 'fixed',
            left: metricPopupPlacement.left,
            top: metricPopupPlacement.top,
            width: METRIC_POPUP_WIDTH,
            maxWidth: 'calc(100vw - 16px)',
            zIndex: 80,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 10,
            boxShadow: '0 18px 36px rgba(0,0,0,0.16)',
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            {WORKOUT_METRIC_OPTIONS.map((option) => {
              const checked = metricDraft === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMetricDraft(option.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    color: colors.text.primary,
                    fontSize: 11,
                  }}
                >
                  <span>{getCompactMetricLabel(option.value)}</span>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: `1px solid ${checked ? '#22c55e' : colors.border}`,
                      background: checked ? '#22c55e' : 'transparent',
                    }}
                  />
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMetricDraft(safeMetricType);
                setMetricPopupOpen(false);
              }}
              style={{ border: 'none', background: 'transparent', color: colors.text.secondary, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Отменить
            </button>
            <button
              type="button"
              onClick={() => {
                onMetricTypeChange(metricDraft);
                setMetricPopupOpen(false);
              }}
              style={{ border: 'none', background: 'transparent', color: colors.success, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
            >
              ОК
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px minmax(0, 1fr)',
          alignItems: 'center',
          columnGap: 0,
          padding: `${spacing.sm}px 0`,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          ref={triggerRef}
          style={{ width: 24, height: 24, paddingLeft: 0, paddingRight: 0 }}
        >
          ⋮
        </Button>
        <div
          onClick={isOpenable ? handleOpen : undefined}
          onKeyDown={(event) => {
            if (!isOpenable) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleOpen();
            }
          }}
          role={isOpenable ? 'button' : undefined}
          tabIndex={isOpenable ? 0 : undefined}
          aria-label={isOpenable ? `Открыть карточку тренировки для ${name}` : undefined}
          data-workout-row-content={isOpenable ? 'true' : undefined}
          style={{
            display: 'grid',
            gridTemplateColumns: hasMetricSelector
              ? 'minmax(0, 1fr) 1px 48px 1px 48px 1px 92px'
              : 'minmax(0, 1fr) 1px 48px 1px 48px 1px 72px',
            alignItems: 'center',
            minWidth: 0,
            cursor: isOpenable ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              ...typography.body,
              fontSize: 'clamp(11px, 3.2vw, 14px)',
              lineHeight: '18px',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {name}
          </div>
          <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
          <div style={{ ...typography.body, fontSize: 'clamp(11px, 3vw, 14px)', textAlign: 'center' }}>{sets}</div>
          <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
          <div style={{ ...typography.body, fontSize: 'clamp(11px, 3vw, 14px)', textAlign: 'center' }}>{reps}</div>
          <div style={{ width: 1, height: '100%', backgroundColor: colors.border }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: hasMetricSelector ? 4 : 0 }}>
            {hasMetricSelector ? (
              <button
                ref={metricButtonRef}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMetricPopupOpen((open) => !open);
                }}
                style={{
                  border: '1px solid rgba(34,197,94,0.25)',
                  background: 'rgba(220,252,231,0.75)',
                  borderRadius: 8,
                  padding: '3px 6px',
                  fontSize: 'clamp(9px, 2.7vw, 10px)',
                  lineHeight: 1.1,
                  fontWeight: 600,
                  color: '#166534',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {getCompactMetricLabel(safeMetricType)} ▼
              </button>
            ) : null}
            <div style={{ ...typography.body, fontSize: 'clamp(11px, 3vw, 14px)', textAlign: 'center', lineHeight: '16px' }}>
              {valueText ?? `${weight} ${unit}`.trim()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseRow;
