import { Food } from '../types';
import { foodService } from './foodService';
import { supabase } from '../lib/supabaseClient';

interface FavoriteEntry {
  productId: string;
  usage: number;
  addedAt: string;
  canonicalFoodId?: string | null;
}

interface FavoriteProductsTableClient {
  upsert(payload: any, options: { onConflict: string }): Promise<{ error: any }>;
  selectIdByKey(params: {
    userId: string;
    canonicalFoodId: string | null;
    productName: string;
  }): Promise<{ data: { id: string } | null; error: any }>;
  insert(payload: any): Promise<{ error: any }>;
}

const STORAGE_KEY = 'potok_favorites_v1';

const loadAll = (): Record<string, FavoriteEntry[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveAll = (data: Record<string, FavoriteEntry[]>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const getSessionUserId = async (userId?: string): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase не инициализирован');
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Пользователь не авторизован');
  }

  if (userId && userId !== data.user.id) {
    console.warn('[favoritesService] Передан userId не совпадает с сессией');
  }

  return data.user.id;
};

const isValidUUID = (value?: string | null): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const isMissingCanonicalColumnError = (error: any): boolean => {
  const code = String(error?.code ?? '').toUpperCase();
  const message = String(error?.message ?? '').toLowerCase();
  return code === '42703' || message.includes('canonical_food_id');
};

const isMissingOnConflictConstraintError = (error: any): boolean => {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('no unique or exclusion constraint matching the on conflict specification');
};

const resolveFavoriteKey = (userId: string, productId: string): string => {
  const food = foodService.getFoodById(productId, userId);
  return food?.name?.trim() || productId;
};

const resolveCanonicalFavoriteId = async (
  userId: string,
  productId: string,
  food?: Food | null
): Promise<string | null> => {
  if (isValidUUID(food?.canonical_food_id ?? null)) return food?.canonical_food_id ?? null;
  if (isValidUUID(food?.id ?? null)) return food?.id ?? null;
  if (isValidUUID(productId)) return productId;

  const lookupName = food?.name?.trim() || productId.trim();
  if (!lookupName) return null;

  try {
    const candidates = await foodService.search(lookupName, { userId, limit: 5 });
    const exact = candidates.find((item) => item.name?.trim().toLowerCase() === lookupName.toLowerCase());
    if (exact && isValidUUID(exact.canonical_food_id ?? null)) return exact.canonical_food_id ?? null;
    if (exact && isValidUUID(exact.id)) return exact.id;
    const first = candidates[0];
    if (first && isValidUUID(first.canonical_food_id ?? null)) return first.canonical_food_id ?? null;
    if (first && isValidUUID(first.id)) return first.id;
  } catch {
    // fallback handled by null
  }

  return null;
};

const resolveFoodByFavoriteEntry = (userId: string, entry: FavoriteEntry): Food | null => {
  if (isValidUUID(entry.canonicalFoodId ?? null)) {
    const byCanonical = foodService.getFoodById(entry.canonicalFoodId as string, userId);
    if (byCanonical) return byCanonical;
  }

  if (isValidUUID(entry.productId)) {
    const byId = foodService.getFoodById(entry.productId, userId);
    if (byId) return byId;
  }

  return (
    foodService.getFoodById(entry.productId, userId) ||
    foodService.getAllFoods(userId).find((f) => f.name === entry.productId) ||
    null
  );
};

export async function saveFavoriteProductWithFallback(
  client: FavoriteProductsTableClient,
  params: {
    userId: string;
    canonicalFoodId: string | null;
    productName: string;
    payload: any;
  }
): Promise<{ error: any; usedFallback: boolean }> {
  let usedFallback = false;
  let { error } = await client.upsert(params.payload, { onConflict: 'user_id,product_name' });

  if (error && isMissingCanonicalColumnError(error)) {
    const { canonical_food_id, ...fallbackPayload } = params.payload;
    const retry = await client.upsert(fallbackPayload, { onConflict: 'user_id,product_name' });
    error = retry.error;
  }

  if (error && isMissingOnConflictConstraintError(error)) {
    usedFallback = true;
    let { data: existing, error: selectError } = await client.selectIdByKey({
      userId: params.userId,
      canonicalFoodId: params.canonicalFoodId,
      productName: params.productName,
    });

    if (selectError && params.canonicalFoodId && isMissingCanonicalColumnError(selectError)) {
      const retry = await client.selectIdByKey({
        userId: params.userId,
        canonicalFoodId: null,
        productName: params.productName,
      });
      existing = retry.data;
      selectError = retry.error;
    }

    if (selectError) {
      return { error: selectError, usedFallback };
    }

    if (!existing?.id) {
      let insertResult = await client.insert(params.payload);
      if (insertResult.error && isMissingCanonicalColumnError(insertResult.error)) {
        const { canonical_food_id, ...fallbackPayload } = params.payload;
        insertResult = await client.insert(fallbackPayload);
      }
      error = insertResult.error;
    } else {
      error = null;
    }
  }

  return { error, usedFallback };
}

export const favoritesService = {
  async getFavorites(userId: string): Promise<FavoriteEntry[]> {
    const limit = 500;
    // Try Supabase first
    if (supabase) {
      try {
        const sessionUserId = await getSessionUserId(userId);
        const { data, error } = await supabase
          .from('favorite_products')
          .select('*')
          .eq('user_id', sessionUserId)
          .order('usage_count', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('[favoritesService] Supabase error:', error);
          // Fallback to localStorage
        } else if (data) {
          // Convert Supabase data to FavoriteEntry format
          const entries: FavoriteEntry[] = data.map((item) => ({
            productId: item.canonical_food_id || item.product_name,
            usage: item.usage_count || 0,
            addedAt: item.created_at,
            canonicalFoodId: item.canonical_food_id ?? null,
          }));
          // Sync to localStorage
          const all = loadAll();
          all[sessionUserId] = entries;
          saveAll(all);
          return entries;
        }
      } catch (err) {
        console.error('[favoritesService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    const all = loadAll();
    const sessionUserId = await getSessionUserId(userId);
    return all[sessionUserId] || [];
  },

  async addToFavorites(userId: string, productId: string) {
    const sessionUserId = await getSessionUserId(userId);
    const favoriteKey = resolveFavoriteKey(sessionUserId, productId);
    // Get food info
    const food = foodService.getFoodById(productId, sessionUserId);
    if (!food) {
      console.error('[favoritesService] Food not found:', productId);
      return;
    }

    // Try to save to Supabase
    if (supabase) {
      try {
        const supabaseClient = supabase;
        const canonicalFoodId = await resolveCanonicalFavoriteId(sessionUserId, productId, food);
        const payload: any = {
          user_id: sessionUserId,
          product_name: favoriteKey,
          canonical_food_id: canonicalFoodId,
          protein: food.protein,
          fat: food.fat,
          carbs: food.carbs,
          calories: food.calories,
          usage_count: 0,
        };

        const { error } = await saveFavoriteProductWithFallback(
          {
            upsert: async (favoritePayload, options) => {
              const result = await supabaseClient.from('favorite_products').upsert(favoritePayload, options);
              return { error: result.error };
            },
            selectIdByKey: async ({ userId, canonicalFoodId, productName }) => {
              let query = supabaseClient.from('favorite_products').select('id').eq('user_id', userId);
              if (canonicalFoodId) {
                query = query.eq('canonical_food_id', canonicalFoodId);
              } else {
                query = query.eq('product_name', productName);
              }
              const result = await query.maybeSingle();
              return { data: result.data as { id: string } | null, error: result.error };
            },
            insert: async (favoritePayload) => {
              const result = await supabaseClient.from('favorite_products').insert(favoritePayload);
              return { error: result.error };
            },
          },
          {
            userId: sessionUserId,
            canonicalFoodId,
            productName: favoriteKey,
            payload,
          }
        );

        if (error) {
          console.error('[favoritesService] Supabase save error:', error);
          return;
        }
        const all = loadAll();
        const list = all[sessionUserId] || [];
        const idx = list.findIndex((f) => f.productId === productId || f.productId === favoriteKey);
        if (idx >= 0) return;
        list.push({
          productId: canonicalFoodId || productId,
          usage: 0,
          addedAt: new Date().toISOString(),
          canonicalFoodId,
        });
        all[sessionUserId] = list;
        saveAll(all);
      } catch (err) {
        console.error('[favoritesService] Supabase save connection error:', err);
      }
    }
  },

  async removeFromFavorites(userId: string, productId: string) {
    const sessionUserId = await getSessionUserId(userId);
    // Get food info for Supabase
    const food = foodService.getFoodById(productId, sessionUserId);
    const favoriteKey = resolveFavoriteKey(sessionUserId, productId);

    // Try to delete from Supabase
    if (supabase) {
      try {
        const canonicalFoodId = await resolveCanonicalFavoriteId(sessionUserId, productId, food);
        let query = supabase
          .from('favorite_products')
          .delete()
          .eq('user_id', sessionUserId);
        if (canonicalFoodId) {
          query = query.eq('canonical_food_id', canonicalFoodId);
        } else {
          query = query.eq('product_name', food?.name || favoriteKey);
        }
        let { error } = await query;
        if (error && canonicalFoodId && isMissingCanonicalColumnError(error)) {
          const retry = await supabase
            .from('favorite_products')
            .delete()
            .eq('user_id', sessionUserId)
            .eq('product_name', food?.name || favoriteKey);
          error = retry.error;
        }

        if (error) {
          console.error('[favoritesService] Supabase delete error:', error);
          return;
        }
        const all = loadAll();
        const list = (all[sessionUserId] || []).filter(
          (f) => f.productId !== productId && f.productId !== favoriteKey
        );
        all[sessionUserId] = list;
        saveAll(all);
      } catch (err) {
        console.error('[favoritesService] Supabase delete connection error:', err);
      }
    }
  },

  async incrementFavoriteUsage(userId: string, productId: string) {
    const sessionUserId = await getSessionUserId(userId);
    // Get food info
    const food = foodService.getFoodById(productId, sessionUserId);
    const favoriteKey = resolveFavoriteKey(sessionUserId, productId);

    // Try to update in Supabase
    if (supabase) {
      try {
        const canonicalFoodId = await resolveCanonicalFavoriteId(sessionUserId, productId, food);
        // First get current usage_count
        let selectQuery = supabase
          .from('favorite_products')
          .select('usage_count')
          .eq('user_id', sessionUserId);
        if (canonicalFoodId) {
          selectQuery = selectQuery.eq('canonical_food_id', canonicalFoodId);
        } else {
          selectQuery = selectQuery.eq('product_name', food?.name || favoriteKey);
        }
        let { data: existing, error: selectError } = await selectQuery.single();
        if (selectError && canonicalFoodId && isMissingCanonicalColumnError(selectError)) {
          const retry = await supabase
            .from('favorite_products')
            .select('usage_count')
            .eq('user_id', sessionUserId)
            .eq('product_name', food?.name || favoriteKey)
            .single();
          existing = retry.data;
          selectError = retry.error;
        }
        if (selectError) {
          console.error('[favoritesService] Supabase select error:', selectError);
          return;
        }

        const newUsage = (existing?.usage_count || 0) + 1;

        let updateQuery = supabase
          .from('favorite_products')
          .update({ usage_count: newUsage })
          .eq('user_id', sessionUserId);
        if (canonicalFoodId) {
          updateQuery = updateQuery.eq('canonical_food_id', canonicalFoodId);
        } else {
          updateQuery = updateQuery.eq('product_name', food?.name || favoriteKey);
        }
        let { error } = await updateQuery;
        if (error && canonicalFoodId && isMissingCanonicalColumnError(error)) {
          const retry = await supabase
            .from('favorite_products')
            .update({ usage_count: newUsage })
            .eq('user_id', sessionUserId)
            .eq('product_name', food?.name || favoriteKey);
          error = retry.error;
        }

        if (error) {
          console.error('[favoritesService] Supabase update error:', error);
          return;
        }
        const all = loadAll();
        const list = all[sessionUserId] || [];
        const idx = list.findIndex((f) => f.productId === productId || f.productId === favoriteKey);
        if (idx >= 0) {
          list[idx].usage = newUsage;
          all[sessionUserId] = list;
          saveAll(all);
        }
      } catch (err) {
        console.error('[favoritesService] Supabase update connection error:', err);
      }
    }
  },

  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const favoriteKey = resolveFavoriteKey(userId, productId);
    const favorites = await this.getFavorites(userId);
    return !!favorites.find((f) => f.productId === productId || f.productId === favoriteKey);
  },

  async resolveFavorites(userId: string): Promise<(Food & { usage: number })[]> {
    const entries = await this.getFavorites(userId);
    const resolved = entries
      .map((entry) => {
        const food = resolveFoodByFavoriteEntry(userId, entry);
        if (!food) return null;
        return { ...food, usage: entry.usage };
      })
      .filter((f): f is Food & { usage: number } => !!f);
    return resolved.sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0));
  },

  async getFavoriteFoods(userId: string): Promise<Food[]> {
    return this.resolveFavorites(userId);
  },
};
