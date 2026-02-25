const pad2 = (value: number): string => String(value).padStart(2, '0');

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_DAY_RE = /^\d{2}\.\d{2}\.\d{4}$/;

export const toIsoDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const formatUiDay = (isoDay: string): string => {
  if (!ISO_DAY_RE.test(isoDay)) return isoDay;
  const [year, month, day] = isoDay.split('-');
  return `${day}.${month}.${year}`;
};

export const parseLegacyDay = (value: string): string | null => {
  if (!value) return null;

  if (ISO_DAY_RE.test(value)) {
    return value;
  }

  if (!LEGACY_DAY_RE.test(value)) {
    return null;
  }

  const [dayRaw, monthRaw, yearRaw] = value.split('.');
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${yearRaw}-${monthRaw}-${dayRaw}`;
};

