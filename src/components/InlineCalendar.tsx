import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface InlineCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  onClose: () => void;
}

const InlineCalendar = ({ selectedDate, onDateSelect, onClose }: InlineCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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
    const selected = new Date(selectedDate);
    return (
      day === selected.getDate() &&
      currentMonth.getMonth() === selected.getMonth() &&
      currentMonth.getFullYear() === selected.getFullYear()
    );
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateString = date.toISOString().split('T')[0];
    onDateSelect(dateString);
    onClose();
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 shadow-lg min-w-[320px] w-max">
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

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-colors ${
                isSelectedDay
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

