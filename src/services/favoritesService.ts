import { Food } from '../types';
import { foodService } from './foodService';
import { supabase } from '../lib/supabaseClient';

interface FavoriteEntry {
  productId: string;
  usage: number;
  addedAt: string;
  canonicalFoodId?: string | null;
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

const resolveFavoriteKey = (userId: string, productId: string): string => {
  const food = foodService.getFoodById(productId, userId);
  return food?.name?.trim() || productId;
};

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
            productId: item.product_name,
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
        const { error } = await supabase
          .from('favorite_products')
          .upsert({
            user_id: sessionUserId,
            product_name: favoriteKey,
            canonical_food_id: isValidUUID(food.canonical_food_id) ? food.canonical_food_id : null,
            protein: food.protein,
            fat: food.fat,
            carbs: food.carbs,
            calories: food.calories,
            usage_count: 0,
          }, {
            onConflict: 'user_id,product_name',
          });

        if (error) {
          console.error('[favoritesService] Supabase save error:', error);
          return;
        }
        const all = loadAll();
        const list = all[sessionUserId] || [];
        const idx = list.findIndex((f) => f.productId === productId || f.productId === favoriteKey);
        if (idx >= 0) return;
        list.push({
          productId,
          usage: 0,
          addedAt: new Date().toISOString(),
          canonicalFoodId: food.canonical_food_id ?? null,
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
        const { error } = await supabase
          .from('favorite_products')
          .delete()
          .eq('user_id', sessionUserId)
          .eq('product_name', food?.name || favoriteKey);

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
        // First get current usage_count
        const { data: existing } = await supabase
          .from('favorite_products')
          .select('usage_count')
          .eq('user_id', sessionUserId)
          .eq('product_name', food?.name || favoriteKey)
          .single();

        const newUsage = (existing?.usage_count || 0) + 1;

        const { error } = await supabase
          .from('favorite_products')
          .update({ usage_count: newUsage })
          .eq('user_id', sessionUserId)
          .eq('product_name', food?.name || favoriteKey);

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
        const food =
          foodService.getFoodById(entry.productId, userId) ||
          foodService.getAllFoods(userId).find((f) => f.name === entry.productId);
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
