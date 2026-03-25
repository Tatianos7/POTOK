const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function resolveDiarySelectedDateFromState(
  state: unknown,
  fallbackDate: string
): string {
  const selectedDate =
    state && typeof state === 'object' && 'selectedDate' in state
      ? (state as { selectedDate?: unknown }).selectedDate
      : null;

  return typeof selectedDate === 'string' && DAY_KEY_REGEX.test(selectedDate)
    ? selectedDate
    : fallbackDate;
}

