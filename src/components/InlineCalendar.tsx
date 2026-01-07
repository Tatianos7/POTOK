import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface InlineCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  onClose: () => void;
}

const InlineCalendar = ({ selectedDate, onDateSelect, onClose }: InlineCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Парсим selectedDate (YYYY-MM-DD) в локальное время
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Утилита для получения сегодняшней даты в формате YYYY-MM-DD
  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Утилита для добавления/вычитания дней к дате в формате YYYY-MM-DD
  const getDateStringDaysAgo = (dateStr: string, days: number): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    return `${newYear}-${newMonth}-${newDay}`;
  };

  // Определяем диапазон доступных дат: today - 30 дней до today + 14 дней (в формате строк)
  const todayStr = getTodayDateString();
  const minDateStr = getDateStringDaysAgo(todayStr, -30);
  const maxDateStr = getDateStringDaysAgo(todayStr, 14);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Преобразуем воскресенье (0) в 6, остальные дни сдвигаем на -1
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    // Парсим selectedDate (YYYY-MM-DD) в локальное время
    const [year, month, dayNum] = selectedDate.split('-').map(Number);
    const selected = new Date(year, month - 1, dayNum);
    return (
      day === selected.getDate() &&
      currentMonth.getMonth() === selected.getMonth() &&
      currentMonth.getFullYear() === selected.getFullYear()
    );
  };

  const isDateInRange = (day: number) => {
    // Формируем дату в формате YYYY-MM-DD напрямую
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // Сравниваем строки напрямую
    return dateStr >= minDateStr && dateStr <= maxDateStr;
  };

  const handleDateClick = (day: number) => {
    // Формируем дату в формате YYYY-MM-DD напрямую из компонентов
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Проверяем, что дата в допустимом диапазоне (используем строки для сравнения)
    if (dateString < minDateStr || dateString > maxDateStr) {
      return; // Не позволяем выбирать даты вне диапазона
    }
    
    onDateSelect(dateString);
    onClose();
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    // Ограничиваем навигацию: не позволяем уходить дальше minDate
    const minMonthStr = `${minDateStr.substring(0, 7)}-01`;
    const newMonthStr = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, '0')}-01`;
    if (newMonthStr >= minMonthStr) {
      setCurrentMonth(newMonth);
    }
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    // Ограничиваем навигацию: не позволяем уходить дальше maxDate
    const maxMonthStr = `${maxDateStr.substring(0, 7)}-01`;
    const newMonthStr = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, '0')}-01`;
    if (newMonthStr <= maxMonthStr) {
      setCurrentMonth(newMonth);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  // Добавляем пустые ячейки для дней предыдущего месяца
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Добавляем дни текущего месяца
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mobile-lg:p-5 shadow-lg w-full max-w-full overflow-hidden">
      {/* Header с навигацией */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Следующий месяц"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Дни недели */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Календарная сетка */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isTodayDay = isToday(day);
          const isSelectedDay = isSelected(day);
          const isInRange = isDateInRange(day);

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={!isInRange}
              className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-colors ${
                !isInRange
                  ? 'opacity-30 cursor-not-allowed text-gray-400 dark:text-gray-600'
                  : isSelectedDay
                  ? 'bg-green-500 text-white'
                  : isTodayDay
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default InlineCalendar;

