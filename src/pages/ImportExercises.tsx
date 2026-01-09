import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seedExercises } from '../utils/seedExercises';
import '../utils/seedExercises'; // Импортируем для доступа через window
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const ImportExercises = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    const importData = async () => {
      setStatus('loading');
      setMessage('Начинаю импорт упражнений...');
      setProgress('');

      try {
        console.log('Начинаю импорт упражнений...');
        
        // Импортируем упражнения
        await seedExercises();
        
        setStatus('success');
        setMessage('✅ Упражнения успешно импортированы!');
        setProgress('Все упражнения добавлены в базу данных.');
        
        console.log('✅ Упражнения успешно импортированы!');
      } catch (error: any) {
        setStatus('error');
        setMessage('❌ Ошибка импорта: ' + (error?.message || 'Неизвестная ошибка'));
        setProgress('');
        
        console.error('❌ Ошибка импорта:', error);
      }
    };

    // Автоматически запускаем импорт при загрузке страницы
    importData();
  }, []);

  const handleRetry = async () => {
    setStatus('idle');
    setMessage('');
    setProgress('');
    
    // Небольшая задержка перед повторной попыткой
    setTimeout(async () => {
      setStatus('loading');
      setMessage('Повторная попытка импорта...');
      
      try {
        await seedExercises();
        setStatus('success');
        setMessage('✅ Упражнения успешно импортированы!');
        setProgress('Все упражнения добавлены в базу данных.');
      } catch (error: any) {
        setStatus('error');
        setMessage('❌ Ошибка импорта: ' + (error?.message || 'Неизвестная ошибка'));
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
          Импорт упражнений
        </h1>

        <div className="space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader className="w-12 h-12 text-green-500 animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {message || 'Импорт упражнений...'}
              </p>
              {progress && (
                <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
                  {progress}
                </p>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {message}
              </p>
              {progress && (
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  {progress}
                </p>
              )}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => navigate('/workouts')}
                  className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  Перейти в дневник тренировок
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  На главную
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <XCircle className="w-12 h-12 text-red-500" />
              <p className="text-sm font-medium text-red-600 dark:text-red-400 text-center">
                {message}
              </p>
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleRetry}
                  className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-green-500 text-white hover:bg-green-600 transition-colors"
                >
                  Попробовать снова
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  На главную
                </button>
              </div>
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  Проверьте консоль браузера (F12) для деталей ошибки.
                  <br />
                  Убедитесь, что таблицы созданы в Supabase.
                </p>
              </div>
            </div>
          )}

          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Готов к импорту...
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Импорт может занять несколько минут в зависимости от количества упражнений.
            <br />
            Не закрывайте страницу до завершения.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImportExercises;

