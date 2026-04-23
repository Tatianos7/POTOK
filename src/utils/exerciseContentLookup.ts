import { exerciseContentMap, type ExerciseContent } from '../data/exerciseContent';

type LookupInput = {
  exerciseId?: string | null;
  exerciseName?: string | null;
};

const RUNTIME_ALIASES: Record<string, string[]> = {
  standing_barbell_press: ['армейский жим', 'жим штанги стоя'],
  military_press_with_a_kettlebell: [
    'армейский жим с гирей',
    'армейский жим с гирей одной рукой',
    'армейский жим с гантелью',
    'армейский жим с гантелью одной рукой',
  ],
  'barbell_chin-ups': ['тяга штанги к подбородку'],
  'machine_chin-ups': ['тяга к подбородку в тренажере', 'тяга к подбородку в тренажёре'],
  dumbbell_lateral_raises: [
    'разведение гантелей в стороны',
    'разведения гантелей в стороны',
    'махи гантелями в стороны',
  ],
  'bent-over_dumbbell_flyes': [
    'разведение гантелей в наклоне',
    'разведения гантелей в наклоне',
    'обратные махи',
  ],
  push_press_with_a_barbell: [
    'подъемы на грудь push press со штангой',
    'подъёмы на грудь push press со штангой',
    'подъемы на грудь push press с гантелями',
    'подъёмы на грудь push press с гантелями',
    'подъемы на грудь со штангой',
    'подъёмы на грудь со штангой',
    'подъемы на грудь с гантелями',
    'подъёмы на грудь с гантелями',
    'push press',
  ],
  Isolated_arm_raises_on_a_machine: [
    'изолированный подъем рук в тренажере',
    'изолированный подъём рук в тренажёре',
    'изолированный подъем рук в тренажере махи в стороны',
    'изолированный подъём рук в тренажёре махи в стороны',
  ],
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeExerciseName(value?: string | null) {
  return normalizeWhitespace(
    String(value ?? '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[«»"']/g, '')
      .replace(/[()]/g, ' ')
      .replace(/[+/,.:;!?]/g, ' ')
      .replace(/[_-]/g, ' '),
  );
}

function normalizeExerciseId(value?: string | null) {
  return normalizeWhitespace(
    String(value ?? '')
      .toLowerCase()
      .replace(/[_-]/g, ' '),
  );
}

function sanitizeTechniqueImageUrl(url: string) {
  const segments = url.split('/');
  const fileName = segments.pop();

  if (!fileName) {
    return url;
  }

  const normalizedFileName = fileName.toLowerCase().replace(/-/g, '_');
  return [...segments, normalizedFileName].join('/');
}

function buildNameCandidates(item: ExerciseContent): string[] {
  const runtimeAliases = RUNTIME_ALIASES[item.exercise_id] ?? RUNTIME_ALIASES[item.exercise_name] ?? [];

  return Array.from(new Set([
    item.exercise_name,
    ...(item.aliases ?? []),
    ...runtimeAliases,
  ].map((candidate) => normalizeExerciseName(candidate)).filter(Boolean)));
}

function prepareExerciseContent(item: ExerciseContent): ExerciseContent {
  return {
    ...item,
    technique_image_url: sanitizeTechniqueImageUrl(item.technique_image_url),
  };
}

export function lookupExerciseContent({ exerciseId, exerciseName }: LookupInput): ExerciseContent | undefined {
  const directIdMatch = exerciseId ? exerciseContentMap[exerciseId] : undefined;
  if (directIdMatch) {
    return prepareExerciseContent(directIdMatch);
  }

  const normalizedId = normalizeExerciseId(exerciseId);
  if (normalizedId) {
    const idEntry = Object.values(exerciseContentMap).find((item) => (
      normalizeExerciseId(item.exercise_id) === normalizedId
      || normalizeExerciseId(item.exercise_name) === normalizedId
    ));

    if (idEntry) {
      return prepareExerciseContent(idEntry);
    }
  }

  const normalizedName = normalizeExerciseName(exerciseName);
  if (!normalizedName) {
    return undefined;
  }

  const entries = Object.values(exerciseContentMap);

  const exactNameMatch = entries.find((item) => normalizeExerciseName(item.exercise_name) === normalizedName);
  if (exactNameMatch) {
    return prepareExerciseContent(exactNameMatch);
  }

  const exactAliasMatch = entries.find((item) => buildNameCandidates(item).some((candidate) => candidate === normalizedName));
  if (exactAliasMatch) {
    return prepareExerciseContent(exactAliasMatch);
  }

  const includesMatch = entries.find((item) => buildNameCandidates(item).some((candidate) => (
    normalizedName.includes(candidate) || candidate.includes(normalizedName)
  )));

  return includesMatch ? prepareExerciseContent(includesMatch) : undefined;
}
