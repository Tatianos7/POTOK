export type DiaryMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type DiaryResolverResult =
  | {
      status: 'resolved';
      canonical_food_id: string;
      matched_by:
        | 'existing_canonical_id'
        | 'barcode'
        | 'normalized_name_brand'
        | 'normalized_name_only'
        | 'alias_exact'
        | 'manual_choice';
      confidence?: number | null;
    }
  | {
      status: 'ambiguous';
      canonical_food_id?: null;
      matched_by?: 'candidate_list';
      confidence?: null;
    }
  | {
      status: 'unresolved';
      canonical_food_id?: null;
      matched_by?: 'none';
      confidence?: null;
    };

export interface CreateDiaryEntryRequest {
  user_id: string;
  date: string;
  meal_type: DiaryMealType;
  weight_g: number;
  product_name: string;
  resolver: DiaryResolverResult;
  idempotency_key?: string | null;
  base_unit?: 'g' | 'г';
  display_unit?: string | null;
  display_amount?: number | null;
  calories?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
}

export interface DiaryFoodRecord {
  id: string;
  canonical_food_id: string | null;
  source: 'core' | 'brand' | 'user';
  created_by_user_id: string | null;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
}

export interface DiaryEntryRecord {
  id: string;
  user_id: string;
  date: string;
  meal_type: DiaryMealType;
  canonical_food_id: string;
  product_name: string;
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface DiaryInsertPayload {
  user_id: string;
  date: string;
  meal_type: DiaryMealType;
  canonical_food_id: string;
  product_name: string;
  weight: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  idempotency_key: string | null;
  base_unit?: string;
  display_unit?: string | null;
  display_amount?: number | null;
}

export interface DiaryRepository {
  findByUserAndIdempotencyKey(userId: string, idempotencyKey: string): Promise<DiaryEntryRecord | null>;
  insert(payload: DiaryInsertPayload): Promise<DiaryEntryRecord>;
}

export interface FoodsRepository {
  findById(foodId: string): Promise<DiaryFoodRecord | null>;
}

export interface DiaryCreateDeps {
  diaryRepo: DiaryRepository;
  foodsRepo: FoodsRepository;
}

export class DiaryCreateServiceError extends Error {
  constructor(
    public readonly code:
      | 'resolver_not_resolved'
      | 'resolver_ambiguous'
      | 'resolver_unresolved'
      | 'canonical_food_not_found'
      | 'canonical_food_not_visible'
      | 'canonical_food_not_root'
      | 'invalid_weight_g'
      | 'invalid_meal_type'
      | 'invalid_date'
      | 'idempotency_conflict_payload_mismatch'
      | 'unauthorized_user_scope',
    message: string
  ) {
    super(message);
    this.name = 'DiaryCreateServiceError';
  }
}

export interface CreateDiaryEntryResult {
  entry: DiaryEntryRecord;
  idempotent_replay: boolean;
}

const VALID_MEAL_TYPES: DiaryMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function assertValidDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DiaryCreateServiceError('invalid_date', 'Invalid date format');
  }
}

function assertValidMealType(mealType: string): asserts mealType is DiaryMealType {
  if (!VALID_MEAL_TYPES.includes(mealType as DiaryMealType)) {
    throw new DiaryCreateServiceError('invalid_meal_type', 'Invalid meal type');
  }
}

function assertResolvedResolver(
  resolver: DiaryResolverResult
): asserts resolver is Extract<DiaryResolverResult, { status: 'resolved' }> {
  if (resolver.status === 'ambiguous') {
    throw new DiaryCreateServiceError('resolver_ambiguous', 'Resolver returned ambiguous');
  }
  if (resolver.status === 'unresolved') {
    throw new DiaryCreateServiceError('resolver_unresolved', 'Resolver returned unresolved');
  }
  if (!resolver.canonical_food_id) {
    throw new DiaryCreateServiceError('resolver_not_resolved', 'Resolver must include canonical food id');
  }
}

function assertVisibleCanonicalFood(food: DiaryFoodRecord, authUserId: string): void {
  if (food.canonical_food_id !== food.id) {
    throw new DiaryCreateServiceError('canonical_food_not_root', 'Food must be canonical root');
  }

  const isShared = food.source === 'core' || food.source === 'brand';
  const isOwnedUserFood = food.source === 'user' && food.created_by_user_id === authUserId;

  if (!isShared && !isOwnedUserFood) {
    throw new DiaryCreateServiceError('canonical_food_not_visible', 'Food is not visible to current user');
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDiarySnapshot(food: DiaryFoodRecord, weightG: number) {
  const factor = weightG / 100;

  return {
    calories: round2(food.calories * factor),
    protein: round2(food.protein * factor),
    fat: round2(food.fat * factor),
    carbs: round2(food.carbs * factor),
    fiber: food.fiber == null ? null : round2(food.fiber * factor),
  };
}

function matchesSemanticPayload(existing: DiaryEntryRecord, request: CreateDiaryEntryRequest, canonicalFoodId: string): boolean {
  return (
    existing.date === request.date &&
    existing.meal_type === request.meal_type &&
    existing.canonical_food_id === canonicalFoodId &&
    Number(existing.weight) === Number(request.weight_g) &&
    existing.product_name === request.product_name
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: string }).code ?? '').toUpperCase();
  const message = String((error as { message?: string }).message ?? '').toLowerCase();

  return (
    code === '23505' ||
    message.includes('duplicate key value violates unique constraint') ||
    message.includes('unique constraint')
  );
}

export class DiaryCreateService {
  constructor(private readonly deps: DiaryCreateDeps) {}

  async create(authUserId: string, request: CreateDiaryEntryRequest): Promise<CreateDiaryEntryResult> {
    if (authUserId !== request.user_id) {
      throw new DiaryCreateServiceError('unauthorized_user_scope', 'User scope mismatch');
    }

    assertValidDate(request.date);
    assertValidMealType(request.meal_type);

    if (!(request.weight_g > 0)) {
      throw new DiaryCreateServiceError('invalid_weight_g', 'weight_g must be greater than zero');
    }

    assertResolvedResolver(request.resolver);

    if (request.idempotency_key) {
      const existing = await this.deps.diaryRepo.findByUserAndIdempotencyKey(request.user_id, request.idempotency_key);
      if (existing) {
        if (!matchesSemanticPayload(existing, request, request.resolver.canonical_food_id)) {
          throw new DiaryCreateServiceError(
            'idempotency_conflict_payload_mismatch',
            'Existing idempotency key has a different payload'
          );
        }

        return {
          entry: existing,
          idempotent_replay: true,
        };
      }
    }

    const insertPayload = await buildDiaryInsertPayload(authUserId, request, this.deps.foodsRepo);

    let inserted: DiaryEntryRecord;
    try {
      inserted = await this.deps.diaryRepo.insert(insertPayload);
    } catch (error) {
      if (!request.idempotency_key || !isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.deps.diaryRepo.findByUserAndIdempotencyKey(request.user_id, request.idempotency_key);
      if (!existing) {
        throw error;
      }
      if (!matchesSemanticPayload(existing, request, insertPayload.canonical_food_id)) {
        throw new DiaryCreateServiceError(
          'idempotency_conflict_payload_mismatch',
          'Existing idempotency key has a different payload'
        );
      }

      return {
        entry: existing,
        idempotent_replay: true,
      };
    }

    return {
      entry: inserted,
      idempotent_replay: false,
    };
  }
}

export async function buildDiaryInsertPayload(
  authUserId: string,
  request: CreateDiaryEntryRequest,
  foodsRepo: FoodsRepository
): Promise<DiaryInsertPayload> {
  if (authUserId !== request.user_id) {
    throw new DiaryCreateServiceError('unauthorized_user_scope', 'User scope mismatch');
  }

  assertValidDate(request.date);
  assertValidMealType(request.meal_type);

  if (!(request.weight_g > 0)) {
    throw new DiaryCreateServiceError('invalid_weight_g', 'weight_g must be greater than zero');
  }

  assertResolvedResolver(request.resolver);

  const food = await foodsRepo.findById(request.resolver.canonical_food_id);
  if (!food) {
    throw new DiaryCreateServiceError('canonical_food_not_found', 'Canonical food not found');
  }

  assertVisibleCanonicalFood(food, authUserId);

  const snapshot = calculateDiarySnapshot(food, request.weight_g);

  return {
    user_id: request.user_id,
    date: request.date,
    meal_type: request.meal_type,
    canonical_food_id: food.id,
    product_name: request.product_name,
    weight: request.weight_g,
    calories: snapshot.calories,
    protein: snapshot.protein,
    fat: snapshot.fat,
    carbs: snapshot.carbs,
    fiber: snapshot.fiber,
    idempotency_key: request.idempotency_key ?? null,
    base_unit: request.base_unit ?? 'г',
    display_unit: request.display_unit ?? request.base_unit ?? 'г',
    display_amount: request.display_amount ?? request.weight_g,
  };
}
