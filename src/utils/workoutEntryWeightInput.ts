export function sanitizeWorkoutWeightInput(value: string): string {
  if (value === '') return '';

  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const parts = normalized.split('.');
  const integerRaw = parts[0] ?? '';
  const fractionRaw = parts.slice(1).join('');

  const integer =
    integerRaw.length === 0 ? '' : integerRaw.replace(/^0+(?=\d)/, '');

  if (normalized.includes('.')) {
    const safeInteger = integer === '' ? '0' : integer;
    return `${safeInteger}.${fractionRaw}`;
  }

  return integer;
}

export function parseWorkoutWeightInput(value: string): number {
  return Math.max(0, Number(sanitizeWorkoutWeightInput(value)) || 0);
}

export function buildWorkoutWeightDraft(value: number): string {
  return sanitizeWorkoutWeightInput(String(value));
}

export function getWorkoutWeightInputProps(): { type: 'text'; inputMode: 'decimal' } {
  return {
    type: 'text',
    inputMode: 'decimal',
  };
}
