import { Food, UserCustomFood } from '../types';
import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';
import { RUS_PRODUCTS_SEED } from '../data/rusProductsSeed';
import { EAN_INDEX_SEED } from '../data/eanIndexSeed';
import { barcodeLookupService } from './barcodeLookupService';

/**
 * Архитектура работы с продуктами (РОССИЙСКАЯ БАЗА):
 * - Источник по умолчанию: Росстат / Скурихин (seed в проекте)
 * - Дополнительно: пользовательские продукты и ручные добавления (moderation)
 * - Полный оффлайн: без внешних запросов, все данные локально
 * - Поиск по штрих-коду: ean_index, при отсутствии — возврат not_found
 */

// === Конфигурация и ключи ===
const PRODUCTS_STORAGE_KEY = 'potok_products_russia_v1';
const EAN_INDEX_STORAGE_KEY = 'potok_ean_index_v1';
const USER_CUSTOM_PRODUCTS_KEY = 'potok_user_products_v1';
const DB_VERSION_KEY = 'potok_products_version';
const DB_VERSION = 'rus-1.0'; // полная смена базы на российскую

// Утилита: числовое значение с безопасным дефолтом
const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

class FoodService {
  constructor() {
    this.initializeStorage();
  }

  // Полная очистка старой базы при смене версии
  private initializeStorage() {
    const version = localStorage.getItem(DB_VERSION_KEY);
    if (version !== DB_VERSION) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(RUS_PRODUCTS_SEED));
      localStorage.setItem(EAN_INDEX_STORAGE_KEY, JSON.stringify(EAN_INDEX_SEED));
      localStorage.setItem(DB_VERSION_KEY, DB_VERSION);
    }
  }

  // === Работа с локальным хранилищем ===
  private normalizeFood(raw: Partial<Food>): Food {
    const now = new Date().toISOString();
    return {
      id: raw.id ?? `food_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: raw.name ?? raw.name_original ?? 'Без названия',
      name_original: raw.name_original,
      barcode: raw.barcode ?? null,
      calories: toNumber(raw.calories),
      protein: toNumber(raw.protein),
      fat: toNumber(raw.fat),
      carbs: toNumber(raw.carbs),
      category: raw.category,
      brand: raw.brand ?? null,
      source: raw.source ?? 'local',
      photo: raw.photo ?? null,
      aliases: raw.aliases ?? [],
      autoFilled: raw.autoFilled ?? false,
      popularity: raw.popularity ?? 0,
      createdAt: raw.createdAt ?? now,
      updatedAt: now,
    };
  }

  private loadAll(): Food[] {
    try {
      const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (!stored) return [];
      const parsed: Food[] = JSON.parse(stored);
      return parsed.map(this.normalizeFood.bind(this));
    } catch (error) {
      console.error('Error loading products', error);
      return [];
    }
  }

  private saveAll(foods: Food[]) {
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(foods));
    } catch (error) {
      console.error('Error saving products', error);
    }
  }

  private loadUserFoods(userId: string): UserCustomFood[] {
    try {
      const stored = localStorage.getItem(`${USER_CUSTOM_PRODUCTS_KEY}_${userId}`);
      if (!stored) return [];
      const parsed: UserCustomFood[] = JSON.parse(stored);
      return parsed.map((item) => ({
        ...this.normalizeFood(item),
        userId,
        source: 'manual',
      }));
    } catch (error) {
      console.error('Error loading user foods', error);
      return [];
    }
  }

  private saveUserFoods(userId: string, foods: UserCustomFood[]) {
    try {
      localStorage.setItem(`${USER_CUSTOM_PRODUCTS_KEY}_${userId}`, JSON.stringify(foods));
    } catch (error) {
      console.error('Error saving user foods', error);
    }
  }

  // === Вспомогательные функции ===

  private applyCategoryDefaults(food: Food): Food {
    if (food.calories && food.protein && food.fat && food.carbs) return food;
    const categoryKey = food.category || 'vegetables';
    const defaults = CATEGORY_DEFAULTS[categoryKey] || CATEGORY_DEFAULTS.vegetables;
    return {
      ...food,
      calories: food.calories || defaults.calories,
      protein: food.protein || defaults.protein,
      fat: food.fat || defaults.fat,
      carbs: food.carbs || defaults.carbs,
      autoFilled: true,
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/й/g, 'и')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stemRu(word: string): string {
    return word.replace(/(ами|ями|ов|ев|ей|ой|ий|ый|ая|яя|ое|ее|ам|ям|ах|ях|ом|ем|ю|а|я|ы|и|ь)$/i, '');
  }

  private fuzzyMatch(query: string, text?: string | null): boolean {
    if (!text) return false;
    const q = this.stemRu(this.normalizeText(query));
    const t = this.stemRu(this.normalizeText(text));
    if (!q) return false;
    if (t === q) return true;
    if (t.startsWith(q)) return true;
    if (t.includes(q)) return true;
    // subsequence
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  // === Основной pipeline ===
  private upsertFood(food: Food) {
    const foods = this.loadAll();
    const idx = foods.findIndex((f) => f.id === food.id || (food.barcode && f.barcode === food.barcode));
    if (idx >= 0) {
      foods[idx] = { ...foods[idx], ...food, updatedAt: new Date().toISOString() };
    } else {
      foods.push(food);
    }
    this.saveAll(foods);
  }

  private searchLocal(query: string, category?: string): Food[] {
    const all = this.loadAll();
    const q = query.toLowerCase().trim();
    const filtered = all.filter((f) => {
      if (category && f.category !== category) return false;
      if (!q) return true;
      const aliases = f.aliases || (f as any).synonyms || [];
      return (
        this.fuzzyMatch(q, f.name) ||
        this.fuzzyMatch(q, f.name_original) ||
        this.fuzzyMatch(q, f.brand) ||
        aliases.some((a: string) => this.fuzzyMatch(q, a))
      );
    });
    return filtered.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }

  private findLocalByBarcode(barcode: string): Food | null {
    const all = this.loadAll();
    return all.find((f) => f.barcode === barcode) || null;
  }

  async findByBarcode(barcode: string, _userId?: string): Promise<Food | null> {
    const cleaned = barcode?.trim();
    if (!cleaned) return null;

    // 1) прямое попадание в ean_index
    const eanEntry = barcodeLookupService.findProductId(cleaned);
    if (eanEntry?.productId) {
      const product = this.getFoodById(eanEntry.productId);
      if (product) return product;
    }

    // 2) локальный поиск по полю barcode
    const local = this.findLocalByBarcode(cleaned);
    if (local) return local;

    // 3) not found — вернуть null (UI может показать форму добавления)
    return null;
  }

  async search(query: string, options?: { category?: string; limit?: number }): Promise<Food[]> {
    const limit = options?.limit ?? 30;
    const category = options?.category;

    const local = this.searchLocal(query, category);
    const unique = Array.from(new Map(local.map((f) => [f.barcode || f.id, f])).values());

    // автодополнение макросов при необходимости
    const normalized = unique.map((f) => (f.calories ? f : this.applyCategoryDefaults(f)));

    // сортируем по популярности и наличию точного совпадения
    const q = query.toLowerCase().trim();
    normalized.sort((a, b) => {
      const aExact = a.name.toLowerCase() === q || a.name_original?.toLowerCase() === q;
      const bExact = b.name.toLowerCase() === q || b.name_original?.toLowerCase() === q;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

    return normalized.slice(0, limit);
  }

  async searchByCategory(category: string, limit = 50): Promise<Food[]> {
    const local = this.searchLocal('', category);
    return local.slice(0, limit);
  }

  // === Пользовательские продукты ===
  createCustomFood(userId: string, data: Omit<Food, 'id' | 'source' | 'createdAt' | 'updatedAt'>): UserCustomFood {
    const food: UserCustomFood = {
      ...this.normalizeFood(data),
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      source: 'manual',
    };
    const userFoods = this.loadUserFoods(userId);
    userFoods.push(food);
    this.saveUserFoods(userId, userFoods);
    return food;
  }

  saveFood(food: Food): void {
    this.upsertFood(this.normalizeFood(food));
  }

  getFoodById(id: string, userId?: string): Food | null {
    const all = this.loadAll();
    const local = all.find((f) => f.id === id);
    if (local) return local;
    if (userId) {
      const uf = this.loadUserFoods(userId).find((f) => f.id === id);
      if (uf) return uf;
    }
    return null;
  }
}

export const foodService = new FoodService();
