import { useMemo } from 'react';

import { muscleMapRegions } from '../../data/muscles/muscleMapRegions';
import {
  normalizeMuscleKeys,
  type MuscleKey,
  type MuscleMapView,
} from '../../data/muscles/types';

type MuscleMapProps = {
  primaryMuscles?: readonly unknown[];
  secondaryMuscles?: readonly unknown[];
  view?: MuscleMapView;
  className?: string;
};

type ResolvedView = Exclude<MuscleMapView, 'auto'>;
type Tone = 'primary' | 'secondary';

const SVG_WIDTH = 168;
const SVG_HEIGHT = 300;
const BASE_FILL = '#F3F4F6';
const BASE_STROKE = '#CBD5E1';
const PRIMARY_FILL = '#22C55E';
const SECONDARY_FILL = '#BBF7D0';
const PRIMARY_STROKE = '#15803D';
const SECONDARY_STROKE = '#4ADE80';

function getToneColors(tone?: Tone) {
  if (tone === 'primary') {
    return { fill: PRIMARY_FILL, stroke: PRIMARY_STROKE };
  }

  if (tone === 'secondary') {
    return { fill: SECONDARY_FILL, stroke: SECONDARY_STROKE };
  }

  return { fill: BASE_FILL, stroke: BASE_STROKE };
}

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

function renderFrontSvg(regionTones: Map<string, Tone>) {
  const region = (id: string) => getToneColors(regionTones.get(id));

  return (
    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <g fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1.5">
        <circle cx="84" cy="28" r="20" />
        <rect x="68" y="48" width="32" height="18" rx="12" />
        <rect x="45" y="58" width="78" height="86" rx="34" />
        <rect x="22" y="70" width="24" height="82" rx="12" />
        <rect x="122" y="70" width="24" height="82" rx="12" />
        <rect x="57" y="138" width="54" height="44" rx="18" />
        <rect x="52" y="174" width="28" height="94" rx="14" />
        <rect x="88" y="174" width="28" height="94" rx="14" />
      </g>

      <g strokeWidth="1.5">
        <g id="front_neck" {...region('front_neck')}>
          <rect x="74" y="46" width="20" height="18" rx="8" />
        </g>
        <g id="front_delts" {...region('front_delts')}>
          <ellipse cx="53" cy="78" rx="14" ry="15" />
          <ellipse cx="115" cy="78" rx="14" ry="15" />
        </g>
        <g id="side_delts" {...region('side_delts')}>
          <ellipse cx="45" cy="93" rx="10" ry="15" />
          <ellipse cx="123" cy="93" rx="10" ry="15" />
        </g>
        <g id="upper_chest" {...region('upper_chest')}>
          <rect x="58" y="66" width="52" height="18" rx="8" />
        </g>
        <g id="chest" {...region('chest')}>
          <ellipse cx="67" cy="96" rx="18" ry="22" />
          <ellipse cx="101" cy="96" rx="18" ry="22" />
        </g>
        <g id="serratus" {...region('serratus')}>
          <rect x="50" y="109" width="14" height="24" rx="6" />
          <rect x="104" y="109" width="14" height="24" rx="6" />
        </g>
        <g id="biceps" {...region('biceps')}>
          <rect x="26" y="83" width="14" height="35" rx="7" />
          <rect x="128" y="83" width="14" height="35" rx="7" />
        </g>
        <g id="forearms" {...region('forearms')}>
          <rect x="23" y="118" width="14" height="40" rx="7" />
          <rect x="131" y="118" width="14" height="40" rx="7" />
        </g>
        <g id="obliques_front" {...region('obliques_front')}>
          <rect x="48" y="132" width="14" height="30" rx="7" />
          <rect x="106" y="132" width="14" height="30" rx="7" />
        </g>
        <g id="abs" {...region('abs')}>
          <rect x="67" y="126" width="34" height="46" rx="10" />
        </g>
        <g id="hip_flexors" {...region('hip_flexors')}>
          <rect x="66" y="170" width="36" height="12" rx="6" />
        </g>
        <g id="core_front" {...region('core_front')}>
          <rect x="61" y="120" width="46" height="62" rx="14" />
        </g>
        <g id="adductors" {...region('adductors')}>
          <rect x="68" y="184" width="12" height="56" rx="6" />
          <rect x="88" y="184" width="12" height="56" rx="6" />
        </g>
        <g id="quads" {...region('quads')}>
          <rect x="52" y="184" width="16" height="72" rx="8" />
          <rect x="100" y="184" width="16" height="72" rx="8" />
        </g>
        <g id="tibialis_anterior" {...region('tibialis_anterior')}>
          <rect x="56" y="254" width="12" height="26" rx="6" />
          <rect x="100" y="254" width="12" height="26" rx="6" />
        </g>
        <g id="calves_front" {...region('calves_front')}>
          <rect x="53" y="246" width="18" height="34" rx="9" />
          <rect x="97" y="246" width="18" height="34" rx="9" />
        </g>
      </g>
    </svg>
  );
}

function renderBackSvg(regionTones: Map<string, Tone>) {
  const region = (id: string) => getToneColors(regionTones.get(id));

  return (
    <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="h-auto w-full" aria-hidden="true">
      <g fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1.5">
        <circle cx="84" cy="28" r="20" />
        <rect x="68" y="48" width="32" height="18" rx="12" />
        <rect x="45" y="58" width="78" height="86" rx="34" />
        <rect x="22" y="70" width="24" height="82" rx="12" />
        <rect x="122" y="70" width="24" height="82" rx="12" />
        <rect x="57" y="138" width="54" height="44" rx="18" />
        <rect x="52" y="174" width="28" height="94" rx="14" />
        <rect x="88" y="174" width="28" height="94" rx="14" />
      </g>

      <g strokeWidth="1.5">
        <g id="traps_upper" {...region('traps_upper')}>
          <rect x="62" y="58" width="44" height="16" rx="8" />
        </g>
        <g id="trapezoid" {...region('trapezoid')}>
          <rect x="56" y="70" width="56" height="32" rx="10" />
        </g>
        <g id="supraspinatus" {...region('supraspinatus')}>
          <rect x="54" y="72" width="14" height="14" rx="6" />
          <rect x="100" y="72" width="14" height="14" rx="6" />
        </g>
        <g id="rear_delts" {...region('rear_delts')}>
          <ellipse cx="53" cy="84" rx="14" ry="15" />
          <ellipse cx="115" cy="84" rx="14" ry="15" />
        </g>
        <g id="traps_middle" {...region('traps_middle')}>
          <rect x="60" y="94" width="48" height="16" rx="8" />
        </g>
        <g id="rhomboids" {...region('rhomboids')}>
          <rect x="62" y="108" width="44" height="24" rx="10" />
        </g>
        <g id="teres_major" {...region('teres_major')}>
          <rect x="50" y="108" width="14" height="24" rx="6" />
          <rect x="104" y="108" width="14" height="24" rx="6" />
        </g>
        <g id="lats" {...region('lats')}>
          <ellipse cx="58" cy="126" rx="16" ry="28" />
          <ellipse cx="110" cy="126" rx="16" ry="28" />
        </g>
        <g id="triceps" {...region('triceps')}>
          <rect x="26" y="88" width="14" height="40" rx="7" />
          <rect x="128" y="88" width="14" height="40" rx="7" />
        </g>
        <g id="forearms_back" {...region('forearms_back')}>
          <rect x="23" y="127" width="14" height="40" rx="7" />
          <rect x="131" y="127" width="14" height="40" rx="7" />
        </g>
        <g id="erectors" {...region('erectors')}>
          <rect x="71" y="128" width="10" height="42" rx="5" />
          <rect x="87" y="128" width="10" height="42" rx="5" />
        </g>
        <g id="lower_back" {...region('lower_back')}>
          <rect x="66" y="162" width="36" height="14" rx="7" />
        </g>
        <g id="core_back" {...region('core_back')}>
          <rect x="62" y="124" width="44" height="54" rx="14" />
        </g>
        <g id="obliques_back" {...region('obliques_back')}>
          <rect x="52" y="146" width="12" height="22" rx="6" />
          <rect x="104" y="146" width="12" height="22" rx="6" />
        </g>
        <g id="glutes" {...region('glutes')}>
          <ellipse cx="68" cy="188" rx="18" ry="16" />
          <ellipse cx="100" cy="188" rx="18" ry="16" />
        </g>
        <g id="abductors" {...region('abductors')}>
          <rect x="49" y="188" width="12" height="52" rx="6" />
          <rect x="107" y="188" width="12" height="52" rx="6" />
        </g>
        <g id="hamstrings" {...region('hamstrings')}>
          <rect x="60" y="202" width="16" height="60" rx="8" />
          <rect x="92" y="202" width="16" height="60" rx="8" />
        </g>
        <g id="calves" {...region('calves')}>
          <rect x="56" y="246" width="18" height="34" rx="9" />
          <rect x="94" y="246" width="18" height="34" rx="9" />
        </g>
      </g>
    </svg>
  );
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

  const panelClassName =
    'flex min-w-0 flex-1 flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm';

  return (
    <div
      className={`w-full ${className}`.trim()}
      data-muscle-map
      data-muscle-map-view={resolvedView}
    >
      {resolvedView === 'split' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={panelClassName}>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Вид спереди
            </span>
            {renderFrontSvg(frontRegionTones)}
          </div>
          <div className={panelClassName}>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Вид сзади
            </span>
            {renderBackSvg(backRegionTones)}
          </div>
        </div>
      ) : (
        <div className={panelClassName}>
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {resolvedView === 'back' ? 'Вид сзади' : 'Вид спереди'}
          </span>
          {resolvedView === 'back' ? renderBackSvg(backRegionTones) : renderFrontSvg(frontRegionTones)}
        </div>
      )}
    </div>
  );
}

export default MuscleMap;
