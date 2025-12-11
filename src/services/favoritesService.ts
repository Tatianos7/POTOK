import { Food } from '../types';
import { foodService } from './foodService';

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
  getFavorites(userId: string): FavoriteEntry[] {
    const all = loadAll();
    return all[userId] || [];
  },

  addToFavorites(userId: string, productId: string) {
    const all = loadAll();
    const list = all[userId] || [];
    const idx = list.findIndex((f) => f.productId === productId);
    if (idx >= 0) return;
    list.push({ productId, usage: 0, addedAt: new Date().toISOString() });
    all[userId] = list;
    saveAll(all);
  },

  removeFromFavorites(userId: string, productId: string) {
    const all = loadAll();
    const list = (all[userId] || []).filter((f) => f.productId !== productId);
    all[userId] = list;
    saveAll(all);
  },

  incrementFavoriteUsage(userId: string, productId: string) {
    const all = loadAll();
    const list = all[userId] || [];
    const idx = list.findIndex((f) => f.productId === productId);
    if (idx >= 0) {
      list[idx].usage += 1;
      all[userId] = list;
      saveAll(all);
    }
  },

  isFavorite(userId: string, productId: string): boolean {
    const all = loadAll();
    return !!(all[userId] || []).find((f) => f.productId === productId);
  },

  resolveFavorites(userId: string): (Food & { usage: number })[] {
    const entries = this.getFavorites(userId);
    const resolved = entries
      .map((entry) => {
        const food = foodService.getFoodById(entry.productId, userId);
        if (!food) return null;
        return { ...food, usage: entry.usage };
      })
      .filter((f): f is Food & { usage: number } => !!f);
    return resolved.sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0));
  },

  getFavoriteFoods(userId: string): Food[] {
    return this.resolveFavorites(userId);
  },
};
