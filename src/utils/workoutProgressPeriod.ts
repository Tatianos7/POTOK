export interface WorkoutProgressMonthPeriod {
  anchorDate: string;
  from: string;
  to: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getWorkoutProgressMonthPeriod(anchorDate: string): WorkoutProgressMonthPeriod {
  const [year, month] = anchorDate.split('-').map(Number);
  const monthIndex = month - 1;
  return {
    anchorDate,
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(daysInMonth(year, monthIndex))}`,
  };
}

export function formatWorkoutProgressMonthLabel(anchorDate: string): string {
  const [year, month] = anchorDate.split('-').map(Number);
  const months = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ];

  return `${months[month - 1]} ${year}`;
}

export function applyWorkoutProgressMonthSelection(date: string): {
  selectedMonthDate: string;
  isCalendarOpen: false;
} {
  const [year, month] = date.split('-').map(Number);
  return {
    selectedMonthDate: `${year}-${pad2(month)}-01`,
    isCalendarOpen: false,
  };
}
