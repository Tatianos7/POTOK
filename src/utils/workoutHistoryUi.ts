export function toggleWorkoutHistoryCalendar(isOpen: boolean): boolean {
  return !isOpen;
}

export function applyWorkoutHistoryDateSelection(date: string): { selectedDate: string; isCalendarOpen: false } {
  return {
    selectedDate: date,
    isCalendarOpen: false,
  };
}

export function shouldShowWorkoutHistoryRepeatButton(entriesCount: number, isLoading: boolean): boolean {
  return !isLoading && entriesCount > 0;
}
