import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Minus, ArrowRight } from 'lucide-react';
import {
  measurementsService,
  type Measurement,
  type MeasurementHistory,
  type PhotoHistory,
} from '../services/measurementsService';

const Measurements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const additionalPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([
    { id: 'neck', name: 'ШЕЯ', value: '0' },
    { id: 'shoulders', name: 'ПЛЕЧИ', value: '0' },
    { id: 'chest', name: 'ГРУДЬ', value: '0' },
    { id: 'back', name: 'СПИНА', value: '0' },
  ]);
  const [customData, setCustomData] = useState('');
  const [photos, setPhotos] = useState<string[]>(['', '', '']); // 3 основных фото
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]); // Дополнительные фото (динамические)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [history, setHistory] = useState<MeasurementHistory[]>([]);
  const [photoHistory, setPhotoHistory] = useState<PhotoHistory[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [deleteDateId, setDeleteDateId] = useState<string | null>(null);

  const photoLabels = ['спереди', 'с боку', 'сзади'];

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Загружаем сохраненные замеры
    measurementsService.getCurrentMeasurements(user.id).then((savedMeasurements) => {
      setMeasurements(savedMeasurements);
    });

    // Загружаем сохраненные фото
    measurementsService.getCurrentPhotos(user.id).then(({ photos: savedPhotos, additionalPhotos: savedAdditionalPhotos }) => {
      // Первые 3 - основные фото
      const mainPhotos = savedPhotos.slice(0, 3);
      setPhotos([...mainPhotos, ...Array(3 - mainPhotos.length).fill('')].slice(0, 3));
      setAdditionalPhotos(savedAdditionalPhotos || []);
    });

    // Загружаем историю замеров (только для бесплатных пользователей)
    if (!user.hasPremium) {
      measurementsService.getMeasurementHistory(user.id).then((savedHistory) => {
        // Обрабатываем старые записи без фото
        const processedHistory = savedHistory.map((entry) => ({
          ...entry,
          photos: entry.photos || [],
          additionalPhotos: entry.additionalPhotos || [],
        }));
        setHistory(processedHistory);
      });

      // Загружаем историю фото отдельно
      measurementsService.getPhotoHistory(user.id).then((savedPhotoHistory) => {
        setPhotoHistory(savedPhotoHistory);
      });
    }
  }, [user, navigate]);

  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Проверяем, что клик не внутри меню или кнопки с тремя точками
      if (openMenuId && !target.closest('.measurement-menu') && !target.closest('.menu-trigger')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      // Используем небольшую задержку, чтобы дать время обработать клик на кнопку удаления
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId]);

  const handleIncrement = (id: string) => {
    setMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, value: (parseFloat(m.value) + 0.5).toFixed(1) }
          : m
      )
    );
  };

  const handleDecrement = (id: string) => {
    setMeasurements((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              value: Math.max(0, parseFloat(m.value) - 0.5).toFixed(1),
            }
          : m
      )
    );
  };

  const handleInputChange = (id: string, value: string) => {
    // Разрешаем только числа и точку
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setMeasurements((prev) =>
        prev.map((m) => (m.id === id ? { ...m, value } : m))
      );
    }
  };

  const handleInputBlur = (id: string) => {
    setMeasurements((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const numValue = parseFloat(m.value);
          return {
            ...m,
            value: isNaN(numValue) ? '0' : numValue.toFixed(1),
          };
        }
        return m;
      })
    );
  };

  const handlePhotoClick = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotos((prev) => {
          const newPhotos = [...prev];
          newPhotos[index] = result;
          return newPhotos;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCustomMeasurement = () => {
    if (!customData.trim() || !user?.id) return;

    const newMeasurement: Measurement = {
      id: `custom_${Date.now()}`,
      name: customData.trim().toUpperCase(),
      value: '0',
    };

    const updated = [...measurements, newMeasurement];
    setMeasurements(updated);
    setCustomData('');

    // Сохраняем изменения сразу
    measurementsService.saveCurrentMeasurements(user.id, updated, photos, additionalPhotos);
  };

  const handleAddAdditionalPhoto = () => {
    if (additionalPhotos.length < 10) { // Ограничение на 10 дополнительных фото
      setAdditionalPhotos((prev) => [...prev, '']);
    }
  };

  const handleAdditionalPhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAdditionalPhotos((prev) => {
          const newPhotos = [...prev];
          newPhotos[index] = result;
          return newPhotos;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAdditionalPhoto = (index: number) => {
    setAdditionalPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteHistoryEntry = async (entryId: string) => {
    if (!user?.id) return;
    
    await measurementsService.deleteMeasurementHistory(user.id, entryId);
    const updatedHistory = history.filter((entry) => entry.id !== entryId);
    setHistory(updatedHistory);
    setDeleteDateId(null);
    // История фото остается нетронутой
  };

  const handleDeletePhotoHistoryEntry = async (entryId: string) => {
    if (!user?.id) return;
    
    await measurementsService.deletePhotoHistory(user.id, entryId);
    const updatedPhotoHistory = photoHistory.filter((entry) => entry.id !== entryId);
    setPhotoHistory(updatedPhotoHistory);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Сохраняем текущие замеры и фото
    await measurementsService.saveCurrentMeasurements(user.id, measurements, photos, additionalPhotos);

    // Для бесплатных пользователей обрабатываем историю
    if (!user.hasPremium) {
      const currentPhotos = photos.filter(p => p !== '');
      const currentAdditionalPhotos = additionalPhotos.filter(p => p !== '');
      
      // Проверяем, изменились ли замеры по сравнению с последней записью
      const lastEntry = history[0];
      const measurementsChanged = !lastEntry || 
        JSON.stringify(lastEntry.measurements.map(m => ({ id: m.id, value: m.value }))) !== 
        JSON.stringify(measurements.map(m => ({ id: m.id, value: m.value })));

      if (measurementsChanged) {
        // Если замеры изменились - создаем новую запись
        const historyEntry: MeasurementHistory = {
          id: `history_${Date.now()}`,
          date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          measurements: measurements.map(m => ({ ...m })),
          photos: currentPhotos,
          additionalPhotos: currentAdditionalPhotos,
        };
        
        await measurementsService.saveMeasurementHistory(user.id, historyEntry);
        const updatedHistory = [historyEntry, ...history];
        setHistory(updatedHistory);
      } else if (lastEntry && (currentPhotos.length > 0 || currentAdditionalPhotos.length > 0)) {
        // Если замеры не изменились, но есть фото - обновляем последнюю запись
        const updatedEntry: MeasurementHistory = {
          ...lastEntry,
          photos: currentPhotos.length > 0 ? currentPhotos : lastEntry.photos,
          additionalPhotos: currentAdditionalPhotos.length > 0 ? currentAdditionalPhotos : lastEntry.additionalPhotos,
        };
        
        await measurementsService.saveMeasurementHistory(user.id, updatedEntry);
        const updatedHistory = [updatedEntry, ...history.slice(1)];
        setHistory(updatedHistory);
      }

      // Сохраняем фото в отдельную историю фото (независимо от замеров)
      if (currentPhotos.length > 0 || currentAdditionalPhotos.length > 0) {
        const currentDate = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const photoHistoryEntry: PhotoHistory = {
          id: `photo_history_${Date.now()}`,
          date: currentDate,
          photos: currentPhotos,
          additionalPhotos: currentAdditionalPhotos,
        };
        
        // Проверяем, есть ли уже запись с фото на эту дату
        const existingPhotoEntry = photoHistory.find(p => p.date === currentDate);
        if (existingPhotoEntry) {
          // Обновляем существующую запись
          const updatedPhotoHistoryEntry: PhotoHistory = {
            ...existingPhotoEntry,
            photos: currentPhotos.length > 0 ? currentPhotos : existingPhotoEntry.photos,
            additionalPhotos: currentAdditionalPhotos.length > 0 ? currentAdditionalPhotos : existingPhotoEntry.additionalPhotos,
          };
          await measurementsService.savePhotoHistory(user.id, updatedPhotoHistoryEntry);
          const updatedPhotoHistory = photoHistory.map(p => 
            p.date === currentDate ? updatedPhotoHistoryEntry : p
          );
          setPhotoHistory(updatedPhotoHistory);
        } else {
          // Создаем новую запись
          await measurementsService.savePhotoHistory(user.id, photoHistoryEntry);
          const updatedPhotoHistory = [photoHistoryEntry, ...photoHistory];
          setPhotoHistory(updatedPhotoHistory);
        }
      }
    }

    // Для премиум пользователей перенаправляем на главную, для бесплатных остаемся на странице
    if (user.hasPremium) {
      navigate('/');
    }
  };

  const handleDelete = (id: string) => {
    if (!user?.id) return;
    
    const updated = measurements.filter((m) => m.id !== id);
    setMeasurements(updated);
    setOpenMenuId(null);
    
    // Сохраняем изменения сразу
    measurementsService.saveCurrentMeasurements(user.id, updated, photos, additionalPhotos);
  };

  const handleClose = () => {
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden min-w-[320px]">
      <div className="max-w-[768px] mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <header className="px-2 sm:px-4 md:px-6 lg:px-8 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="flex-1 text-center px-4 min-w-[250px]">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase whitespace-nowrap">
                ТВОИ ЗАМЕРЫ
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 leading-tight">
                Введите значения там где вам<br/>важно отслеживать прогресс
              </p>
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                aria-label="Закрыть"
              >
                <X className="w-6 h-6 min-[376px]:w-7 min-[376px]:h-7 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 px-2 sm:px-4 md:px-6 lg:px-8 py-6">
          {/* Measurements Section */}
          <div className="space-y-4 mb-6">
            {measurements.map((measurement) => (
              <div key={measurement.id} className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenMenuId(openMenuId === measurement.id ? null : measurement.id);
                    }}
                    className="menu-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  >
                    <svg width="4" height="16" viewBox="0 0 4 16" fill="currentColor">
                      <circle cx="2" cy="2" r="1" />
                      <circle cx="2" cy="8" r="1" />
                      <circle cx="2" cy="14" r="1" />
                    </svg>
                  </button>
                  {openMenuId === measurement.id && (
                    <div 
                      className="measurement-menu absolute left-0 top-6 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[120px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDelete(measurement.id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                    {measurement.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDecrement(measurement.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Minus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <input
                    type="text"
                    value={measurement.value}
                    onChange={(e) => handleInputChange(measurement.id, e.target.value)}
                    onBlur={() => handleInputBlur(measurement.id)}
                    className={`w-20 px-3 py-2 rounded-lg border text-center text-sm font-medium ${
                      parseFloat(measurement.value) > 0
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500`}
                  />
                  <button
                    onClick={() => handleIncrement(measurement.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Data Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 dark:text-white uppercase mb-2">
              ДОБАВИТЬ ДАННЫЕ
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customData}
                onChange={(e) => setCustomData(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCustomMeasurement();
                  }
                }}
                placeholder="Введите в ручную"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleAddCustomMeasurement}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Add Photo Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                ДОБАВИТЬ ФОТО
              </label>
              <button
                onClick={handleAddAdditionalPhoto}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-white border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors"
                aria-label="Добавить дополнительное фото"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {/* Основные фото (первые 3) */}
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <input
                      ref={(el) => (fileInputRefs.current[index] = el)}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoChange(index, e)}
                      className="hidden"
                    />
                    <button
                      onClick={() => handlePhotoClick(index)}
                      className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden"
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={photoLabels[index]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Plus className="w-8 h-8 text-gray-400" />
                      )}
                    </button>
                    {photo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotos((prev) => {
                            const newPhotos = [...prev];
                            newPhotos[index] = '';
                            return newPhotos;
                          });
                        }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {photoLabels[index] && (
                      <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
                        {photoLabels[index]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Дополнительные фото */}
            {additionalPhotos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white uppercase mb-3">
                  ДОПОЛНИТЕЛЬНЫЕ ФОТО
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {additionalPhotos.map((photo, index) => (
                      <div key={index} className="relative">
                        <input
                          ref={(el) => (additionalPhotoRefs.current[index] = el)}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleAdditionalPhotoChange(index, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => additionalPhotoRefs.current[index]?.click()}
                          className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden"
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt={`Дополнительное фото ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Plus className="w-8 h-8 text-gray-400" />
                          )}
                        </button>
                        {photo && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAdditionalPhoto(index);
                            }}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* History Table (only for free users) - Always on top */}
          {!user?.hasPremium && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase mb-3">
                История замеров
              </h2>
              {history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                          Дата
                        </th>
                        {measurements.map((m) => (
                          <th
                            key={m.id}
                            className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase"
                          >
                            {m.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((entry) => (
                        <tr key={entry.id} className="bg-white dark:bg-gray-900">
                          <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white relative">
                            <button
                              onClick={() => setDeleteDateId(deleteDateId === entry.id ? null : entry.id)}
                              className="w-full text-left hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                              {entry.date}
                            </button>
                          {deleteDateId === entry.id && (
                            <div className="absolute left-0 bottom-full mb-1 z-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteHistoryEntry(entry.id);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
                              >
                                Удалить
                              </button>
                            </div>
                          )}
                          </td>
                          {measurements.map((m) => {
                            const historyMeasurement = entry.measurements.find((em) => em.id === m.id);
                            return (
                              <td
                                key={m.id}
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white"
                              >
                                {historyMeasurement?.value || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Нет сохраненных замеров
                </p>
              )}
            </div>
          )}

          {/* Photo History Section (only for free users) - Always below measurements history */}
          {!user?.hasPremium && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white uppercase mb-3">
                История фото
              </h2>
              {photoHistory.length > 0 ? (
                <div className="space-y-4">
                  {photoHistory.map((entry) => (
                    <div key={entry.id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-900 relative">
                      {/* Кнопка удаления */}
                      <button
                        onClick={() => handleDeletePhotoHistoryEntry(entry.id)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                        aria-label="Удалить"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Дата */}
                      <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.date}
                        </span>
                      </div>

                      {/* Основные фото */}
                      {entry.photos.length > 0 && (
                        <div className="mb-3">
                          <div className="grid grid-cols-3 gap-3">
                            {entry.photos.map((photo, index) => {
                              const photoLabel = photoLabels[index] || '';
                              return (
                                <div key={index} className="space-y-1">
                                  <button
                                    onClick={() => setSelectedPhoto(photo)}
                                    className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                                  >
                                    <img
                                      src={photo}
                                      alt={photoLabel || `Фото ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  {photoLabel && (
                                    <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                                      {photoLabel}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Дополнительные фото */}
                      {entry.additionalPhotos.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Дополнительные:</p>
                          <div className="grid grid-cols-3 gap-3">
                            {entry.additionalPhotos.map((photo, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedPhoto(photo)}
                                className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={photo}
                                  alt={`Дополнительное фото ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Нет сохраненных фото
                </p>
              )}
            </div>
          )}

          {/* Photo Modal */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
              onClick={() => setSelectedPhoto(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
                  aria-label="Закрыть"
                >
                  <X className="w-6 h-6 text-gray-900 dark:text-white" />
                </button>
                <img
                  src={selectedPhoto}
                  alt="Увеличенное фото"
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </main>

        {/* Save Button */}
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={handleSave}
            className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            СОХРАНИТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default Measurements;

