import type { PoseAngles } from './poseMath';

export type ExerciseTemplateKey = 'squat' | 'deadlift' | 'bench';

export interface AngleRange {
  min: number;
  max: number;
}

export interface ExerciseTemplate {
  name: string;
  ranges: {
    knee: AngleRange;
    hip: AngleRange;
    spine: AngleRange;
    shoulder: AngleRange;
  };
}

export const EXERCISE_TEMPLATES: Record<ExerciseTemplateKey, ExerciseTemplate> = {
  squat: {
    name: 'Присед',
    ranges: {
      knee: { min: 70, max: 140 },
      hip: { min: 60, max: 140 },
      spine: { min: 140, max: 180 },
      shoulder: { min: 40, max: 120 },
    },
  },
  deadlift: {
    name: 'Становая тяга',
    ranges: {
      knee: { min: 120, max: 175 },
      hip: { min: 80, max: 160 },
      spine: { min: 150, max: 180 },
      shoulder: { min: 40, max: 120 },
    },
  },
  bench: {
    name: 'Жим лёжа',
    ranges: {
      knee: { min: 150, max: 180 },
      hip: { min: 150, max: 180 },
      spine: { min: 150, max: 180 },
      shoulder: { min: 40, max: 110 },
    },
  },
};

export interface TechniqueDeviation {
  joint: 'knee' | 'hip' | 'spine' | 'shoulder';
  observed: number;
  min: number;
  max: number;
  severity: 'green' | 'yellow' | 'red';
}

export const evaluateTechnique = (angles: PoseAngles, template: ExerciseTemplate): TechniqueDeviation[] => {
  const deviations: TechniqueDeviation[] = [];
  const { ranges } = template;

  const avgKnee = (angles.leftKnee + angles.rightKnee) / 2;
  const avgHip = (angles.leftHip + angles.rightHip) / 2;
  const avgShoulder = (angles.leftShoulder + angles.rightShoulder) / 2;

  const pushDeviation = (
    joint: TechniqueDeviation['joint'],
    observed: number,
    range: AngleRange
  ) => {
    const buffer = 10;
    let severity: TechniqueDeviation['severity'] = 'green';
    if (observed < range.min || observed > range.max) {
      severity = 'red';
    } else if (observed < range.min + buffer || observed > range.max - buffer) {
      severity = 'yellow';
    }
    deviations.push({ joint, observed, min: range.min, max: range.max, severity });
  };

  pushDeviation('knee', avgKnee, ranges.knee);
  pushDeviation('hip', avgHip, ranges.hip);
  pushDeviation('spine', angles.spine, ranges.spine);
  pushDeviation('shoulder', avgShoulder, ranges.shoulder);

  return deviations;
};

export const aggregateSeverity = (deviations: TechniqueDeviation[]): TechniqueDeviation['severity'] => {
  if (deviations.some((d) => d.severity === 'red')) return 'red';
  if (deviations.some((d) => d.severity === 'yellow')) return 'yellow';
  return 'green';
};
