import { Food } from '../types';
import { foodService } from './foodService';
import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';

interface FavoriteEntry {
  productId: string;
  usage: number;
  addedAt: string;
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

export const favoritesService = {
  async getFavorites(userId: string): Promise<FavoriteEntry[]> {
    // Try Supabase first
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        const { data, error } = await supabase
          .from('favorite_products')
          .select('*')
          .eq('user_id', uuidUserId)
          .order('usage_count', { ascending: false });

        if (error) {
          console.error('[favoritesService] Supabase error:', error);
          // Fallback to localStorage
        } else if (data) {
          // Convert Supabase data to FavoriteEntry format
          const entries: FavoriteEntry[] = data.map((item) => ({
            productId: item.product_name, // Using product_name as ID for now
            usage: item.usage_count || 0,
            addedAt: item.created_at,
          }));
          // Sync to localStorage
          const all = loadAll();
          all[userId] = entries;
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
    return all[userId] || [];
  },

  async addToFavorites(userId: string, productId: string) {
    // Get food info
    const food = foodService.getFoodById(productId, userId);
    if (!food) {
      console.error('[favoritesService] Food not found:', productId);
      return;
    }

    // Save to localStorage first
    const all = loadAll();
    const list = all[userId] || [];
    const idx = list.findIndex((f) => f.productId === productId);
    if (idx >= 0) return; // Already in favorites
    list.push({ productId, usage: 0, addedAt: new Date().toISOString() });
    all[userId] = list;
    saveAll(all);

    // Try to save to Supabase
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        const { error } = await supabase
          .from('favorite_products')
          .insert({
            user_id: uuidUserId,
            product_name: food.name,
            protein: food.protein,
            fat: food.fat,
            carbs: food.carbs,
            calories: food.calories,
            usage_count: 0,
          });

        if (error) {
          console.error('[favoritesService] Supabase save error:', error);
        }
      } catch (err) {
        console.error('[favoritesService] Supabase save connection error:', err);
      }
    }
  },

  async removeFromFavorites(userId: string, productId: string) {
    // Remove from localStorage
    const all = loadAll();
    const list = (all[userId] || []).filter((f) => f.productId !== productId);
    all[userId] = list;
    saveAll(all);

    // Get food info for Supabase
    const food = foodService.getFoodById(productId, userId);

    // Try to delete from Supabase
    if (supabase && food) {
      try {
        const uuidUserId = toUUID(userId);
        const { error } = await supabase
          .from('favorite_products')
          .delete()
          .eq('user_id', uuidUserId)
          .eq('product_name', food.name);

        if (error) {
          console.error('[favoritesService] Supabase delete error:', error);
        }
      } catch (err) {
        console.error('[favoritesService] Supabase delete connection error:', err);
      }
    }
  },

  async incrementFavoriteUsage(userId: string, productId: string) {
    // Update localStorage
    const all = loadAll();
    const list = all[userId] || [];
    const idx = list.findIndex((f) => f.productId === productId);
    if (idx >= 0) {
      list[idx].usage += 1;
      all[userId] = list;
      saveAll(all);
    }

    // Get food info
    const food = foodService.getFoodById(productId, userId);

    // Try to update in Supabase
    if (supabase && food) {
      try {
        // First get current usage_count
        const uuidUserId = toUUID(userId);
        const { data: existing } = await supabase
          .from('favorite_products')
          .select('usage_count')
          .eq('user_id', uuidUserId)
          .eq('product_name', food.name)
          .single();

        const newUsage = (existing?.usage_count || 0) + 1;

        const { error } = await supabase
          .from('favorite_products')
          .update({ usage_count: newUsage })
          .eq('user_id', uuidUserId)
          .eq('product_name', food.name);

        if (error) {
          console.error('[favoritesService] Supabase update error:', error);
        }
      } catch (err) {
        console.error('[favoritesService] Supabase update connection error:', err);
      }
    }
  },

  async isFavorite(userId: string, productId: string): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    return !!favorites.find((f) => f.productId === productId);
  },

  async resolveFavorites(userId: string): Promise<(Food & { usage: number })[]> {
    const entries = await this.getFavorites(userId);
    const resolved = entries
      .map((entry) => {
        const food = foodService.getFoodById(entry.productId, userId);
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
