import { exerciseContentMap, type ExerciseContent } from '../data/exerciseContent';
import { buildExerciseImageUrl, getExerciseStableContentId } from './exerciseMedia';

type LookupInput = {
  exerciseId?: string | null;
  exerciseName?: string | null;
};

type ExerciseContentLookupSource = {
  exercise_id?: string | null;
  id?: string | null;
  content_id?: string | null;
  canonical_exercise_id?: string | null;
  normalized_name?: string | null;
  name?: string | null;
  exercise?: {
    exercise_id?: string | null;
    id?: string | null;
    content_id?: string | null;
    canonical_exercise_id?: string | null;
    normalized_name?: string | null;
    name?: string | null;
  } | null;
} | null | undefined;

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
  isolated_arm_raises_on_a_machine: [
    'изолированный подъем рук в тренажере',
    'изолированный подъём рук в тренажёре',
    'изолированный подъем рук в тренажере махи в стороны',
    'изолированный подъём рук в тренажёре махи в стороны',
  ],
  close_grip_bench_press: [
    'жим лежа узким хватом',
    'жим лёжа узким хватом',
    'жим штанги лежа узким хватом',
    'жим штанги лёжа узким хватом',
  ],
  ring_pushups: [
    'отжимания на кольцах',
  ],
  chin_ups_underhand_back: [
    'подтягивания обратным хватом chin ups',
  ],
  lat_pulldown_wide_grip: [
    'вертикальная тяга широким хватом',
  ],
  lat_pulldown_close_or_underhand: [
    'вертикальная тяга узким хватом',
  ],
  bench_or_ball_hyperextension: [
    'гиперэкстензия',
  ],
  machine_hyperextension: [
    'гиперэкстензия в тренажере',
    'гиперэкстензия в тренажёре',
  ],
  stairs_or_stepups: [
    'степ апы',
    'степ-апы',
    'ходьба по лестнице',
    'степ ап',
  ],
  glute_bridge: [
    'ягодичный мост',
    'мостик',
  ],
  single_leg_glute_bridge: [
    'мостик одной ногой',
  ],
  wall_calf_raise: [
    'подъемы на носки у стены',
    'подъёмы на носки у стены',
    'подъем на носки у стены',
    'подъём на носки у стены',
  ],
  calf_raise_variations: [
    'подъемы на носки',
    'подъёмы на носки',
    'подъемы на носки стоя',
    'подъёмы на носки стоя',
    'подъемы на носки сидя',
    'подъёмы на носки сидя',
  ],
  bodyweight_squat: [
    'приседания',
    'приседания классические',
  ],
  goblet_squat: [
    'приседания с гантелью',
    'приседания с гантелью у груди',
    'приседание с гантелью у груди',
    'гантель у груди',
    'goblet squat',
  ],
  dumbbell_bulgarian_split_squat: [
    'болгарские приседания',
    'болгарские сплит приседания',
  ],
  bodyweight_lunges: [
    'выпады',
    'выпады вперед',
    'выпады вперёд',
    'выпады назад',
  ],
  side_lunge: [
    'боковые выпады',
  ],
  jump_squat: [
    'прыжки в приседе',
  ],
  wall_sit: [
    'стульчик',
    'стульчик у стены',
  ],
  machine_hip_abduction: [
    'отведение ног в стороны',
    'отведение ног в стороны в тренажере',
    'отведение ног в стороны в тренажёре',
    'разведение ног в тренажере',
    'разведение ног в тренажёре',
  ],
  machine_hip_adduction: [
    'приведение ног',
    'приведение ног в тренажере',
    'приведение ног в тренажёре',
    'сведение ног в тренажере',
    'сведение ног в тренажёре',
  ],
  machine_glute_kickback: [
    'отведение ноги назад в тренажере',
    'отведение ноги назад в тренажёре',
    'мах ногой назад в тренажере',
    'мах ногой назад в тренажёре',
  ],
  machine_leg_kickback: [
    'отведение ног назад в тренажере',
    'отведение ног назад в тренажёре',
    'тяга ног назад в тренажере',
    'тяга ног назад в тренажёре',
  ],
  single_leg_rdl: [
    'становая тяга на одной ноге',
    'румынская тяга на одной ноге',
    'тяга на одной ноге',
    'single leg rdl',
  ],
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
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

function prepareExerciseContent(item: ExerciseContent): ExerciseContent {
  const builtTechniqueImageUrl = item.technique_image_url || buildExerciseImageUrl(item.exercise_id, item.category);

  return {
    ...item,
    technique_image_url: sanitizeTechniqueImageUrl(builtTechniqueImageUrl ?? ''),
  };
}

function normalizeLookupKey(value?: string | null) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeName(name?: string | null) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zа-я0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const indexedEntries = Object.entries(exerciseContentMap).map(([entryKey, item]) => {
  const prepared = prepareExerciseContent(item);
  return { entryKey, item: prepared };
});

const contentByNormalizedId = new Map<string, ExerciseContent>();
const contentByNormalizedName = new Map<string, ExerciseContent>();
const aliasContentIdByNormalizedName = new Map<string, string>();

for (const { entryKey, item } of indexedEntries) {
  for (const candidate of uniqueValues([entryKey, item.exercise_id])) {
    const normalizedCandidate = normalizeLookupKey(candidate);
    if (normalizedCandidate && !contentByNormalizedId.has(normalizedCandidate)) {
      contentByNormalizedId.set(normalizedCandidate, item);
    }
  }

  const aliases = RUNTIME_ALIASES[item.exercise_id] ?? RUNTIME_ALIASES[entryKey] ?? [];

  for (const candidate of uniqueValues([item.exercise_name, ...(item.aliases ?? []), ...aliases])) {
    const normalizedCandidate = normalizeName(candidate);
    if (normalizedCandidate && !contentByNormalizedName.has(normalizedCandidate)) {
      contentByNormalizedName.set(normalizedCandidate, item);
    }
  }

  for (const candidate of uniqueValues(aliases)) {
    const normalizedCandidate = normalizeName(candidate);
    if (normalizedCandidate && !aliasContentIdByNormalizedName.has(normalizedCandidate)) {
      aliasContentIdByNormalizedName.set(normalizedCandidate, item.exercise_id);
    }
  }
}

function findById(candidate?: string | null) {
  if (!candidate) {
    return undefined;
  }

  return contentByNormalizedId.get(normalizeLookupKey(candidate));
}

function findByName(candidate?: string | null) {
  if (!candidate) {
    return undefined;
  }

  return contentByNormalizedName.get(normalizeName(candidate));
}

function findAliasMatch(candidate?: string | null) {
  if (!candidate) {
    return undefined;
  }

  const normalizedCandidate = normalizeName(candidate);
  const matchedId = aliasContentIdByNormalizedName.get(normalizedCandidate);

  if (!matchedId) {
    return undefined;
  }

  return {
    content: findById(matchedId),
    matchedId,
  };
}

function resolveByNormalizedAndRawNames(
  normalizedNameCandidates: string[],
  rawNameCandidates: string[],
) {
  if (normalizedNameCandidates.some((value) => value.includes('отжимания_на_кольцах'))) {
    return findById('ring_pushups');
  }

  if (
    normalizedNameCandidates.some((value) => value === 'подтягивания_обратным_хватом')
    && rawNameCandidates.some((value) => value.includes('chin-ups'))
  ) {
    return findById('chin_ups_underhand_back');
  }

  return undefined;
}

function getDebugExerciseId(source: ExerciseContentLookupSource) {
  return source?.exercise_id
    ?? source?.id
    ?? source?.content_id
    ?? source?.canonical_exercise_id
    ?? source?.exercise?.exercise_id
    ?? source?.exercise?.id
    ?? source?.exercise?.content_id
    ?? source?.exercise?.canonical_exercise_id
    ?? null;
}

function getDebugExerciseName(source: ExerciseContentLookupSource) {
  return source?.name
    ?? source?.normalized_name
    ?? source?.exercise?.name
    ?? source?.exercise?.normalized_name
    ?? null;
}

function getStableContentIdFromSource(source: ExerciseContentLookupSource) {
  return getExerciseStableContentId(source) ?? getExerciseStableContentId(source?.exercise);
}

export function lookupExerciseContent({ exerciseId, exerciseName }: LookupInput): ExerciseContent | undefined {
  return getExerciseContentForExercise({
    exercise_id: exerciseId,
    name: exerciseName,
  });
}

export function resolveCanonicalExerciseContentIdByName(name?: string | null): string | null {
  const normalizedNameCandidates = [name]
    .map((value) => normalizeName(value))
    .filter(Boolean);
  const rawNameCandidates = [name]
    .map((value) => String(value ?? '').toLowerCase())
    .filter(Boolean);

  const matchedContent = resolveByNormalizedAndRawNames(normalizedNameCandidates, rawNameCandidates)
    ?? findAliasMatch(name)?.content
    ?? findByName(name);

  return matchedContent?.exercise_id ?? null;
}

export function getExerciseContentForExercise(source: ExerciseContentLookupSource): ExerciseContent | undefined {
  const directMatch = findById(getStableContentIdFromSource(source))
    ?? findById(source?.exercise_id)
    ?? findById(source?.id)
    ?? findById(source?.content_id)
    ?? findById(source?.canonical_exercise_id)
    ?? findById(source?.exercise?.exercise_id)
    ?? findById(source?.exercise?.id)
    ?? findById(source?.exercise?.content_id)
    ?? findById(source?.exercise?.canonical_exercise_id);

  if (directMatch) {
    return directMatch;
  }

  const idCandidates = uniqueValues([
    source?.exercise_id,
    source?.id,
    source?.content_id,
    source?.canonical_exercise_id,
    source?.exercise?.exercise_id,
    source?.exercise?.id,
    source?.exercise?.content_id,
    source?.exercise?.canonical_exercise_id,
  ]);

  if (idCandidates.some((candidate) => isUuidLike(candidate))) {
    // UUID от Supabase не считаем ошибкой: просто переходим к deterministic name lookup.
  }

  const normalizedNameCandidates = [
    source?.name,
    source?.normalized_name,
    source?.exercise?.name,
    source?.exercise?.normalized_name,
  ]
    .map((value) => normalizeName(value))
    .filter(Boolean);

  const rawNameCandidates = [
    source?.name,
    source?.normalized_name,
    source?.exercise?.name,
    source?.exercise?.normalized_name,
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .filter(Boolean);

  const specialRuntimeMatch = resolveByNormalizedAndRawNames(normalizedNameCandidates, rawNameCandidates);

  if (specialRuntimeMatch) {
    return specialRuntimeMatch;
  }

  const aliasMatch = findAliasMatch(source?.name)
    ?? findAliasMatch(source?.normalized_name)
    ?? findAliasMatch(source?.exercise?.name)
    ?? findAliasMatch(source?.exercise?.normalized_name);

  if (aliasMatch?.content) {
    console.info('[exerciseContent] matched via alias', {
      name: getDebugExerciseName(source),
      matchedId: aliasMatch.matchedId,
    });
    return aliasMatch.content;
  }

  const byName = findByName(source?.name)
    ?? findByName(source?.normalized_name)
    ?? findByName(source?.exercise?.name)
    ?? findByName(source?.exercise?.normalized_name);

  if (byName) {
    return byName;
  }

  const debugId = getDebugExerciseId(source);
  const debugName = getDebugExerciseName(source);

  if (debugId || debugName) {
    console.warn('[exerciseContent] NOT FOUND', {
      id: debugId,
      name: debugName,
    });
  }

  return undefined;
}
