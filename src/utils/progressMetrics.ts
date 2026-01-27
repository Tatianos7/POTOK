export interface TrendPoint {
  date: string;
  value: number | null | undefined;
}

export const computeEMA = (points: TrendPoint[], alpha = 0.3): TrendPoint[] => {
  const result: TrendPoint[] = [];
  let prev: number | null = null;
  points.forEach((point) => {
    const value = Number(point.value);
    if (!Number.isFinite(value)) {
      result.push({ date: point.date, value: prev });
      return;
    }
    if (prev === null) {
      prev = value;
    } else {
      prev = alpha * value + (1 - alpha) * prev;
    }
    result.push({ date: point.date, value: prev });
  });
  return result;
};

export const computeSlope = (points: TrendPoint[]): number | null => {
  const filtered = points
    .map((p, idx) => ({ x: idx, y: Number(p.value) }))
    .filter((p) => Number.isFinite(p.y));
  if (filtered.length < 2) return null;
  const n = filtered.length;
  const sumX = filtered.reduce((sum, p) => sum + p.x, 0);
  const sumY = filtered.reduce((sum, p) => sum + p.y, 0);
  const sumXY = filtered.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = filtered.reduce((sum, p) => sum + p.x * p.x, 0);
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  return (n * sumXY - sumX * sumY) / denominator;
};
