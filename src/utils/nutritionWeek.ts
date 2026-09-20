/** Civil dates supplied by the caller (getLocalDayKey), never inferred from UTC now. */
export function parseNutritionDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) throw new Error('invalid_calendar_date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('invalid_calendar_date');
  return date;
}

export function shiftNutritionDate(value: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new Error('invalid_day_offset');
  const date = parseNutritionDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_day_offset');
  const key = date.toISOString().slice(0, 10);
  parseNutritionDate(key);
  return key;
}

export function nutritionWeekDates(today: string, offset: 0 | 1 = 0): string[] {
  const weekday = parseNutritionDate(today).getUTCDay();
  const monday = shiftNutritionDate(today, -((weekday + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => shiftNutritionDate(monday, i));
}
