import { useState, useEffect, useRef } from 'react';
import { Food } from '../types';
import { foodService } from '../services/foodService';
import { searchAnalyticsService, type FoodSearchAnalyticsContext } from '../services/searchAnalyticsService';
import ProductCard from './ProductCard';
import { Search, Loader2 } from 'lucide-react';

interface ProductSearchProps {
  onSelect: (food: Food) => void;
  onAddToBasket?: (food: Food) => void;
  isInBasket?: (food: Food) => boolean;
  userId?: string;
  value?: string; // контролируемый запрос
  onChangeQuery?: (q: string) => void;
  hideInput?: boolean; // спрятать инпут, если родитель рисует свой
  forceTrigger?: number; // менять число, чтобы форсировать повторный поиск даже с тем же запросом
  searchContext?: FoodSearchAnalyticsContext;
  variant?: 'inline' | 'overlay';
}

const ProductSearch = ({
  onSelect,
  onAddToBasket,
  isInBasket,
  userId,
  value,
  onChangeQuery,
  hideInput,
  forceTrigger,
  searchContext = 'diary',
  variant = 'inline',
}: ProductSearchProps) => {
  const isControlled = typeof value === 'string';
  const [internalQuery, setInternalQuery] = useState('');
  const query = isControlled ? value || '' : internalQuery;
  const [results, setResults] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastSearched = useRef<string>('');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const t = query.trim();
    let cancelled = false;
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      (async () => {
        try {
          // Используем новый метод поиска с приоритетом пользовательских продуктов
          const searchResults = await foodService.search(t, { userId, searchContext });
          if (!cancelled) {
            setResults(searchResults);
          }
        } catch (error) {
          if (!cancelled) {
            // Ошибки поиска обрабатываются внутри foodService
            // Здесь просто показываем пустой результат
            setResults([]);
          }
        } finally {
          if (!cancelled) {
            lastSearched.current = t;
            setIsLoading(false);
          }
        }
      })();
    }, 80); // быстрее отклик

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query, userId, forceTrigger, searchContext]);

  // Если инпут скрыт и запрос пустой - не рендерим ничего
  // (родительский компонент должен управлять показом/скрытием этого компонента)
  if (hideInput && !query.trim()) {
    return null;
  }

  const handleSelect = async (food: Food) => {
    await searchAnalyticsService.logSelection({
      query,
      context: searchContext,
      userId,
      food,
      resultCount: results.length,
      metadata: { source_surface: `${searchContext}_search` },
    });
    onSelect(food);
  };

  const handleAddToBasket = async (food: Food) => {
    await searchAnalyticsService.logSelection({
      query,
      context: searchContext,
      userId,
      food,
      resultCount: results.length,
      metadata: { source_surface: `${searchContext}_multi_add` },
    });
    onAddToBasket?.(food);
  };

  const resultsContainerClass =
    variant === 'overlay'
      ? 'absolute left-0 right-0 top-full z-40 mt-2 max-h-[340px] overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900'
      : 'w-full max-w-full overflow-hidden';

  return (
    <div className={resultsContainerClass} data-search-results-variant={variant}>
      {/* Search Input (optional) */}
      {!hideInput && (
        <div className="relative mb-4 w-full max-w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => (isControlled ? onChangeQuery?.(e.target.value) : setInternalQuery(e.target.value))}
            placeholder="Поиск продуктов..."
            className="w-full max-w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 box-border"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Results - рендерим ТОЛЬКО если есть запрос */}
      {query.trim() && (
        <>
          {!isLoading && (
            <div className={`space-y-4 overflow-x-hidden w-full max-w-full ${variant === 'overlay' ? 'p-3' : 'max-h-[400px] overflow-y-auto'}`}>
              {results.length > 0 ? (
                <>
                  {/* Ваши продукты */}
                  {results.filter(f => f.source === 'user').length > 0 && (
                    <div className="w-full max-w-full overflow-hidden">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 break-words">
                        Ваши продукты
                      </h3>
                      <div className="space-y-2 w-full max-w-full">
                        {results
                          .filter(f => f.source === 'user')
                          .map((food) => (
                            <div key={food.id} className="w-full max-w-full overflow-hidden">
                              <ProductCard
                                food={food}
                                onClick={() => handleSelect(food)}
                                onAddClick={onAddToBasket ? () => handleAddToBasket(food) : undefined}
                                isAdded={isInBasket?.(food) ?? false}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Общая база */}
                  {results.filter(f => f.source !== 'user').length > 0 && (
                    <div className="w-full max-w-full overflow-hidden">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 break-words">
                        Общая база
                      </h3>
                      <div className="space-y-2 w-full max-w-full">
                        {results
                          .filter(f => f.source !== 'user')
                          .map((food) => (
                            <div key={food.id} className="w-full max-w-full overflow-hidden">
                              <ProductCard
                                food={food}
                                onClick={() => handleSelect(food)}
                                onAddClick={onAddToBasket ? () => handleAddToBasket(food) : undefined}
                                isAdded={isInBasket?.(food) ?? false}
                              />
                            </div>
                          ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic break-words overflow-wrap-anywhere">
                        Данные носят справочный характер
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 w-full max-w-full">
                  <p>Продукты не найдены</p>
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              Ищем продукты...
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductSearch;
