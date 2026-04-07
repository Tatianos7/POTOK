import type {
  WorkoutProgressMetricTrend,
  WorkoutProgressObservation,
  WorkoutProgressRow,
} from '../types/workout';

export interface WorkoutProgressGroup {
  exerciseGroupKey: string;
  exerciseName: string;
  observations: WorkoutProgressObservation[];
}

const STABILIZATION_TAIL_LENGTH = 3;

function compareObservations(a: WorkoutProgressObservation, b: WorkoutProgressObservation): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
    a.entryId.localeCompare(b.entryId)
  );
}

function collapseObservationsByDay(observations: WorkoutProgressObservation[]): WorkoutProgressObservation[] {
  const byDate = new Map<string, WorkoutProgressObservation>();

  observations
    .slice()
    .sort(compareObservations)
    .forEach((observation) => {
      byDate.set(observation.date, observation);
    });

  return Array.from(byDate.values()).sort(compareObservations);
}

function takeObservationsUntil(
  observations: WorkoutProgressObservation[],
  targetObservation: WorkoutProgressObservation,
): WorkoutProgressObservation[] {
  return observations.filter((observation) => compareObservations(observation, targetObservation) <= 0);
}

export function groupWorkoutProgressRows(observations: WorkoutProgressObservation[]): WorkoutProgressGroup[] {
  const groups = new Map<string, WorkoutProgressGroup>();

  observations.forEach((observation) => {
    const existing = groups.get(observation.exerciseGroupKey);
    if (existing) {
      existing.observations.push(observation);
      existing.exerciseName = observation.exerciseName;
      return;
    }

    groups.set(observation.exerciseGroupKey, {
      exerciseGroupKey: observation.exerciseGroupKey,
      exerciseName: observation.exerciseName,
      observations: [observation],
    });
  });

  return Array.from(groups.values())
    .map((group) => {
      const observationsForGroup = group.observations.slice().sort(compareObservations);
      const lastObservation = observationsForGroup[observationsForGroup.length - 1];
      return {
        exerciseGroupKey: group.exerciseGroupKey,
        exerciseName: lastObservation?.exerciseName ?? group.exerciseName,
        observations: observationsForGroup,
      };
    })
    .sort((a, b) => {
      const lastA = a.observations[a.observations.length - 1];
      const lastB = b.observations[b.observations.length - 1];
      return (
        (lastB?.date ?? '').localeCompare(lastA?.date ?? '') ||
        a.exerciseName.localeCompare(b.exerciseName, 'ru')
      );
    });
}

export function getWorkoutMetricTrend(values: number[]): WorkoutProgressMetricTrend {
  if (values.length <= 1) {
    return 'neutral';
  }

  if (values.every((value) => value === values[0])) {
    return 'neutral';
  }

  const latest = values[values.length - 1];
  let tailLength = 1;
  for (let index = values.length - 2; index >= 0; index -= 1) {
    if (values[index] !== latest) {
      break;
    }
    tailLength += 1;
  }

  if (tailLength >= STABILIZATION_TAIL_LENGTH) {
    return 'neutral';
  }

  let stabilizedRunEndIndex = -1;
  let runStart = 0;
  while (runStart < values.length - 1) {
    let runEnd = runStart;
    while (runEnd + 1 < values.length && values[runEnd + 1] === values[runStart]) {
      runEnd += 1;
    }

    const runLength = runEnd - runStart + 1;
    if (runLength >= STABILIZATION_TAIL_LENGTH && runEnd < values.length - 1) {
      stabilizedRunEndIndex = runEnd;
    }

    runStart = runEnd + 1;
  }

  const activeValues = stabilizedRunEndIndex >= 0 ? values.slice(stabilizedRunEndIndex) : values.slice();
  if (activeValues.length <= 1) {
    return 'neutral';
  }

  const c = activeValues[activeValues.length - 1];
  const b = activeValues[activeValues.length - 2];
  const priorValues = activeValues.slice(0, -1);
  const priorMax = Math.max(...priorValues);
  const priorMin = Math.min(...priorValues);

  if (c > priorMax) {
    return 'up';
  }

  if (c === b) {
    return 'neutral';
  }

  if (c < priorMin) {
    return 'down';
  }

  if (priorMax > priorMin) {
    return 'return';
  }

  return c > b ? 'up' : 'down';
}

export function buildWorkoutProgressList(
  displayObservations: WorkoutProgressObservation[],
  trendHistoryObservations: WorkoutProgressObservation[] = displayObservations,
): WorkoutProgressRow[] {
  const historyByGroup = new Map(
    groupWorkoutProgressRows(trendHistoryObservations).map((group) => [group.exerciseGroupKey, group]),
  );

  return groupWorkoutProgressRows(displayObservations)
    .map((group) => {
      const collapsedDisplayObservations = collapseObservationsByDay(group.observations);
      const latestObservation = collapsedDisplayObservations[collapsedDisplayObservations.length - 1];

      if (!latestObservation) {
        return null;
      }

      const historyGroup = historyByGroup.get(group.exerciseGroupKey);
      const collapsedHistoryObservations = collapseObservationsByDay(historyGroup?.observations ?? group.observations);
      const trendObservations = takeObservationsUntil(collapsedHistoryObservations, latestObservation);

      return {
        exerciseGroupKey: group.exerciseGroupKey,
        exerciseName: latestObservation.exerciseName,
        latestSets: latestObservation.sets,
        latestReps: latestObservation.reps,
        latestWeight: latestObservation.weight,
        setsTrend: getWorkoutMetricTrend(trendObservations.map((item) => item.sets)),
        repsTrend: getWorkoutMetricTrend(trendObservations.map((item) => item.reps)),
        weightTrend: getWorkoutMetricTrend(trendObservations.map((item) => item.weight)),
        lastDate: latestObservation.date,
      } satisfies WorkoutProgressRow;
    })
    .filter((row): row is WorkoutProgressRow => row !== null)
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exerciseName.localeCompare(b.exerciseName, 'ru'));
}
