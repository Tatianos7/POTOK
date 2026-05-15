import { useMemo } from 'react';

import { muscleMapRegions } from '../../data/muscles/muscleMapRegions';
import {
  normalizeMuscleKeys,
  type MuscleKey,
  type MuscleMapView,
} from '../../data/muscles/types';
import { BackMuscleSvg, FrontMuscleSvg, type Tone } from './MuscleMapSvg';

type MuscleMapProps = {
  primaryMuscles?: readonly unknown[];
  secondaryMuscles?: readonly unknown[];
  view?: MuscleMapView;
  className?: string;
  size?: 'default' | 'compact';
};

type ResolvedView = Exclude<MuscleMapView, 'auto'>;

function addRegionTone(
  nextMap: Map<string, Tone>,
  keys: readonly MuscleKey[],
  view: 'front' | 'back',
  tone: Tone,
) {
  keys.forEach((key) => {
    const regionIds = muscleMapRegions[key][view] ?? [];

    regionIds.forEach((regionId) => {
      if (tone === 'primary' || !nextMap.has(regionId)) {
        nextMap.set(regionId, tone);
      }
    });
  });
}

function resolveView(
  view: MuscleMapView,
  frontRegionCount: number,
  backRegionCount: number,
): ResolvedView {
  if (view !== 'auto') {
    return view;
  }

  if (frontRegionCount > 0 && backRegionCount > 0) {
    return 'split';
  }

  if (backRegionCount > 0) {
    return 'back';
  }

  return 'front';
}

function buildRegionToneMap(
  primaryMuscles: readonly MuscleKey[],
  secondaryMuscles: readonly MuscleKey[],
  view: 'front' | 'back',
) {
  const nextMap = new Map<string, Tone>();

  addRegionTone(nextMap, secondaryMuscles, view, 'secondary');
  addRegionTone(nextMap, primaryMuscles, view, 'primary');

  return nextMap;
}

function countRegions(keys: readonly MuscleKey[], view: 'front' | 'back') {
  return keys.reduce((count, key) => {
    return count + (muscleMapRegions[key][view]?.length ?? 0);
  }, 0);
}

export function MuscleMap({
  primaryMuscles = [],
  secondaryMuscles = [],
  view = 'auto',
  className = '',
  size = 'default',
}: MuscleMapProps) {
  const primary = useMemo(() => normalizeMuscleKeys(primaryMuscles), [primaryMuscles]);
  const secondary = useMemo(() => {
    const primarySet = new Set(primary);

    return normalizeMuscleKeys(secondaryMuscles).filter((key) => !primarySet.has(key));
  }, [primary, secondaryMuscles]);

  const frontRegionCount = useMemo(() => {
    return countRegions(primary, 'front') + countRegions(secondary, 'front');
  }, [primary, secondary]);

  const backRegionCount = useMemo(() => {
    return countRegions(primary, 'back') + countRegions(secondary, 'back');
  }, [primary, secondary]);

  const resolvedView = useMemo(() => {
    return resolveView(view, frontRegionCount, backRegionCount);
  }, [backRegionCount, frontRegionCount, view]);

  const frontRegionTones = useMemo(() => {
    return buildRegionToneMap(primary, secondary, 'front');
  }, [primary, secondary]);

  const backRegionTones = useMemo(() => {
    return buildRegionToneMap(primary, secondary, 'back');
  }, [primary, secondary]);

  const isCompact = size === 'compact';
  const wrapperClassName = isCompact ? 'mx-auto max-w-[320px]' : '';
  const splitGridClassName = isCompact ? 'grid gap-3 grid-cols-2' : 'grid gap-4 sm:grid-cols-2';
  const panelClassName = isCompact
    ? 'flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2.5 shadow-sm'
    : 'flex min-w-0 flex-1 flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm';
  const labelClassName = isCompact
    ? 'text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500'
    : 'text-xs font-medium uppercase tracking-[0.16em] text-slate-500';
  const svgClassName = isCompact
    ? 'h-auto max-h-[220px] w-full'
    : 'h-auto w-full';

  return (
    <div
      className={`w-full ${wrapperClassName} ${className}`.trim()}
      data-muscle-map
      data-muscle-map-view={resolvedView}
      data-muscle-map-size={size}
    >
      {resolvedView === 'split' ? (
        <div className={splitGridClassName}>
          <div className={panelClassName}>
            <span className={labelClassName}>
              Вид спереди
            </span>
            <FrontMuscleSvg regionTones={frontRegionTones} className={svgClassName} />
          </div>
          <div className={panelClassName}>
            <span className={labelClassName}>
              Вид сзади
            </span>
            <BackMuscleSvg regionTones={backRegionTones} className={svgClassName} />
          </div>
        </div>
      ) : (
        <div className={panelClassName}>
          <span className={labelClassName}>
            {resolvedView === 'back' ? 'Вид сзади' : 'Вид спереди'}
          </span>
          {resolvedView === 'back'
            ? <BackMuscleSvg regionTones={backRegionTones} className={svgClassName} />
            : <FrontMuscleSvg regionTones={frontRegionTones} className={svgClassName} />}
        </div>
      )}
    </div>
  );
}

export default MuscleMap;
