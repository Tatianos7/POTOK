export type DataCorrectionClassification =
  | 'NEW_CANONICAL'
  | 'EXISTING_CANONICAL'
  | 'ALIAS_ONLY'
  | 'RANKING_ONLY'
  | 'REJECT';

export type ProposedCanonical = {
  name: string;
  stable_food_id: string;
  normalized_name: string;
  aliases: string[];
  category: string;
  cooking_state: string;
  product_scope: 'generic' | 'specific';
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  nutrition_source: string;
  confidence: 'high' | 'medium' | 'low';
};

export type ProposedAlias = {
  source_phrase: string;
  target_stable_food_id: string;
  rationale: string;
};

export type FoodSearchDataCorrectionProposal = {
  query: string;
  classification: DataCorrectionClassification;
  current_state: string;
  proposed_action: string;
  stable_food_id: string | null;
  source_of_nutrition: string;
  risk: 'low' | 'medium' | 'high';
  aliases: ProposedAlias[];
  proposed_canonical?: ProposedCanonical;
};

export const foodSearchDataCorrectionProposals: FoodSearchDataCorrectionProposal[] = [
  {
    query: 'йогурт',
    classification: 'REJECT',
    current_state: 'No plain yogurt canonical exists; only yogurt pastry/cake rows were observed.',
    proposed_action: 'Do not add a generic yogurt row until an owner-approved natural/plain yogurt nutrition source is selected.',
    stable_food_id: null,
    source_of_nutrition: 'Required before patch; current Food Core has no trustworthy equivalent plain-yogurt row.',
    risk: 'high',
    aliases: [],
  },
  {
    query: 'кефир',
    classification: 'REJECT',
    current_state: 'Fat-specific kefir rows exist: kefir_0, kefir_1, kefir_1_5, kefir_2, kefir_2_5, kefir_3_2.',
    proposed_action: 'Do not add broad kefir alias/canonical; keep as manual selection among fat-specific rows.',
    stable_food_id: null,
    source_of_nutrition: 'Existing Food Core fat-specific kefir rows.',
    risk: 'medium',
    aliases: [],
  },
  {
    query: 'творог',
    classification: 'REJECT',
    current_state: 'Many fat-specific cottage cheese rows exist; generic fat-unknown cottage cheese would be misleading.',
    proposed_action: 'Do not add broad творог alias/canonical; keep as manual selection among fat-specific rows.',
    stable_food_id: null,
    source_of_nutrition: 'Existing Food Core fat-specific cottage-cheese rows.',
    risk: 'medium',
    aliases: [],
  },
  {
    query: 'яйцо',
    classification: 'ALIAS_ONLY',
    current_state: 'Canonical egg_chicken exists, but exact alias яйцо is absent; query can rank other egg-like rows first.',
    proposed_action: 'Add exact conversational alias яйцо -> egg_chicken.',
    stable_food_id: 'egg_chicken',
    source_of_nutrition: 'Existing Food Core canonical Яйцо куриное: 143 kcal, P 12.5, F 9.5, C 0.7, fiber NULL.',
    risk: 'low',
    aliases: [
      {
        source_phrase: 'яйцо',
        target_stable_food_id: 'egg_chicken',
        rationale: 'In ordinary food logging, unqualified singular яйцо most commonly means chicken egg; other species remain searchable by exact names.',
      },
    ],
  },
  {
    query: 'сахар',
    classification: 'ALIAS_ONLY',
    current_state: 'Canonical granulated_sugar exists as Сахар-песок; exact alias сахар is absent.',
    proposed_action: 'Add exact pantry alias сахар -> granulated_sugar.',
    stable_food_id: 'granulated_sugar',
    source_of_nutrition: 'Existing Food Core canonical Сахар-песок: 399 kcal, P 0, F 0, C 99.8, fiber NULL.',
    risk: 'low',
    aliases: [
      {
        source_phrase: 'сахар',
        target_stable_food_id: 'granulated_sugar',
        rationale: 'Unqualified сахар is a common synonym for granulated white sugar in food logging.',
      },
    ],
  },
  {
    query: 'соль',
    classification: 'NEW_CANONICAL',
    current_state: 'Plain salt canonical is missing; current contains results are beans/garlic salt/pink Himalayan salt.',
    proposed_action: 'Add plain table salt canonical and aliases for common Russian pantry terms.',
    stable_food_id: 'salt',
    source_of_nutrition: 'Table salt pantry identity: no modeled calories/macros/fiber; sodium is not represented in current Food Core schema.',
    risk: 'low',
    aliases: [
      {
        source_phrase: 'соль',
        target_stable_food_id: 'salt',
        rationale: 'Exact broad query should resolve to plain salt, not фасоль substring noise.',
      },
      {
        source_phrase: 'поваренная соль',
        target_stable_food_id: 'salt',
        rationale: 'Common exact synonym for table salt.',
      },
      {
        source_phrase: 'столовая соль',
        target_stable_food_id: 'salt',
        rationale: 'Common exact synonym for table salt.',
      },
    ],
    proposed_canonical: {
      name: 'Соль поваренная',
      stable_food_id: 'salt',
      normalized_name: 'соль поваренная',
      aliases: ['соль', 'поваренная соль', 'соль поваренная', 'столовая соль', 'соль столовая'],
      category: 'seasonings',
      cooking_state: 'unknown',
      product_scope: 'generic',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
      nutrition_source: 'Table salt pantry identity; current schema has no sodium column.',
      confidence: 'high',
    },
  },
  {
    query: 'греческий йогурт',
    classification: 'REJECT',
    current_state: 'No Greek yogurt canonical or alias exists in staging.',
    proposed_action: 'Do not add until a fat/sugar-specific Greek yogurt nutrition source is approved.',
    stable_food_id: null,
    source_of_nutrition: 'Required before patch; current Food Core has no trustworthy equivalent Greek-yogurt row.',
    risk: 'high',
    aliases: [],
  },
  {
    query: 'хлеб ржаной',
    classification: 'ALIAS_ONLY',
    current_state: 'Rye bread variants exist; pan_baked_rye_bread is the closest base/formovoy row.',
    proposed_action: 'Add exact alias хлеб ржаной -> pan_baked_rye_bread only after accepting this as the base rye bread choice.',
    stable_food_id: 'pan_baked_rye_bread',
    source_of_nutrition: 'Existing Food Core canonical Хлеб Ржаной формовой: 217 kcal, P 5.9, F 1.1, C 44.5, fiber NULL.',
    risk: 'medium',
    aliases: [
      {
        source_phrase: 'хлеб ржаной',
        target_stable_food_id: 'pan_baked_rye_bread',
        rationale: 'Specific subtype query needs a stable top result; risk remains because rye bread recipes vary.',
      },
      {
        source_phrase: 'ржаной хлеб',
        target_stable_food_id: 'pan_baked_rye_bread',
        rationale: 'Word-order synonym for the same accepted base rye-bread row.',
      },
    ],
  },
  {
    query: 'картофель варёный',
    classification: 'EXISTING_CANONICAL',
    current_state: 'Canonical boiled_potato exists and both ё/е aliases are already present.',
    proposed_action: 'No data correction needed; retain regression expectation.',
    stable_food_id: 'boiled_potato',
    source_of_nutrition: 'Existing Food Core canonical Картофель варёный: 82 kcal, P 2, F 0.4, C 16.7, fiber NULL.',
    risk: 'low',
    aliases: [],
  },
];

export const acceptedDataCorrectionAliases = foodSearchDataCorrectionProposals.flatMap((proposal) => proposal.aliases);

export const proposedNewCanonicals = foodSearchDataCorrectionProposals
  .map((proposal) => proposal.proposed_canonical)
  .filter((item): item is ProposedCanonical => Boolean(item));
