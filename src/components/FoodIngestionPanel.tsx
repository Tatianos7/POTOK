import { useState } from 'react';
import { foodIngestionService } from '../services/foodIngestionService';

const FoodIngestionPanel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'core' | 'brand'>('core');
  const [sourceVersion, setSourceVersion] = useState('v1');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ id: string; conflict_type: string; details?: any; status: string }> >([]);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setStatus('Импортируем...');
    try {
      const text = await file.text();
      const batch = await foodIngestionService.createBatch({
        source: 'excel',
        filename: file.name,
        sourceVersion,
      });
      const { staged, conflicts: conflictCount } = await foodIngestionService.stageCsv(batch.id, text, { source, sourceVersion });
      setBatchId(batch.id);
      setStatus(`Загружено: ${staged}, конфликтов: ${conflictCount}`);
      const list = await foodIngestionService.listConflicts(batch.id);
      setConflicts(list);
    } catch (error) {
      console.error('[FoodIngestionPanel] import failed', error);
      setStatus('Ошибка импорта');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (conflictId: string, resolution: 'accept_new' | 'use_existing' | 'reject') => {
    setIsLoading(true);
    try {
      await foodIngestionService.resolveConflict(conflictId, resolution);
      if (batchId) {
        const list = await foodIngestionService.listConflicts(batchId);
        setConflicts(list);
      }
    } catch (error) {
      console.error('[FoodIngestionPanel] resolve failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!batchId) return;
    setIsLoading(true);
    setStatus('Коммитим...');
    try {
      await foodIngestionService.commitBatch(batchId);
      setStatus('Коммит завершен');
    } catch (error) {
      console.error('[FoodIngestionPanel] commit failed', error);
      setStatus('Ошибка коммита');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Импорт продуктов (Excel/CSV)</h2>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs"
          />
          <div className="flex gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'core' | 'brand')}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            >
              <option value="core">Core</option>
              <option value="brand">Brand</option>
            </select>
            <input
              value={sourceVersion}
              onChange={(e) => setSourceVersion(e.target.value)}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              placeholder="source version"
            />
            <button
              onClick={handleUpload}
              disabled={!file || isLoading}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Загрузить
            </button>
          </div>
          {status && <div className="text-xs text-gray-600 dark:text-gray-300">{status}</div>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Конфликты</h3>
          <button
            onClick={handleCommit}
            disabled={!batchId || isLoading}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50"
          >
            Коммит
          </button>
        </div>
        {conflicts.length === 0 ? (
          <div className="text-xs text-gray-500">Конфликтов нет</div>
        ) : (
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="border border-gray-200 dark:border-gray-700 rounded p-2 text-xs">
                <div className="font-semibold text-gray-800 dark:text-gray-200">{conflict.conflict_type}</div>
                <div className="text-gray-500 break-words">{JSON.stringify(conflict.details)}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleResolve(conflict.id, 'accept_new')}
                    className="px-2 py-1 bg-blue-600 text-white rounded"
                  >
                    Принять как новое
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'use_existing')}
                    className="px-2 py-1 bg-gray-600 text-white rounded"
                  >
                    Использовать существующее
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'reject')}
                    className="px-2 py-1 bg-red-600 text-white rounded"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodIngestionPanel;
