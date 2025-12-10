import { useState, useEffect } from 'react';
import { Food } from '../types';
import { foodService } from '../services/foodService';
import ProductCard from './ProductCard';
import { Search, Loader2 } from 'lucide-react';

interface ProductSearchProps {
  onSelect: (food: Food) => void;
  userId?: string;
  value?: string; // контролируемый запрос
  onChangeQuery?: (q: string) => void;
  hideInput?: boolean; // спрятать инпут, если родитель рисует свой
}

const ProductSearch = ({ onSelect, userId, value, onChangeQuery, hideInput }: ProductSearchProps) => {
  const isControlled = typeof value === 'string';
  const [internalQuery, setInternalQuery] = useState('');
  const query = isControlled ? value || '' : internalQuery;
  const [results, setResults] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchProducts = async () => {
      setIsLoading(true);
      
      try {
        const searchResults = await foodService.search(query);
        setResults(searchResults);
      } catch (error) {
        console.error('Error searching products:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchProducts, 300);
    return () => clearTimeout(timeoutId);
  }, [query, userId]);

  return (
    <div className="w-full">
      {/* Search Input (optional) */}
      {!hideInput && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => (isControlled ? onChangeQuery?.(e.target.value) : setInternalQuery(e.target.value))}
            placeholder="Поиск продуктов..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {query.trim() && !isLoading && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            results.map((food) => (
              <ProductCard
                key={food.id}
                food={food}
                onClick={() => onSelect(food)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Продукты не найдены</p>
            </div>
          )}
        </div>
      )}

      {query.trim() && isLoading && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          Ищем продукты...
        </div>
      )}
    </div>
  );
};

export default ProductSearch;

