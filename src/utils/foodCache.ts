/**
 * In-memory кэш для результатов поиска из внешних API
 * Кэширует только Open Food Facts и USDA
 * TTL: 10 минут
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live в миллисекундах
}

class FoodCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 10 * 60 * 1000; // 10 минут

  /**
   * Получить данные из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Проверяем, не истек ли TTL
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Сохранить данные в кэш
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    });
  }

  /**
   * Удалить запись из кэша
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Очистить весь кэш
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Очистить устаревшие записи
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Генерация ключа кэша для поиска
   */
  generateKey(service: 'open_food_facts' | 'usda', query: string): string {
    return `${service}:${query.toLowerCase().trim()}`;
  }
}

export const foodCache = new FoodCache();
export { FoodCache };

// Периодическая очистка устаревших записей (каждые 5 минут)
if (typeof window !== 'undefined') {
  setInterval(() => {
    foodCache.cleanup();
  }, 5 * 60 * 1000);
}

