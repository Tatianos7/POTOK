export function sanitizeWorkoutIntegerInput(value: string): string {
  if (value === '') return '';
  return value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
}

export function parseWorkoutIntegerInput(value: string): number {
  return Math.max(0, Number(sanitizeWorkoutIntegerInput(value)) || 0);
}

export function buildWorkoutIntegerDraft(value: number): string {
  return sanitizeWorkoutIntegerInput(String(value));
}

export function getWorkoutIntegerInputProps(): { type: 'text'; inputMode: 'numeric' } {
  return {
    type: 'text',
    inputMode: 'numeric',
  };
}
