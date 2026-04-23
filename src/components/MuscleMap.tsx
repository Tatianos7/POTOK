import { useEffect, useMemo, useRef, useState } from 'react';
import type { MuscleKey } from '../constants/muscles';
import { BACK_MUSCLE_KEYS, FRONT_MUSCLE_KEYS } from '../constants/muscles';
import { buildExerciseMuscleConfig, splitMusclesByView } from '../utils/muscleMap';

type Props = {
  primary?: MuscleKey[];
  secondary?: MuscleKey[];
};

const DEFAULT_FILL = '#e5e7eb';
const PRIMARY_FILL = '#ef4444';
const SECONDARY_FILL = '#f59e0b';

function applyViewHighlight(
  container: HTMLDivElement | null,
  keys: readonly MuscleKey[],
  primary: readonly MuscleKey[],
  secondary: readonly MuscleKey[],
) {
  if (!container) return;

  keys.forEach((key) => {
    const element = container.querySelector<SVGElement>(`#${key}`);
    if (!element) return;
    element.setAttribute('fill', DEFAULT_FILL);
  });

  secondary.forEach((key) => {
    const element = container.querySelector<SVGElement>(`#${key}`);
    if (!element) return;
    element.setAttribute('fill', SECONDARY_FILL);
  });

  primary.forEach((key) => {
    const element = container.querySelector<SVGElement>(`#${key}`);
    if (!element) return;
    element.setAttribute('fill', PRIMARY_FILL);
  });
}

const MuscleMap = ({ primary = [], secondary = [] }: Props) => {
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const [frontSvg, setFrontSvg] = useState('');
  const [backSvg, setBackSvg] = useState('');

  const config = useMemo(() => buildExerciseMuscleConfig({ primary, secondary }), [primary, secondary]);
  const byView = useMemo(() => splitMusclesByView(config), [config]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetch('/muscles/body-front.svg').then((response) => response.text()),
      fetch('/muscles/body-back.svg').then((response) => response.text()),
    ]).then(([front, back]) => {
      if (cancelled) return;
      setFrontSvg(front);
      setBackSvg(back);
    }).catch(() => {
      if (cancelled) return;
      setFrontSvg('');
      setBackSvg('');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyViewHighlight(frontRef.current, FRONT_MUSCLE_KEYS, byView.front.primary, byView.front.secondary);
    applyViewHighlight(backRef.current, BACK_MUSCLE_KEYS, byView.back.primary, byView.back.secondary);
  }, [byView, frontSvg, backSvg]);

  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-gray-600">Front</div>
        <div ref={frontRef} dangerouslySetInnerHTML={{ __html: frontSvg }} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-gray-600">Back</div>
        <div ref={backRef} dangerouslySetInnerHTML={{ __html: backSvg }} />
      </div>
    </div>
  );
};

export default MuscleMap;
